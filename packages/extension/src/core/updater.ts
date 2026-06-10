/**
 * Updater — checks for new plugin versions and notifies the user.
 * Runs in the background service worker.
 */

import { checkForUpdates, type UpdateInfo } from './registry-client.js';

const STORAGE_KEY_LAST_CHECK = 'civic-mcp:last-update-check';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function runUpdateCheck(): Promise<UpdateInfo[]> {
  const updates = await checkForUpdates();

  if (updates.length > 0) {
    // Set extension badge to show pending updates
    chrome.action.setBadgeText({ text: String(updates.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }

  await chrome.storage.local.set({ [STORAGE_KEY_LAST_CHECK]: new Date().toISOString() });
  return updates;
}

export async function shouldRunCheck(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEY_LAST_CHECK);
  const lastCheck = result[STORAGE_KEY_LAST_CHECK] as string | undefined;
  if (!lastCheck) return true;

  const age = Date.now() - new Date(lastCheck).getTime();
  return age >= CHECK_INTERVAL_MS;
}
