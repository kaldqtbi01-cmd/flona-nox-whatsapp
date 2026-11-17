import type { WhatsAppProvider } from '../bridge/provider.js';
import { logger } from '../logger.js';
import { formatQueueHealth, getQueueHealth, type QueueHealthFn } from '../queue/health.js';
import { formatChatLabel, getChatByJid, listChats } from '../storage/chats.js';
import {
  getEngagementSettings,
  setChatEngagementMode,
  setEngagementSettings,
  type EngagementSettings,
} from '../storage/engagement.js';
import { searchMessages, type SearchMessageHit } from '../storage/search.js';
import {
  getChatSummary,
  updateChatSummary,
  type SummarizeChatFn,
  type UpdateChatSummaryResult,
} from '../storage/summary.js';
import type { EngageMessage } from './engage.js';
import { getOutboundProvider } from './outbound.js';

const log = logger.child({ component: 'agent-commands' });

export type AgentCommandName =
  'status' | 'summary' | 'search' | 'mute' | 'unmute' | 'mode' | 'digest' | 'help' | 'unknown';

export interface ParsedAgentCommand {
  name: AgentCommandName;
  /** Remaining args after the subcommand (e.g. search query, mode value). */
  args: string;
  raw: string;
}

export interface AgentCommandResult {
  command: AgentCommandName;
  /** WhatsApp JID that receives the reply (owner self-chat for private results). */
  replyJid: string;
  replyText: string;
}

export interface AgentCommandDeps {
  provider?: WhatsAppProvider;
  getSettings?: () => Promise<EngagementSettings>;
  setSettings?: typeof setEngagementSettings;
  setChatMode?: typeof setChatEngagementMode;
  updateSummary?: (
    chatJid: string,
    options?: { force?: boolean; summarizeFn?: SummarizeChatFn },
  ) => Promise<UpdateChatSummaryResult>;
  getSummary?: typeof getChatSummary;
  search?: typeof searchMessages;
  listChats?: typeof listChats;
  getChat?: typeof getChatByJid;
  getQueueHealth?: QueueHealthFn;
  /** Force a summary text in tests without calling OpenAI. */
  summarizeFn?: SummarizeChatFn;
}

const HELP_TEXT = [
  'Commands:',
  '/agent status — connection + queue health',
  '/agent summary — summarize this chat now',
  '/agent search <query> — search all chats (owner-only reply)',
  '/agent mute | /agent unmute — per-chat opt-out/in',
  '/agent mode off|trusted|on — global engagement mode',
  '/agent digest — on-demand digest of recent chats',
].join('\n');

/**
 * Parse the text after `/agent` into a structured command.
 */
export function parseAgentCommand(commandText: string): ParsedAgentCommand {
  const raw = commandText.trim();
  if (!raw) {
    return { name: 'help', args: '', raw };
  }

  const [head, ...rest] = raw.split(/\s+/);
  const name = (head ?? '').toLowerCase();
  const args = rest.join(' ').trim();

  switch (name) {
    case 'status':
    case 'summary':
    case 'search':
    case 'mute':
    case 'unmute':
    case 'mode':
    case 'digest':
    case 'help':
      return { name, args, raw };
    default:
      return { name: 'unknown', args: raw, raw };
  }
}

function resolveOwnerReplyJid(
  provider: WhatsAppProvider | undefined,
  fallbackChatJid: string,
): string {
  return provider?.getSelfJid() ?? fallbackChatJid;
}

function formatSearchResults(hits: SearchMessageHit[]): string {
  if (hits.length === 0) {
    return 'No matching messages.';
  }
  return hits
    .slice(0, 10)
    .map((hit, index) => {
      const body = hit.body.length > 160 ? `${hit.body.slice(0, 157)}...` : hit.body;
      return `${String(index + 1)}. [${hit.chatJid}] ${hit.senderName}: ${body}`;
    })
    .join('\n');
}

/**
 * Execute a parsed `/agent` command and return the WhatsApp reply payload.
 */
export async function executeAgentCommand(
  parsed: ParsedAgentCommand,
  message: EngageMessage,
  deps: AgentCommandDeps = {},
): Promise<AgentCommandResult> {
  const provider = deps.provider ?? getOutboundProvider();
  const ownerJid = resolveOwnerReplyJid(provider, message.chatJid);
  const getSettings = deps.getSettings ?? getEngagementSettings;
  const setSettings = deps.setSettings ?? setEngagementSettings;
  const setChatMode = deps.setChatMode ?? setChatEngagementMode;
  const updateSummary = deps.updateSummary ?? updateChatSummary;
  const getSummary = deps.getSummary ?? getChatSummary;
  const search = deps.search ?? searchMessages;
  const list = deps.listChats ?? listChats;
  const getChat = deps.getChat ?? getChatByJid;
  const queueHealth = deps.getQueueHealth ?? getQueueHealth;

  switch (parsed.name) {
    case 'help':
      return { command: 'help', replyJid: ownerJid, replyText: HELP_TEXT };

    case 'unknown':
      return {
        command: 'unknown',
        replyJid: ownerJid,
        replyText: `Unknown command. ${HELP_TEXT}`,
      };

    case 'status': {
      const connected = provider?.isConnected() ?? false;
      const selfJid = provider?.getSelfJid() ?? '(unknown)';
      const settings = await getSettings();
      const queues = formatQueueHealth(await queueHealth());
      const replyText = [
        'W Agent status',
        `connection: ${connected ? 'connected' : 'disconnected'}`,
        `self: ${selfJid}`,
        `mode: ${settings.agentMode}`,
        `enabled: ${settings.enabled ? 'yes' : 'no'}`,
        'queues:',
        queues,
      ].join('\n');
      return { command: 'status', replyJid: ownerJid, replyText };
    }

    case 'summary': {
      const result = await updateSummary(message.chatJid, {
        force: true,
        summarizeFn: deps.summarizeFn,
      });
      const summary = result.summary ?? (await getSummary(message.chatJid)).summary;
      const chat = await getChat(message.chatJid);
      const label = formatChatLabel(chat ?? { chatJid: message.chatJid, name: null });
      const replyText = summary
        ? `Summary for ${label}\n\n${summary}`
        : `No summary available for ${label} (${result.reason}).`;
      return { command: 'summary', replyJid: ownerJid, replyText };
    }

    case 'search': {
      if (!parsed.args) {
        return {
          command: 'search',
          replyJid: ownerJid,
          replyText: 'Usage: /agent search <query>',
        };
      }
      const hits = await search(parsed.args, { limit: 10 });
      const replyText = [`Search: ${parsed.args}`, '', formatSearchResults(hits)].join('\n');
      // Always owner-only — never post search hits into the triggering group/chat.
      return { command: 'search', replyJid: ownerJid, replyText };
    }

    case 'mute': {
      await setChatMode(message.chatJid, 'opt_out');
      return {
        command: 'mute',
        replyJid: ownerJid,
        replyText: `Muted agent replies in ${message.chatJid}`,
      };
    }

    case 'unmute': {
      await setChatMode(message.chatJid, 'default');
      return {
        command: 'unmute',
        replyJid: ownerJid,
        replyText: `Unmuted agent replies in ${message.chatJid}`,
      };
    }

    case 'mode': {
      const mode = parsed.args.trim().toLowerCase();
      if (mode !== 'off' && mode !== 'trusted' && mode !== 'on') {
        return {
          command: 'mode',
          replyJid: ownerJid,
          replyText: 'Usage: /agent mode off|trusted|on',
        };
      }
      const agentMode = mode;
      const next = await setSettings({
        agentMode,
        enabled: agentMode !== 'off',
        allowUnknownNumbers: agentMode === 'on',
      });
      return {
        command: 'mode',
        replyJid: ownerJid,
        replyText: `Agent mode set to ${next.agentMode} (enabled=${next.enabled ? 'yes' : 'no'}, unknown_numbers=${next.allowUnknownNumbers ? 'yes' : 'no'})`,
      };
    }

    case 'digest': {
      const chats = await list({ limit: 15 });
      if (chats.length === 0) {
        return {
          command: 'digest',
          replyJid: ownerJid,
          replyText: 'Digest: no chats found.',
        };
      }
      const lines: string[] = ['Daily digest (on demand)', ''];
      for (const chat of chats) {
        const summary = await getSummary(chat.chatJid);
        const label = formatChatLabel(chat);
        const trimmedSummary = summary.summary?.trim();
        const blurb =
          trimmedSummary && trimmedSummary.length > 0 ? trimmedSummary : '(no summary yet)';
        const clipped = blurb.length > 220 ? `${blurb.slice(0, 217)}...` : blurb;
        lines.push(`• ${label}`);
        lines.push(`  ${clipped}`);
      }
      return { command: 'digest', replyJid: ownerJid, replyText: lines.join('\n') };
    }
  }
}

/**
 * Parse + execute an owner `/agent` command from engagement, then send the WhatsApp reply.
 */
export async function runOwnerAgentCommand(
  message: EngageMessage,
  commandText: string,
  deps: AgentCommandDeps & {
    sendText?: (chatJid: string, text: string) => Promise<string | undefined>;
  } = {},
): Promise<AgentCommandResult> {
  const parsed = parseAgentCommand(commandText);
  const result = await executeAgentCommand(parsed, message, deps);
  const provider = deps.provider ?? getOutboundProvider();
  const sendText =
    deps.sendText ??
    ((chatJid: string, text: string) => {
      if (!provider) {
        return Promise.reject(new Error('WhatsApp provider not configured for command replies'));
      }
      return provider.sendText(chatJid, text);
    });

  await sendText(result.replyJid, result.replyText);
  log.info(
    { command: result.command, replyJid: result.replyJid, chatJid: message.chatJid },
    'Owner agent command handled',
  );
  return result;
}
