import OpenAI from 'openai';
import type {
  EasyInputMessage,
  FunctionTool,
  ResponseInputItem,
  Tool,
} from 'openai/resources/responses/responses.js';

import { config } from '../config.js';
import { logger } from '../logger.js';

const log = logger.child({ component: 'model-provider' });

/** OpenAI-style function tool schema (Responses API `type: "function"`). */
export interface FunctionToolSchema {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}

export type ModelInputItem =
  | {
      type: 'message';
      role: 'system' | 'user' | 'assistant' | 'developer';
      content: string;
    }
  | {
      type: 'function_call';
      callId: string;
      name: string;
      arguments: string;
    }
  | {
      type: 'function_call_output';
      callId: string;
      output: string;
    };

export interface ModelFunctionCall {
  callId: string;
  name: string;
  arguments: string;
}

export interface ModelCompleteRequest {
  model: string;
  /** Optional top-level instructions (Responses API `instructions`). */
  instructions?: string;
  input: ModelInputItem[];
  tools: FunctionToolSchema[];
}

export interface ModelCompleteResult {
  outputText: string;
  functionCalls: ModelFunctionCall[];
  responseId?: string;
}

/**
 * Model-agnostic completion surface used by the agent loop.
 * OpenAI implements this via the Responses API; other providers can swap in later.
 */
export interface ModelProvider {
  complete(request: ModelCompleteRequest): Promise<ModelCompleteResult>;
}

function toResponsesTools(tools: FunctionToolSchema[]): Tool[] {
  return tools.map((tool): FunctionTool => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: tool.strict ?? true,
  }));
}

function toResponsesInput(items: ModelInputItem[]): ResponseInputItem[] {
  const input: ResponseInputItem[] = [];

  for (const item of items) {
    if (item.type === 'message') {
      const message: EasyInputMessage = {
        type: 'message',
        role: item.role,
        content: item.content,
      };
      input.push(message);
      continue;
    }

    if (item.type === 'function_call') {
      input.push({
        type: 'function_call',
        call_id: item.callId,
        name: item.name,
        arguments: item.arguments,
      });
      continue;
    }

    input.push({
      type: 'function_call_output',
      call_id: item.callId,
      output: item.output,
    });
  }

  return input;
}

let openaiClient: OpenAI | undefined;

function getOpenAIClient(): OpenAI {
  return (openaiClient ??= new OpenAI({ apiKey: config.OPENAI_API_KEY }));
}

/**
 * OpenAI Responses API implementation of {@link ModelProvider}.
 */
export class OpenAIResponsesProvider implements ModelProvider {
  constructor(private readonly client: OpenAI = getOpenAIClient()) {}

  async complete(request: ModelCompleteRequest): Promise<ModelCompleteResult> {
    const response = await this.client.responses.create({
      model: request.model,
      instructions: request.instructions,
      input: toResponsesInput(request.input),
      tools: toResponsesTools(request.tools),
      parallel_tool_calls: true,
    });

    const functionCalls: ModelFunctionCall[] = [];
    const textParts: string[] = [];

    for (const item of response.output) {
      if (item.type === 'function_call') {
        functionCalls.push({
          callId: item.call_id,
          name: item.name,
          arguments: item.arguments,
        });
        continue;
      }

      if (item.type === 'message') {
        for (const part of item.content) {
          if (part.type === 'output_text') {
            textParts.push(part.text);
          }
        }
      }
    }

    const joined = textParts.join('\n').trim();
    const outputText = joined.length > 0 ? joined : response.output_text.trim();

    log.debug(
      {
        model: request.model,
        responseId: response.id,
        functionCalls: functionCalls.length,
        hasText: outputText.length > 0,
      },
      'OpenAI Responses completion',
    );

    return {
      outputText,
      functionCalls,
      responseId: response.id,
    };
  }
}

export function createOpenAIResponsesProvider(): ModelProvider {
  return new OpenAIResponsesProvider();
}
