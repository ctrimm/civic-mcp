/**
 * Background service worker — handles install/uninstall messages from the UI
 * and runs periodic update checks.
 */

import {
  installPlugin,
  uninstallPlugin,
  setPluginEnabled,
  getInstalledPlugins,
  fetchRegistry,
} from '../core/registry-client.js';
import { runUpdateCheck, shouldRunCheck } from '../core/updater.js';

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export type BackgroundMessage =
  | { type: 'GET_INSTALLED' }
  | { type: 'GET_REGISTRY' }
  | { type: 'INSTALL_PLUGIN'; pluginId: string }
  | { type: 'UNINSTALL_PLUGIN'; pluginId: string }
  | { type: 'SET_PLUGIN_ENABLED'; pluginId: string; enabled: boolean }
  | { type: 'CHECK_UPDATES' }
  | { type: 'OPEN_MARKETPLACE' }
  | { type: 'OPEN_SETTINGS'; pluginId?: string };

export type BackgroundResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: BackgroundResponse) => void,
  ) => {
    handleMessage(message)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );

    // Return true to indicate async response
    return true;
  },
);

async function handleMessage(msg: BackgroundMessage): Promise<unknown> {
  switch (msg.type) {
    case 'GET_INSTALLED':
      return getInstalledPlugins();

    case 'GET_REGISTRY':
      return fetchRegistry();

    case 'INSTALL_PLUGIN': {
      const registry = await fetchRegistry();
      const entry = registry.plugins.find((p) => p.id === msg.pluginId);
      if (!entry) throw new Error(`Plugin "${msg.pluginId}" not found in registry`);

      // For MVP, fetch the manifest from the bundled registry entry URL.
      // Full implementation would download and verify the zip.
      const manifestRes = await fetch(entry.manifestUrl);
      if (!manifestRes.ok) throw new Error(`Failed to fetch manifest for "${msg.pluginId}"`);
      const manifest = await manifestRes.json();

      await installPlugin(entry, manifest);
      return { installed: true };
    }

    case 'UNINSTALL_PLUGIN':
      await uninstallPlugin(msg.pluginId);
      return { uninstalled: true };

    case 'SET_PLUGIN_ENABLED':
      await setPluginEnabled(msg.pluginId, msg.enabled);
      return { enabled: msg.enabled };

    case 'CHECK_UPDATES':
      return runUpdateCheck();

    case 'OPEN_MARKETPLACE':
      await chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/marketplace/index.html') });
      return {};

    case 'OPEN_SETTINGS':
      await chrome.tabs.create({
        url:
          chrome.runtime.getURL('src/ui/settings/index.html') +
          (msg.pluginId ? `?plugin=${encodeURIComponent(msg.pluginId)}` : ''),
      });
      return {};

    default:
      throw new Error(`Unknown message type: ${(msg as { type: string }).type}`);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    // Open the marketplace on first install
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/marketplace/index.html') });
  }

  // Run an initial update check
  await runUpdateCheck();
});

chrome.runtime.onStartup.addListener(async () => {
  if (await shouldRunCheck()) {
    await runUpdateCheck();
  }
});
