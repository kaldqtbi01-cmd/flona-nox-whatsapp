import { assertOutboundChatAllowed, redactSecretsFromToolOutput } from '../safety/guard.js';
import { listChats } from '../storage/chats.js';
import { getContactInfo } from '../storage/contacts.js';
import { sendReply } from '../storage/outbox.js';
import { getChatContext, searchMessages } from '../storage/search.js';
import { getChatSummary } from '../storage/summary.js';
import { draftReplyAndNotify } from './outbound.js';
import type { FunctionToolSchema } from './provider.js';

export interface AgentToolContext {
  /** Chat currently being assisted — privacy boundary for replies. */
  activeChatJid: string;
  /**
   * Owner-approved chat JIDs for cross-chat draft/send.
   * Without an entry here, the agent may only message `activeChatJid`.
   */
  ownerApprovedChatJids?: string[];
}

export interface ToolHandlers {
  searchMessages: typeof searchMessages;
  getChatContext: typeof getChatContext;
  getChatSummary: typeof getChatSummary;
  listChats: typeof listChats;
  getContactInfo: typeof getContactInfo;
  draftReply: typeof draftReplyAndNotify;
  sendReply: typeof sendReply;
}

export const defaultToolHandlers: ToolHandlers = {
  searchMessages,
  getChatContext,
  getChatSummary,
  listChats,
  getContactInfo,
  draftReply: draftReplyAndNotify,
  sendReply,
};

/**
 * OpenAI function schemas exposed to the agent (Responses API tools).
 */
export const AGENT_TOOL_SCHEMAS: FunctionToolSchema[] = [
  {
    type: 'function',
    name: 'search_messages',
    description:
      'Hybrid semantic + full-text search over WhatsApp message history. Prefer scoping to the active chat unless the owner explicitly asks to search elsewhere. Never paste other chats’ private contents into the active chat.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: 'Natural-language or keyword search query.' },
        chat_jid: {
          type: ['string', 'null'],
          description: 'Optional chat JID to restrict search. Null searches across chats.',
        },
        limit: {
          type: ['integer', 'null'],
          description: 'Max hits to return (default 10).',
        },
      },
      required: ['query', 'chat_jid', 'limit'],
    },
  },
  {
    type: 'function',
    name: 'get_chat_context',
    description:
      'Return the last N messages in a chat, formatted with sender names and timestamps.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        chat_jid: {
          type: ['string', 'null'],
          description: 'Chat JID. Null uses the active chat.',
        },
        n: {
          type: ['integer', 'null'],
          description: 'Number of recent messages (default 20).',
        },
      },
      required: ['chat_jid', 'n'],
    },
  },
  {
    type: 'function',
    name: 'get_chat_summary',
    description:
      'Load the rolling long-term memory summary for a chat (topics, roles, open questions, decisions).',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        chat_jid: {
          type: ['string', 'null'],
          description: 'Chat JID. Null uses the active chat.',
        },
      },
      required: ['chat_jid'],
    },
  },
  {
    type: 'function',
    name: 'list_chats',
    description: 'List recent WhatsApp chats (jid, name, group flag, last activity).',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: {
          type: ['integer', 'null'],
          description: 'Max chats to return (default 50).',
        },
      },
      required: ['limit'],
    },
  },
  {
    type: 'function',
    name: 'get_contact_info',
    description: 'Look up a contact by WhatsApp JID (name, phone, business flag).',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        jid: { type: 'string', description: 'Contact JID, e.g. 15551234567@s.whatsapp.net' },
      },
      required: ['jid'],
    },
  },
  {
    type: 'function',
    name: 'draft_reply',
    description:
      'Stage a WhatsApp reply into the outbox (always requires owner approval) and notify the owner via a self-chat message. Does not send to the recipient immediately. Match the owner’s tone for that chat.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        body: { type: 'string', description: 'Message text to stage.' },
        chat_jid: {
          type: ['string', 'null'],
          description:
            'Target chat JID. Null uses the active chat. Must not target a different chat without explicit owner instruction.',
        },
        requires_approval: {
          type: ['boolean', 'null'],
          description: 'Ignored — outbound drafts always require approval.',
        },
      },
      required: ['body', 'chat_jid', 'requires_approval'],
    },
  },
  {
    type: 'function',
    name: 'send_reply',
    description:
      'Send a WhatsApp reply immediately. Currently gated / disabled — prefer draft_reply. Do not use for sensitive content without explicit owner confirmation.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        body: { type: 'string', description: 'Message text to send.' },
        chat_jid: {
          type: ['string', 'null'],
          description: 'Target chat JID. Null uses the active chat.',
        },
      },
      required: ['body', 'chat_jid'],
    },
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value : undefined;
}

function asNullableNumber(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function resolveChatJid(activeChatJid: string, chatJid: string | null | undefined): string {
  return chatJid && chatJid.trim().length > 0 ? chatJid.trim() : activeChatJid;
}

/**
 * Execute a named agent tool and return a JSON-serializable result for the model.
 */
function sealToolResult(result: unknown): unknown {
  return redactSecretsFromToolOutput(result);
}

export async function executeAgentTool(
  name: string,
  rawArguments: string,
  context: AgentToolContext,
  handlers: ToolHandlers = defaultToolHandlers,
): Promise<unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments || '{}') as unknown;
  } catch {
    return sealToolResult({ error: 'Invalid JSON arguments' });
  }

  const args = asRecord(parsed);

  switch (name) {
    case 'search_messages': {
      const queryText = asString(args.query)?.trim();
      if (!queryText) {
        return sealToolResult({ error: 'query is required' });
      }
      const chatJid = asNullableString(args.chat_jid);
      const limit = asNullableNumber(args.limit) ?? 10;
      const hits = await handlers.searchMessages(queryText, {
        chatJid: chatJid ?? undefined,
        limit,
      });
      return sealToolResult({
        hits: hits.map((hit) => ({
          messageId: hit.messageId,
          chatJid: hit.chatJid,
          senderName: hit.senderName,
          body: hit.body,
          timestamp: hit.timestamp.toISOString(),
          score: hit.score,
        })),
      });
    }

    case 'get_chat_context': {
      const chatJid = resolveChatJid(context.activeChatJid, asNullableString(args.chat_jid));
      const n = asNullableNumber(args.n) ?? 20;
      const messages = await handlers.getChatContext(chatJid, n);
      return sealToolResult({
        chatJid,
        messages: messages.map((m) => ({
          senderName: m.senderName,
          body: m.body,
          timestamp: m.timestamp.toISOString(),
          direction: m.direction,
          formatted: m.formatted,
        })),
      });
    }

    case 'get_chat_summary': {
      const chatJid = resolveChatJid(context.activeChatJid, asNullableString(args.chat_jid));
      const summary = await handlers.getChatSummary(chatJid);
      return sealToolResult({
        chatJid: summary.chatJid,
        summary: summary.summary,
        updatedAt: summary.updatedAt?.toISOString() ?? null,
        summarizedUntil: summary.summarizedUntil?.toISOString() ?? null,
      });
    }

    case 'list_chats': {
      const limit = asNullableNumber(args.limit) ?? 50;
      const chats = await handlers.listChats({ limit });
      return sealToolResult({
        chats: chats.map((chat) => ({
          chatJid: chat.chatJid,
          name: chat.name,
          isGroup: chat.isGroup,
          lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
        })),
      });
    }

    case 'get_contact_info': {
      const jid = asString(args.jid)?.trim();
      if (!jid) {
        return sealToolResult({ error: 'jid is required' });
      }
      const contact = await handlers.getContactInfo(jid);
      if (!contact) {
        return sealToolResult({ found: false, jid });
      }
      return sealToolResult({
        found: true,
        contactJid: contact.contactJid,
        name: contact.name,
        phone: contact.phone,
        isBusiness: contact.isBusiness,
      });
    }

    case 'draft_reply': {
      const body = asString(args.body)?.trim();
      if (!body) {
        return sealToolResult({ error: 'body is required' });
      }
      const chatJid = resolveChatJid(context.activeChatJid, asNullableString(args.chat_jid));
      const chatCheck = assertOutboundChatAllowed(context.activeChatJid, chatJid, {
        ownerApprovedChatJids: context.ownerApprovedChatJids,
      });
      if (!chatCheck.allowed) {
        return sealToolResult({
          error: chatCheck.reason,
          activeChatJid: context.activeChatJid,
          requestedChatJid: chatJid,
        });
      }
      // Outbound pipeline always forces requires_approval=true (tool arg ignored).
      const draft = await handlers.draftReply({
        chatJid,
        body,
        requiresApproval: true,
      });
      return sealToolResult({
        staged: true,
        outboxId: draft.id,
        chatJid: draft.chatJid,
        body: draft.body,
        status: draft.status,
        requiresApproval: true,
        notified: draft.notified,
        notificationMessageId: draft.notificationMessageId,
      });
    }

    case 'send_reply': {
      const body = asString(args.body)?.trim();
      if (!body) {
        return sealToolResult({ error: 'body is required' });
      }
      const chatJid = resolveChatJid(context.activeChatJid, asNullableString(args.chat_jid));
      const chatCheck = assertOutboundChatAllowed(context.activeChatJid, chatJid, {
        ownerApprovedChatJids: context.ownerApprovedChatJids,
      });
      if (!chatCheck.allowed) {
        return sealToolResult({
          error: chatCheck.reason,
          activeChatJid: context.activeChatJid,
          requestedChatJid: chatJid,
        });
      }
      return sealToolResult(await handlers.sendReply({ chatJid, body }));
    }

    default:
      return sealToolResult({ error: `Unknown tool: ${name}` });
  }
}
