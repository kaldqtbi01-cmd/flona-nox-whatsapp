import { getSetting, setSetting } from './settings.js';
import { getChatEngagementMode, setChatEngagementMode } from './engagement.js';

export const CHAT_PREFS_SETTINGS_KEY = 'chat_prefs';

export interface ChatPrefs {
  /** When true, new drafts are auto-approved for sending (skip approval queue). */
  autoSend: boolean;
}

export interface ChatSettingsView {
  muted: boolean;
  autoSend: boolean;
  engagementMode: 'default' | 'opt_in' | 'opt_out';
}

type ChatPrefsMap = Record<string, Partial<ChatPrefs>>;

async function loadPrefsMap(): Promise<ChatPrefsMap> {
  return (await getSetting<ChatPrefsMap>(CHAT_PREFS_SETTINGS_KEY)) ?? {};
}

export async function getChatPrefs(chatJid: string): Promise<ChatPrefs> {
  const map = await loadPrefsMap();
  const entry = map[chatJid] ?? {};
  return {
    autoSend: entry.autoSend === true,
  };
}

export async function setChatPrefs(chatJid: string, patch: Partial<ChatPrefs>): Promise<ChatPrefs> {
  const map = await loadPrefsMap();
  const next: ChatPrefs = {
    ...(await getChatPrefs(chatJid)),
    ...patch,
  };
  map[chatJid] = next;
  await setSetting(CHAT_PREFS_SETTINGS_KEY, map);
  return next;
}

/**
 * Combined mute (opt_out) + auto-send prefs for the dashboard.
 */
export async function getChatSettings(chatJid: string): Promise<ChatSettingsView> {
  const [mode, prefs] = await Promise.all([getChatEngagementMode(chatJid), getChatPrefs(chatJid)]);
  return {
    muted: mode === 'opt_out',
    autoSend: prefs.autoSend,
    engagementMode: mode,
  };
}

export async function updateChatSettings(
  chatJid: string,
  patch: { muted?: boolean; autoSend?: boolean },
): Promise<ChatSettingsView> {
  if (patch.muted !== undefined) {
    await setChatEngagementMode(chatJid, patch.muted ? 'opt_out' : 'default');
  }
  if (patch.autoSend !== undefined) {
    await setChatPrefs(chatJid, { autoSend: patch.autoSend });
  }
  return getChatSettings(chatJid);
}
