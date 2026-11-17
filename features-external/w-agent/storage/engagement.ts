import { getSetting, setSetting } from './settings.js';
import { query } from './db.js';

export const ENGAGEMENT_SETTINGS_KEY = 'engagement';

export type ChatEngagementMode = 'default' | 'opt_in' | 'opt_out';

/** Global agent engagement mode controlled by `/agent mode`. */
export type AgentMode = 'off' | 'trusted' | 'on';

/**
 * Global engagement policy stored in `settings.engagement`.
 */
export interface EngagementSettings {
  /** Master switch — when false, never auto-reply. */
  enabled: boolean;
  /**
   * Engagement posture:
   * - `off` — no auto-replies (owner commands still work)
   * - `trusted` — allowlisted / opted-in chats only (default)
   * - `on` — also allow unknown 1:1 numbers
   */
  agentMode: AgentMode;
  /** Owner command prefix that forces an agent turn in any chat. */
  commandPrefix: string;
  /** Batch rapid-fire messages from the same chat (ms). */
  debounceMs: number;
  /** When false (default), unknown 1:1 numbers never get a reply. */
  allowUnknownNumbers: boolean;
  /** Escalate (notify owner) instead of silent for unknown 1:1 numbers. */
  escalateUnknownNumbers: boolean;
  /** Escalate when the owner is @-mentioned in a non-allowlisted group. */
  escalateNonAllowlistedGroupMentions: boolean;
  /** Allowlisted 1:1 contact JIDs or bare phone numbers. */
  allowlistedContacts: string[];
  /** Allowlisted group JIDs. */
  allowlistedGroups: string[];
  /** Owner JIDs used for command / mention detection (optional extras beyond fromMe). */
  ownerJids: string[];
}

export const DEFAULT_ENGAGEMENT_SETTINGS: EngagementSettings = {
  enabled: true,
  agentMode: 'trusted',
  commandPrefix: '/agent',
  debounceMs: 8_000,
  allowUnknownNumbers: false,
  escalateUnknownNumbers: false,
  escalateNonAllowlistedGroupMentions: true,
  allowlistedContacts: [],
  allowlistedGroups: [],
  ownerJids: [],
};

function normalizeAgentMode(value: unknown): AgentMode {
  if (value === 'off' || value === 'trusted' || value === 'on') {
    return value;
  }
  return DEFAULT_ENGAGEMENT_SETTINGS.agentMode;
}

/**
 * Load engagement settings, merging with defaults.
 */
export async function getEngagementSettings(): Promise<EngagementSettings> {
  const stored = await getSetting<Partial<EngagementSettings>>(ENGAGEMENT_SETTINGS_KEY);
  return normalizeEngagementSettings(stored);
}

/**
 * Replace engagement settings (merged onto defaults).
 */
export async function setEngagementSettings(
  patch: Partial<EngagementSettings>,
): Promise<EngagementSettings> {
  const next = normalizeEngagementSettings({
    ...(await getEngagementSettings()),
    ...patch,
  });
  await setSetting(ENGAGEMENT_SETTINGS_KEY, next);
  return next;
}

export function normalizeEngagementSettings(
  stored: Partial<EngagementSettings> | null | undefined,
): EngagementSettings {
  const s = stored ?? {};
  const commandPrefixRaw = s.commandPrefix ?? DEFAULT_ENGAGEMENT_SETTINGS.commandPrefix;
  const debounceRaw = s.debounceMs ?? DEFAULT_ENGAGEMENT_SETTINGS.debounceMs;

  const agentMode = normalizeAgentMode(s.agentMode);
  const allowUnknownDefault =
    agentMode === 'on'
      ? true
      : (s.allowUnknownNumbers ?? DEFAULT_ENGAGEMENT_SETTINGS.allowUnknownNumbers);

  return {
    enabled: agentMode === 'off' ? false : (s.enabled ?? DEFAULT_ENGAGEMENT_SETTINGS.enabled),
    agentMode,
    commandPrefix: (
      commandPrefixRaw.trim() || DEFAULT_ENGAGEMENT_SETTINGS.commandPrefix
    ).toLowerCase(),
    debounceMs: Math.max(0, debounceRaw),
    allowUnknownNumbers: agentMode === 'off' ? false : allowUnknownDefault,
    escalateUnknownNumbers:
      s.escalateUnknownNumbers ?? DEFAULT_ENGAGEMENT_SETTINGS.escalateUnknownNumbers,
    escalateNonAllowlistedGroupMentions:
      s.escalateNonAllowlistedGroupMentions ??
      DEFAULT_ENGAGEMENT_SETTINGS.escalateNonAllowlistedGroupMentions,
    allowlistedContacts: uniqueNormalizedIds(
      s.allowlistedContacts ?? DEFAULT_ENGAGEMENT_SETTINGS.allowlistedContacts,
    ),
    allowlistedGroups: uniqueNormalizedIds(
      s.allowlistedGroups ?? DEFAULT_ENGAGEMENT_SETTINGS.allowlistedGroups,
    ),
    ownerJids: uniqueNormalizedIds(s.ownerJids ?? DEFAULT_ENGAGEMENT_SETTINGS.ownerJids),
  };
}

/**
 * Normalize WhatsApp JID / phone for allowlist comparisons.
 */
export function normalizeWhatsAppId(id: string): string {
  const trimmed = id.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  const bare = trimmed.split(':')[0] ?? trimmed;
  if (bare.includes('@')) {
    return bare;
  }
  return bare.replace(/\D/g, '');
}

function uniqueNormalizedIds(ids: string[]): string[] {
  return [...new Set(ids.map(normalizeWhatsAppId).filter(Boolean))];
}

export function idsMatch(a: string, b: string): boolean {
  const na = normalizeWhatsAppId(a);
  const nb = normalizeWhatsAppId(b);
  if (!na || !nb) {
    return false;
  }
  if (na === nb) {
    return true;
  }
  const phoneA = na.split('@')[0] ?? na;
  const phoneB = nb.split('@')[0] ?? nb;
  return phoneA === phoneB;
}

export function isIdAllowlisted(id: string, allowlist: string[]): boolean {
  return allowlist.some((entry) => idsMatch(id, entry));
}

/**
 * Read per-chat engagement mode (`default` when unset).
 */
export async function getChatEngagementMode(chatJid: string): Promise<ChatEngagementMode> {
  const result = await query<{ mode: ChatEngagementMode }>(
    `SELECT mode FROM chat_engagement WHERE chat_jid = $1`,
    [chatJid],
  );
  return result.rows[0]?.mode ?? 'default';
}

/**
 * Persist per-chat opt-in / opt-out / default.
 */
export async function setChatEngagementMode(
  chatJid: string,
  mode: ChatEngagementMode,
): Promise<void> {
  if (mode === 'default') {
    await query(`DELETE FROM chat_engagement WHERE chat_jid = $1`, [chatJid]);
    return;
  }

  await query(
    `
      INSERT INTO chat_engagement (chat_jid, mode, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (chat_jid) DO UPDATE SET
        mode = EXCLUDED.mode,
        updated_at = NOW()
    `,
    [chatJid, mode],
  );
}
