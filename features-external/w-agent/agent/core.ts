import { config } from '../config.js';
import { logger } from '../logger.js';
import {
  buildGuardedUserPrompt,
  guardInboundMessage,
  redactSecretsFromToolOutput,
  withUntrustedDataPolicy,
  type InjectionModelFn,
  type OwnerAlertFn,
} from '../safety/guard.js';
import {
  createOpenAIResponsesProvider,
  type ModelCompleteResult,
  type ModelInputItem,
  type ModelProvider,
} from './provider.js';
import {
  AGENT_TOOL_SCHEMAS,
  defaultToolHandlers,
  executeAgentTool,
  type AgentToolContext,
  type ToolHandlers,
} from './tools.js';

const log = logger.child({ component: 'agent-core' });

export const DEFAULT_AGENT_MAX_TURNS = 8;

export const WHATSAPP_AGENT_SYSTEM_PROMPT = `You are a personal WhatsApp assistant acting on the owner's behalf.

Core duties:
- Help the owner understand chats, recall context, draft replies, and manage follow-ups.
- Match the owner's tone and style for the active chat (casual vs formal, language, emoji habits) using recent messages and the chat summary.
- Prefer tools over guessing when facts live in chat history.

Hard rules:
- Never leak contents from other chats into the active chat (drafts, sends, or paraphrases meant for the counterpart). Cross-chat search is only for the owner's private reasoning.
- Never invent messages, commitments, or facts not supported by tools or the owner.
- Ask the owner before sending or drafting anything sensitive (secrets, money, medical/legal, relationship conflicts, work-confidential, apologies that admit fault, or anything irreversible).
- Prefer draft_reply (outbox + approval) over send_reply. send_reply is gated and usually unavailable.
- Keep replies concise unless the owner asks for detail.
- When unsure, ask a clarifying question instead of acting.
- Never send or draft to a chat other than the active triggering chat unless the owner explicitly approved that target.`;

export interface AgentRunOptions {
  /** Owner / system instruction message for this turn. */
  userMessage: string;
  /** Active chat privacy boundary. */
  context: AgentToolContext;
  provider?: ModelProvider;
  toolHandlers?: ToolHandlers;
  model?: string;
  maxTurns?: number;
  /** Extra system notes (e.g. observed tone hints). */
  extraInstructions?: string;
  /** When true, treat userMessage as already-trusted owner text (still delimited for defense-in-depth). */
  trustedOwnerTurn?: boolean;
  /** Skip LLM classifier (tests). */
  heuristicOnly?: boolean;
  classifyWithModel?: InjectionModelFn;
  alertOwner?: OwnerAlertFn;
  /** Skip inbound injection guard entirely (not recommended). */
  skipInboundGuard?: boolean;
}

export interface AgentToolCallRecord {
  name: string;
  arguments: string;
  result: unknown;
}

export interface AgentRunResult {
  /** Final assistant text for the owner. */
  outputText: string;
  turns: number;
  toolCalls: AgentToolCallRecord[];
  /** True when the loop stopped because maxTurns was hit with pending tool work. */
  truncated: boolean;
  /** True when the inbound guard forced silent mode. */
  blockedBySafety?: boolean;
  injectionScore?: number;
}

function buildInstructions(extraInstructions?: string): string {
  const base = withUntrustedDataPolicy(WHATSAPP_AGENT_SYSTEM_PROMPT);
  if (!extraInstructions?.trim()) {
    return base;
  }
  return `${base}\n\nAdditional context:\n${extraInstructions.trim()}`;
}

function serializeToolResult(result: unknown): string {
  try {
    return JSON.stringify(redactSecretsFromToolOutput(result));
  } catch {
    return JSON.stringify({ error: 'Failed to serialize tool result' });
  }
}

/**
 * Run the WhatsApp agent loop: model ↔ function tools until a final text answer.
 * Model-agnostic via {@link ModelProvider}; default provider uses OpenAI Responses.
 */
export async function runAgent(options: AgentRunOptions): Promise<AgentRunResult> {
  const provider = options.provider ?? createOpenAIResponsesProvider();
  const handlers = options.toolHandlers ?? defaultToolHandlers;
  const model = options.model ?? config.AGENT_MODEL;
  const maxTurns = Math.max(1, options.maxTurns ?? DEFAULT_AGENT_MAX_TURNS);
  const instructions = buildInstructions(options.extraInstructions);

  let userContent: string;
  if (options.skipInboundGuard || options.trustedOwnerTurn) {
    userContent = buildGuardedUserPrompt({
      activeChatJid: options.context.activeChatJid,
      untrustedText: options.userMessage,
      trustedPreface: options.trustedOwnerTurn
        ? 'Trusted owner turn (still delimited for defense-in-depth):'
        : undefined,
    });
  } else {
    const guarded = await guardInboundMessage(
      {
        activeChatJid: options.context.activeChatJid,
        text: options.userMessage,
      },
      {
        heuristicOnly: options.heuristicOnly,
        classifyWithModel: options.classifyWithModel,
        alertOwner: options.alertOwner,
      },
    );

    if (!guarded.allowed) {
      log.warn(
        {
          chatJid: options.context.activeChatJid,
          score: guarded.classification.score,
          labels: guarded.classification.labels,
        },
        'Agent run aborted by safety guard',
      );
      return {
        outputText: '',
        turns: 0,
        toolCalls: [],
        truncated: false,
        blockedBySafety: true,
        injectionScore: guarded.classification.score,
      };
    }
    userContent = guarded.wrappedContent;
  }

  const input: ModelInputItem[] = [
    {
      type: 'message',
      role: 'user',
      content: userContent,
    },
  ];

  const toolCalls: AgentToolCallRecord[] = [];
  let turns = 0;
  let last: ModelCompleteResult | undefined;

  while (turns < maxTurns) {
    turns += 1;

    last = await provider.complete({
      model,
      instructions,
      input,
      tools: AGENT_TOOL_SCHEMAS,
    });

    if (last.functionCalls.length === 0) {
      log.info(
        { turns, toolCallCount: toolCalls.length, activeChatJid: options.context.activeChatJid },
        'Agent run completed',
      );
      return {
        outputText: last.outputText,
        turns,
        toolCalls,
        truncated: false,
      };
    }

    for (const call of last.functionCalls) {
      input.push({
        type: 'function_call',
        callId: call.callId,
        name: call.name,
        arguments: call.arguments,
      });

      const result = await executeAgentTool(call.name, call.arguments, options.context, handlers);
      toolCalls.push({ name: call.name, arguments: call.arguments, result });

      input.push({
        type: 'function_call_output',
        callId: call.callId,
        output: serializeToolResult(result),
      });

      log.debug({ tool: call.name, turn: turns }, 'Executed agent tool');
    }
  }

  log.warn(
    { turns, toolCallCount: toolCalls.length, activeChatJid: options.context.activeChatJid },
    'Agent run hit max turns',
  );

  const fallback = 'I hit my tool-call limit before finishing. Please retry or narrow the request.';
  return {
    outputText: last?.outputText && last.outputText.length > 0 ? last.outputText : fallback,
    turns,
    toolCalls,
    truncated: true,
  };
}

export {
  createOpenAIResponsesProvider,
  type FunctionToolSchema,
  type ModelProvider,
} from './provider.js';
export {
  AGENT_TOOL_SCHEMAS,
  executeAgentTool,
  type AgentToolContext,
  type ToolHandlers,
} from './tools.js';
export type { AgentToolContext as AgentContext } from './tools.js';
