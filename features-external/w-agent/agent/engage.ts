import { logger } from '../logger.js';
import {
  getChatEngagementMode,
  getEngagementSettings,
  idsMatch,
  isIdAllowlisted,
  normalizeEngagementSettings,
  type ChatEngagementMode,
  type EngagementSettings,
} from '../storage/engagement.js';
import {
  runOwnerAgentCommand,
  type AgentCommandDeps,
  type AgentCommandResult,
} from './commands.js';

const log = logger.child({ component: 'engage' });

export type EngageDecision = 'reply' | 'silent' | 'escalate';

export type EngageRule =
  | 'disabled'
  | 'owner_command'
  | 'chat_opt_out'
  | 'dm_allowlisted'
  | 'dm_opt_in'
  | 'dm_unknown_silent'
  | 'dm_unknown_escalate'
  | 'dm_unknown_allowed'
  | 'group_mention_allowlisted'
  | 'group_mention_opt_in'
  | 'group_mention_escalate'
  | 'group_no_mention'
  | 'outbound_non_command'
  | 'not_applicable';

/**
 * Normalized inbound/outbound event considered by the engagement engine.
 */
export interface EngageMessage {
  chatJid: string;
  senderJid: string;
  direction: 'inbound' | 'outbound';
  body?: string;
  isGroup: boolean;
  /** True when the linked owner (or an owner JID) is @-mentioned. */
  mentionedOwner?: boolean;
  mentionedJids?: string[];
  messageId?: string;
  timestamp?: Date;
}

export interface EngageVerdict {
  decision: EngageDecision;
  rule: EngageRule;
  reason: string;
  /** True when this was forced by `/agent` (or configured prefix). */
  ownerCommand: boolean;
  /** Body with the command prefix stripped, when applicable. */
  commandText?: string;
}

export interface DecideEngageOptions {
  settings: EngagementSettings;
  chatMode?: ChatEngagementMode;
  /** Owner JIDs for mention / command detection (merged with settings.ownerJids). */
  ownerJids?: string[];
  /** Linked account JID (fromMe / self-chat). */
  selfJid?: string;
}

/**
 * Commands only work from the owner's own number (outbound/fromMe or known owner JIDs).
 */
export function isOwnerSender(
  message: EngageMessage,
  ownerJids: string[],
  selfJid?: string,
): boolean {
  if (message.direction === 'outbound') {
    return true;
  }
  const identities = [...ownerJids, ...(selfJid ? [selfJid] : [])];
  if (identities.length === 0) {
    return false;
  }
  return identities.some((id) => idsMatch(message.senderJid, id));
}

/**
 * Detect an owner command prefix at the start of the message body.
 */
export function parseOwnerCommand(
  body: string | undefined,
  prefix: string,
): { isCommand: boolean; commandText: string } {
  const text = body?.trim() ?? '';
  if (!text) {
    return { isCommand: false, commandText: '' };
  }
  const normalizedPrefix = prefix.trim().toLowerCase();
  const lower = text.toLowerCase();
  if (lower === normalizedPrefix) {
    return { isCommand: true, commandText: '' };
  }
  if (lower.startsWith(`${normalizedPrefix} `) || lower.startsWith(`${normalizedPrefix}\n`)) {
    return { isCommand: true, commandText: text.slice(normalizedPrefix.length).trim() };
  }
  return { isCommand: false, commandText: '' };
}

function ownerMentioned(message: EngageMessage, ownerJids: string[]): boolean {
  if (message.mentionedOwner === true) {
    return true;
  }
  if (!message.mentionedJids?.length || ownerJids.length === 0) {
    return false;
  }
  return message.mentionedJids.some((jid) => isIdAllowlisted(jid, ownerJids));
}

/**
 * Pure decision matrix for a single message (no I/O, no debounce).
 */
export function decideEngage(message: EngageMessage, options: DecideEngageOptions): EngageVerdict {
  const settings = normalizeEngagementSettings(options.settings);
  const chatMode = options.chatMode ?? 'default';
  const ownerJids = [...settings.ownerJids, ...(options.ownerJids ?? [])];

  const command = parseOwnerCommand(message.body, settings.commandPrefix);
  const fromOwner = isOwnerSender(message, ownerJids, options.selfJid);
  const isOwnerCommand = command.isCommand && fromOwner;

  if (command.isCommand && !fromOwner) {
    return {
      decision: 'silent',
      rule: 'not_applicable',
      reason: 'Ignoring /agent command from non-owner sender',
      ownerCommand: false,
    };
  }

  if (isOwnerCommand) {
    return {
      decision: 'reply',
      rule: 'owner_command',
      reason: `Owner command ${settings.commandPrefix}`,
      ownerCommand: true,
      commandText: command.commandText,
    };
  }

  if (message.direction === 'outbound') {
    return {
      decision: 'silent',
      rule: 'outbound_non_command',
      reason: 'Outbound message is not an owner agent command',
      ownerCommand: false,
    };
  }

  if (!settings.enabled || settings.agentMode === 'off') {
    return {
      decision: 'silent',
      rule: 'disabled',
      reason: 'Engagement policy is disabled',
      ownerCommand: false,
    };
  }

  if (chatMode === 'opt_out') {
    return {
      decision: 'silent',
      rule: 'chat_opt_out',
      reason: 'Chat is opted out of agent replies',
      ownerCommand: false,
    };
  }

  if (!message.isGroup) {
    const allowlisted =
      chatMode === 'opt_in' || isIdAllowlisted(message.senderJid, settings.allowlistedContacts);

    if (allowlisted) {
      return {
        decision: 'reply',
        rule: chatMode === 'opt_in' ? 'dm_opt_in' : 'dm_allowlisted',
        reason:
          chatMode === 'opt_in' ? '1:1 chat is opted in' : '1:1 message from allowlisted contact',
        ownerCommand: false,
      };
    }

    if (settings.allowUnknownNumbers) {
      return {
        decision: 'reply',
        rule: 'dm_unknown_allowed',
        reason: 'Unknown number allowed by settings.allowUnknownNumbers',
        ownerCommand: false,
      };
    }

    if (settings.escalateUnknownNumbers) {
      return {
        decision: 'escalate',
        rule: 'dm_unknown_escalate',
        reason: 'Unknown number — escalate to owner',
        ownerCommand: false,
      };
    }

    return {
      decision: 'silent',
      rule: 'dm_unknown_silent',
      reason: 'Unknown number — never reply by default',
      ownerCommand: false,
    };
  }

  // Group chats
  const mentioned = ownerMentioned(message, ownerJids);
  if (!mentioned) {
    return {
      decision: 'silent',
      rule: 'group_no_mention',
      reason: 'Group message did not @-mention the owner',
      ownerCommand: false,
    };
  }

  const groupAllowlisted =
    chatMode === 'opt_in' || isIdAllowlisted(message.chatJid, settings.allowlistedGroups);

  if (groupAllowlisted) {
    return {
      decision: 'reply',
      rule: chatMode === 'opt_in' ? 'group_mention_opt_in' : 'group_mention_allowlisted',
      reason:
        chatMode === 'opt_in'
          ? 'Owner @-mentioned in opted-in group'
          : 'Owner @-mentioned in allowlisted group',
      ownerCommand: false,
    };
  }

  if (settings.escalateNonAllowlistedGroupMentions) {
    return {
      decision: 'escalate',
      rule: 'group_mention_escalate',
      reason: 'Owner @-mentioned in a non-allowlisted group — escalate',
      ownerCommand: false,
    };
  }

  return {
    decision: 'silent',
    rule: 'not_applicable',
    reason: 'Owner @-mentioned in non-allowlisted group; escalation disabled',
    ownerCommand: false,
  };
}

/**
 * Async wrapper: load settings + per-chat mode, then decide.
 */
export async function evaluateEngagement(
  message: EngageMessage,
  options: {
    settings?: EngagementSettings;
    chatMode?: ChatEngagementMode;
    ownerJids?: string[];
    selfJid?: string;
  } = {},
): Promise<EngageVerdict> {
  const settings = options.settings ?? (await getEngagementSettings());
  const chatMode = options.chatMode ?? (await getChatEngagementMode(message.chatJid));
  const verdict = decideEngage(message, {
    settings,
    chatMode,
    ownerJids: options.ownerJids,
    selfJid: options.selfJid,
  });
  log.debug(
    {
      chatJid: message.chatJid,
      decision: verdict.decision,
      rule: verdict.rule,
    },
    'Engagement decision',
  );
  return verdict;
}

export interface DebouncedEngageBatch {
  chatJid: string;
  messages: EngageMessage[];
  verdicts: EngageVerdict[];
  /** Primary verdict for the batched agent turn (first reply-driving verdict). */
  verdict: EngageVerdict;
}

export type EngageFlushHandler = (batch: DebouncedEngageBatch) => void | Promise<void>;

export interface EngagementDebouncerOptions {
  debounceMs?: number;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}

interface PendingBatch {
  messages: EngageMessage[];
  verdicts: EngageVerdict[];
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Batches rapid-fire reply-eligible messages from the same chat into one agent turn.
 * Window starts on the first message and flushes after `debounceMs` (default 8s).
 */
export class EngagementDebouncer {
  private readonly pending = new Map<string, PendingBatch>();
  private readonly debounceMs: number;
  private readonly setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
  private flushHandler: EngageFlushHandler | undefined;

  constructor(options: EngagementDebouncerOptions = {}) {
    this.debounceMs = options.debounceMs ?? 8_000;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
  }

  onFlush(handler: EngageFlushHandler): void {
    this.flushHandler = handler;
  }

  /**
   * Enqueue a reply-eligible message. Returns true when buffered for a future flush.
   */
  enqueue(message: EngageMessage, verdict: EngageVerdict): boolean {
    if (verdict.decision !== 'reply') {
      return false;
    }

    const existing = this.pending.get(message.chatJid);
    if (existing) {
      existing.messages.push(message);
      existing.verdicts.push(verdict);
      return true;
    }

    const timer = this.setTimer(() => {
      void this.flushChat(message.chatJid);
    }, this.debounceMs);

    this.pending.set(message.chatJid, {
      messages: [message],
      verdicts: [verdict],
      timer,
    });
    return true;
  }

  /** Pending message count for a chat (tests / metrics). */
  pendingCount(chatJid: string): number {
    return this.pending.get(chatJid)?.messages.length ?? 0;
  }

  async flushChat(chatJid: string): Promise<DebouncedEngageBatch | null> {
    const batch = this.pending.get(chatJid);
    if (!batch) {
      return null;
    }
    this.pending.delete(chatJid);
    this.clearTimer(batch.timer);

    const result: DebouncedEngageBatch = {
      chatJid,
      messages: batch.messages,
      verdicts: batch.verdicts,
      verdict: batch.verdicts[0] ?? {
        decision: 'reply',
        rule: 'not_applicable',
        reason: 'empty batch',
        ownerCommand: false,
      },
    };

    log.debug(
      { chatJid, count: result.messages.length, debounceMs: this.debounceMs },
      'Flushing debounced engagement batch',
    );

    await this.flushHandler?.(result);
    return result;
  }

  async flushAll(): Promise<void> {
    const chats = [...this.pending.keys()];
    for (const chatJid of chats) {
      await this.flushChat(chatJid);
    }
  }

  clear(): void {
    for (const batch of this.pending.values()) {
      this.clearTimer(batch.timer);
    }
    this.pending.clear();
  }
}

/**
 * High-level entry: decide engagement, run owner `/agent` commands, debounce replies.
 */
export async function processInboundEngagement(
  message: EngageMessage,
  options: {
    settings?: EngagementSettings;
    chatMode?: ChatEngagementMode;
    ownerJids?: string[];
    selfJid?: string;
    debouncer?: EngagementDebouncer;
    commandDeps?: AgentCommandDeps & {
      sendText?: (chatJid: string, text: string) => Promise<string | undefined>;
    };
    onEscalate?: (message: EngageMessage, verdict: EngageVerdict) => void | Promise<void>;
    onSilent?: (message: EngageMessage, verdict: EngageVerdict) => void | Promise<void>;
    onCommand?: (
      message: EngageMessage,
      verdict: EngageVerdict,
      result: AgentCommandResult,
    ) => void | Promise<void>;
  } = {},
): Promise<EngageVerdict & { commandResult?: AgentCommandResult }> {
  const verdict = await evaluateEngagement(message, options);

  if (verdict.ownerCommand) {
    const commandResult = await runOwnerAgentCommand(
      message,
      verdict.commandText ?? '',
      options.commandDeps ?? {},
    );
    await options.onCommand?.(message, verdict, commandResult);
    return { ...verdict, commandResult };
  }

  if (verdict.decision === 'escalate') {
    await options.onEscalate?.(message, verdict);
    return verdict;
  }

  if (verdict.decision === 'silent') {
    await options.onSilent?.(message, verdict);
    return verdict;
  }

  if (options.debouncer) {
    options.debouncer.enqueue(message, verdict);
  }

  return verdict;
}
