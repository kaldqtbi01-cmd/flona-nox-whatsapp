import type { WhatsAppProvider } from '../bridge/provider.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getChatPrefs } from '../storage/chat-prefs.js';
import { formatChatLabel, getChatByJid, type ChatListItem } from '../storage/chats.js';
import {
  draftReply as insertOutboxDraft,
  type DraftReplyInput,
  type OutboxItem,
} from '../storage/outbox.js';

const log = logger.child({ component: 'outbound' });

export interface DraftNotifyResult extends OutboxItem {
  notified: boolean;
  notificationMessageId?: string;
  notificationText: string;
  ownerNotifyJid?: string;
}

export type SendTextFn = (chatJid: string, text: string) => Promise<string | undefined>;

export interface OutboundDeps {
  insertDraft?: typeof insertOutboxDraft;
  getChat?: typeof getChatByJid;
  sendText?: SendTextFn;
  resolveOwnerNotifyJid?: () => string | undefined;
  getChatPrefs?: typeof getChatPrefs;
}

let boundProvider: WhatsAppProvider | undefined;

/**
 * Bind the live WhatsApp provider used for owner draft notifications.
 */
export function configureOutbound(provider: WhatsAppProvider): void {
  boundProvider = provider;
}

export function getOutboundProvider(): WhatsAppProvider | undefined {
  return boundProvider;
}

/**
 * Format the owner self-chat notification for a staged draft.
 * Shape: `Draft for <chat>\n<text>`
 */
export function formatDraftOwnerNotification(options: {
  chatLabel: string;
  body: string;
  outboxId?: string;
}): string {
  const chat = options.chatLabel.trim() || 'unknown chat';
  const body = options.body.trim();
  const lines = [`Draft for ${chat}`, body];
  if (options.outboxId) {
    lines.push('', `id: ${options.outboxId}`);
  }
  return lines.join('\n');
}

function resolveOwnerNotifyJidFromProvider(): string | undefined {
  if (config.OWNER_NOTIFY_JID?.trim()) {
    return config.OWNER_NOTIFY_JID.trim();
  }
  return boundProvider?.getSelfJid();
}

/**
 * Stage a reply in the outbox (`requires_approval=true`) and notify the owner
 * via a self-chat WhatsApp message.
 */
export async function draftReplyAndNotify(
  input: DraftReplyInput,
  deps: OutboundDeps = {},
): Promise<DraftNotifyResult> {
  const insertDraft = deps.insertDraft ?? insertOutboxDraft;
  const getChat = deps.getChat ?? getChatByJid;
  const sendText =
    deps.sendText ??
    ((chatJid: string, text: string) => {
      if (!boundProvider) {
        return Promise.reject(new Error('Outbound WhatsApp provider is not configured'));
      }
      return boundProvider.sendText(chatJid, text);
    });
  const resolveOwnerNotifyJid = deps.resolveOwnerNotifyJid ?? resolveOwnerNotifyJidFromProvider;

  const loadPrefs = deps.getChatPrefs ?? getChatPrefs;
  const prefs = await loadPrefs(input.chatJid);
  const autoSend = prefs.autoSend;
  // Default: owner approval. Per-chat auto-send stages as approved for the sender loop.
  const draft = await insertDraft({
    chatJid: input.chatJid,
    body: input.body,
    requiresApproval: !autoSend,
    status: autoSend ? 'approved' : 'pending',
  });

  const chat: ChatListItem | null = await getChat(draft.chatJid);
  const chatLabel = formatChatLabel(chat ?? { chatJid: draft.chatJid, name: null });
  const notificationText = formatDraftOwnerNotification({
    chatLabel,
    body: draft.body,
    outboxId: draft.id,
  });

  if (autoSend) {
    log.info(
      { outboxId: draft.id, chatJid: draft.chatJid },
      'Draft auto-approved (chat auto-send enabled)',
    );
    return {
      ...draft,
      requiresApproval: false,
      notified: false,
      notificationText,
    };
  }

  const ownerNotifyJid = resolveOwnerNotifyJid();
  if (!ownerNotifyJid) {
    log.warn(
      { outboxId: draft.id, chatJid: draft.chatJid },
      'Draft staged but owner notify JID unavailable — skipping WhatsApp notification',
    );
    return {
      ...draft,
      requiresApproval: true,
      notified: false,
      notificationText,
    };
  }

  try {
    const notificationMessageId = await sendText(ownerNotifyJid, notificationText);
    log.info(
      {
        outboxId: draft.id,
        chatJid: draft.chatJid,
        ownerNotifyJid,
        notificationMessageId,
      },
      'Notified owner of staged draft',
    );
    return {
      ...draft,
      requiresApproval: true,
      notified: true,
      notificationMessageId,
      notificationText,
      ownerNotifyJid,
    };
  } catch (error) {
    log.error(
      { err: error, outboxId: draft.id, ownerNotifyJid },
      'Failed to notify owner of staged draft',
    );
    return {
      ...draft,
      requiresApproval: true,
      notified: false,
      notificationText,
      ownerNotifyJid,
    };
  }
}
