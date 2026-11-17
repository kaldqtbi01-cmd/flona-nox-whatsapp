import { config } from '../config.js';
import { logger } from '../logger.js';
import { sendOwnerAlert, type AlertChannels } from '../ops/alerts.js';

const log = logger.child({ component: 'send-ratelimit' });

export const DEFAULT_GLOBAL_PER_MINUTE = 20;
export const DEFAULT_PER_CHAT_PER_MINUTE = 6;
export const DEFAULT_DAILY_CAP = 200;
export const DEFAULT_DAILY_ALERT_RATIO = 0.8;
export const DEFAULT_QUIET_HOURS_START = 23;
export const DEFAULT_QUIET_HOURS_END = 7;
export const DEFAULT_OWNER_TIMEZONE = 'UTC';
export const DEFAULT_DELAY_MIN_MS = 2_000;
export const DEFAULT_DELAY_MAX_MS = 6_000;
export const DEFAULT_COOLDOWN_BASE_MS = 30_000;
export const DEFAULT_COOLDOWN_MAX_MS = 3_600_000;

export type SendBlockReason =
  'quiet_hours' | 'global_quota' | 'chat_quota' | 'daily_cap' | 'cooldown';

export type SendGateDecision =
  | { allowed: true }
  | { allowed: false; reason: SendBlockReason; retryAfterMs?: number; detail?: string };

export interface SendRateLimitConfig {
  /** Max auto-sends across all chats in a rolling 60s window. */
  globalPerMinute: number;
  /** Max auto-sends to a single chat in a rolling 60s window. */
  perChatPerMinute: number;
  /** Hard max auto-sends per owner-local calendar day. */
  dailyCap: number;
  /** Fraction of dailyCap that triggers a one-shot owner alert (default 0.8). */
  dailyAlertRatio: number;
  /** Quiet-hours start hour [0–23] in owner-local time (inclusive). */
  quietHoursStart: number;
  /** Quiet-hours end hour [0–23] in owner-local time (exclusive). */
  quietHoursEnd: number;
  /** IANA timezone for quiet hours + daily reset (e.g. `America/New_York`). */
  ownerTimeZone: string;
  delayMinMs: number;
  delayMaxMs: number;
  /** Base delay after a WhatsApp rate-limit error (doubles each consecutive hit). */
  cooldownBaseMs: number;
  cooldownMaxMs: number;
}

export interface SendRateLimiterDeps {
  config?: Partial<SendRateLimitConfig>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  alertChannels?: AlertChannels;
  onDailyCapAlert?: (usage: DailyUsage) => void | Promise<void>;
}

export interface DailyUsage {
  dayKey: string;
  count: number;
  cap: number;
  ratio: number;
}

export interface TypingPresence {
  sendTyping(chatJid: string, isTyping: boolean): Promise<void>;
}

/**
 * Detect WhatsApp / Baileys rate-limit style failures (HTTP 429, Boom, text cues).
 */
export function isWhatsAppRateLimitError(error: unknown): boolean {
  if (error == null) {
    return false;
  }

  let status = readStatusCode(error);
  if (status === undefined && typeof error === 'object' && 'status' in error) {
    const raw = (error as { status?: unknown }).status;
    status = typeof raw === 'number' ? raw : undefined;
  }

  if (status === 429) {
    return true;
  }

  let message = '';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'object' && 'message' in error) {
    const raw = (error as { message?: unknown }).message;
    message = typeof raw === 'string' ? raw : '';
  }

  return /rate[- ]?limit|too many|try again later|overlimit|429/i.test(message);
}

function readStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const boom = error as {
    output?: { statusCode?: unknown };
    statusCode?: unknown;
  };
  if (typeof boom.output?.statusCode === 'number') {
    return boom.output.statusCode;
  }
  if (typeof boom.statusCode === 'number') {
    return boom.statusCode;
  }
  return undefined;
}

/** Owner-local hour 0–23 via Intl (no extra timezone deps). */
export function getOwnerLocalHour(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  return Number.isFinite(hour) ? hour : now.getUTCHours();
}

/** Owner-local calendar day key `YYYY-MM-DD`. */
export function getOwnerLocalDayKey(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (year && month && day) {
    return `${year}-${month}-${day}`;
  }
  return now.toISOString().slice(0, 10);
}

/**
 * Quiet hours window. When start > end (e.g. 23→07), the window wraps midnight.
 */
export function isWithinQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) {
    return false;
  }
  if (start < end) {
    return hour >= start && hour < end;
  }
  return hour >= start || hour < end;
}

export function resolveSendRateLimitConfig(
  partial: Partial<SendRateLimitConfig> = {},
): SendRateLimitConfig {
  return {
    globalPerMinute: partial.globalPerMinute ?? DEFAULT_GLOBAL_PER_MINUTE,
    perChatPerMinute: partial.perChatPerMinute ?? DEFAULT_PER_CHAT_PER_MINUTE,
    dailyCap: partial.dailyCap ?? DEFAULT_DAILY_CAP,
    dailyAlertRatio: partial.dailyAlertRatio ?? DEFAULT_DAILY_ALERT_RATIO,
    quietHoursStart: partial.quietHoursStart ?? DEFAULT_QUIET_HOURS_START,
    quietHoursEnd: partial.quietHoursEnd ?? DEFAULT_QUIET_HOURS_END,
    ownerTimeZone: partial.ownerTimeZone ?? DEFAULT_OWNER_TIMEZONE,
    delayMinMs: partial.delayMinMs ?? DEFAULT_DELAY_MIN_MS,
    delayMaxMs: partial.delayMaxMs ?? DEFAULT_DELAY_MAX_MS,
    cooldownBaseMs: partial.cooldownBaseMs ?? DEFAULT_COOLDOWN_BASE_MS,
    cooldownMaxMs: partial.cooldownMaxMs ?? DEFAULT_COOLDOWN_MAX_MS,
  };
}

export function sendRateLimitConfigFromEnv(
  env: Pick<
    typeof config,
    | 'SEND_GLOBAL_PER_MINUTE'
    | 'SEND_PER_CHAT_PER_MINUTE'
    | 'SEND_DAILY_CAP'
    | 'SEND_DAILY_ALERT_RATIO'
    | 'QUIET_HOURS_START'
    | 'QUIET_HOURS_END'
    | 'OWNER_TIMEZONE'
    | 'SEND_DELAY_MIN_MS'
    | 'SEND_DELAY_MAX_MS'
    | 'SEND_RATE_LIMIT_COOLDOWN_BASE_MS'
    | 'SEND_RATE_LIMIT_COOLDOWN_MAX_MS'
  > = config,
): SendRateLimitConfig {
  return resolveSendRateLimitConfig({
    globalPerMinute: env.SEND_GLOBAL_PER_MINUTE,
    perChatPerMinute: env.SEND_PER_CHAT_PER_MINUTE,
    dailyCap: env.SEND_DAILY_CAP,
    dailyAlertRatio: env.SEND_DAILY_ALERT_RATIO,
    quietHoursStart: env.QUIET_HOURS_START,
    quietHoursEnd: env.QUIET_HOURS_END,
    ownerTimeZone: env.OWNER_TIMEZONE,
    delayMinMs: env.SEND_DELAY_MIN_MS,
    delayMaxMs: env.SEND_DELAY_MAX_MS,
    cooldownBaseMs: env.SEND_RATE_LIMIT_COOLDOWN_BASE_MS,
    cooldownMaxMs: env.SEND_RATE_LIMIT_COOLDOWN_MAX_MS,
  });
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Per-chat + global send quotas, quiet hours, humanized delays, WA rate-limit
 * cooldown, and a hard daily cap (owner alert at the configured ratio).
 *
 * Applies to **auto-sends** (approved outbox → recipient). Owner notifications
 * and ops alerts should bypass this gate.
 */
export class SendRateLimiter {
  readonly config: SendRateLimitConfig;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly alertChannels?: AlertChannels;
  private readonly onDailyCapAlert?: (usage: DailyUsage) => void | Promise<void>;

  private readonly globalSends: number[] = [];
  private readonly chatSends = new Map<string, number[]>();
  private dailyDayKey = '';
  private dailyCount = 0;
  private dailyAlertSentForDay = '';
  private cooldownUntil = 0;
  private consecutiveRateLimits = 0;

  constructor(deps: SendRateLimiterDeps = {}) {
    this.config = resolveSendRateLimitConfig(deps.config);
    this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? defaultSleep;
    this.random = deps.random ?? Math.random;
    this.alertChannels = deps.alertChannels;
    this.onDailyCapAlert = deps.onDailyCapAlert;
  }

  getDailyUsage(atMs = this.now()): DailyUsage {
    this.rollDailyWindow(atMs);
    const cap = this.config.dailyCap;
    const count = this.dailyCount;
    return {
      dayKey: this.dailyDayKey,
      count,
      cap,
      ratio: cap > 0 ? count / cap : 0,
    };
  }

  /** Current cooldown remaining (ms), or 0. */
  getCooldownRemainingMs(atMs = this.now()): number {
    return Math.max(0, this.cooldownUntil - atMs);
  }

  canSend(chatJid: string, atMs = this.now()): SendGateDecision {
    const cooldownLeft = this.getCooldownRemainingMs(atMs);
    if (cooldownLeft > 0) {
      return {
        allowed: false,
        reason: 'cooldown',
        retryAfterMs: cooldownLeft,
        detail: 'WhatsApp rate-limit cooldown active',
      };
    }

    const nowDate = new Date(atMs);
    const hour = getOwnerLocalHour(nowDate, this.config.ownerTimeZone);
    if (isWithinQuietHours(hour, this.config.quietHoursStart, this.config.quietHoursEnd)) {
      return {
        allowed: false,
        reason: 'quiet_hours',
        detail: `Quiet hours ${String(this.config.quietHoursStart).padStart(2, '0')}:00–${String(this.config.quietHoursEnd).padStart(2, '0')}:00 (${this.config.ownerTimeZone})`,
      };
    }

    this.rollDailyWindow(atMs);
    if (this.dailyCount >= this.config.dailyCap) {
      return {
        allowed: false,
        reason: 'daily_cap',
        detail: `Daily auto-send cap reached (${String(this.dailyCount)}/${String(this.config.dailyCap)})`,
      };
    }

    this.pruneWindow(this.globalSends, atMs);
    if (this.globalSends.length >= this.config.globalPerMinute) {
      const oldest = this.globalSends[0] ?? atMs;
      return {
        allowed: false,
        reason: 'global_quota',
        retryAfterMs: Math.max(1, 60_000 - (atMs - oldest)),
        detail: `Global quota ${String(this.config.globalPerMinute)}/min`,
      };
    }

    const chatWindow = this.chatSends.get(chatJid) ?? [];
    this.pruneWindow(chatWindow, atMs);
    if (chatWindow.length >= this.config.perChatPerMinute) {
      const oldest = chatWindow[0] ?? atMs;
      return {
        allowed: false,
        reason: 'chat_quota',
        retryAfterMs: Math.max(1, 60_000 - (atMs - oldest)),
        detail: `Per-chat quota ${String(this.config.perChatPerMinute)}/min`,
      };
    }

    return { allowed: true };
  }

  /**
   * Humanized pre-send: random delay in [delayMin, delayMax] with typing indicators.
   * Call only after {@link canSend} allows the send.
   */
  async prepareSend(chatJid: string, presence?: TypingPresence): Promise<{ delayMs: number }> {
    const min = Math.min(this.config.delayMinMs, this.config.delayMaxMs);
    const max = Math.max(this.config.delayMinMs, this.config.delayMaxMs);
    const delayMs = Math.round(min + this.random() * (max - min));

    if (presence) {
      try {
        await presence.sendTyping(chatJid, true);
      } catch (error) {
        log.debug({ err: error, chatJid }, 'Failed to start typing indicator');
      }
    }

    try {
      await this.sleep(delayMs);
    } finally {
      if (presence) {
        try {
          await presence.sendTyping(chatJid, false);
        } catch (error) {
          log.debug({ err: error, chatJid }, 'Failed to clear typing indicator');
        }
      }
    }

    return { delayMs };
  }

  /**
   * Record a successful auto-send and emit the 80% daily-cap alert once per day.
   */
  async recordSend(chatJid: string, atMs = this.now()): Promise<DailyUsage> {
    this.rollDailyWindow(atMs);
    this.globalSends.push(atMs);
    const chatWindow = this.chatSends.get(chatJid) ?? [];
    chatWindow.push(atMs);
    this.chatSends.set(chatJid, chatWindow);
    this.dailyCount += 1;
    this.consecutiveRateLimits = 0;

    const usage = this.getDailyUsage(atMs);
    await this.maybeAlertDailyCap(usage);
    return usage;
  }

  /**
   * Enter / extend exponential cooldown after WhatsApp signals a rate limit.
   */
  recordRateLimitError(atMs = this.now()): { cooldownMs: number; until: number } {
    this.consecutiveRateLimits += 1;
    const exponent = Math.max(0, this.consecutiveRateLimits - 1);
    const cooldownMs = Math.min(
      this.config.cooldownMaxMs,
      this.config.cooldownBaseMs * 2 ** exponent,
    );
    this.cooldownUntil = atMs + cooldownMs;
    log.warn(
      {
        consecutiveRateLimits: this.consecutiveRateLimits,
        cooldownMs,
        until: new Date(this.cooldownUntil).toISOString(),
      },
      'Entered send cooldown after WhatsApp rate-limit error',
    );
    return { cooldownMs, until: this.cooldownUntil };
  }

  private async maybeAlertDailyCap(usage: DailyUsage): Promise<void> {
    const threshold = this.config.dailyAlertRatio;
    if (usage.cap <= 0 || usage.ratio < threshold) {
      return;
    }
    if (this.dailyAlertSentForDay === usage.dayKey) {
      return;
    }
    this.dailyAlertSentForDay = usage.dayKey;

    const pct = Math.round(usage.ratio * 100);
    const message = `Auto-send daily volume at ${String(pct)}% of cap (${String(usage.count)}/${String(usage.cap)}) for ${usage.dayKey} (${this.config.ownerTimeZone}).`;

    log.error(
      {
        alertCode: 'send_daily_cap_80',
        severity: 'warn',
        details: { ...usage, alertRatio: threshold },
      },
      message,
    );

    if (this.onDailyCapAlert) {
      await this.onDailyCapAlert(usage);
      return;
    }

    await sendOwnerAlert(
      {
        severity: 'warn',
        code: 'send_daily_cap_80',
        message,
        details: { ...usage, alertRatio: threshold },
      },
      this.alertChannels ?? {},
    );
  }

  private rollDailyWindow(atMs: number): void {
    const dayKey = getOwnerLocalDayKey(new Date(atMs), this.config.ownerTimeZone);
    if (dayKey !== this.dailyDayKey) {
      this.dailyDayKey = dayKey;
      this.dailyCount = 0;
    }
  }

  private pruneWindow(timestamps: number[], atMs: number): void {
    const cutoff = atMs - 60_000;
    while (timestamps.length > 0 && (timestamps[0] ?? 0) <= cutoff) {
      timestamps.shift();
    }
  }
}

let sharedLimiter: SendRateLimiter | undefined;

/** Process-wide limiter used by the outbox auto-sender. */
export function getSharedSendRateLimiter(deps: SendRateLimiterDeps = {}): SendRateLimiter {
  sharedLimiter ??= new SendRateLimiter({
    ...deps,
    config: { ...sendRateLimitConfigFromEnv(), ...deps.config },
  });
  return sharedLimiter;
}

/** Test helper — drop the process singleton. */
export function resetSharedSendRateLimiter(): void {
  sharedLimiter = undefined;
}
