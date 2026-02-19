/**
 * Type-safe wrapper around chrome.runtime.sendMessage for UI → background communication.
 */

import type { BackgroundMessage, BackgroundResponse } from '../../background/service-worker.js';
import type { InstalledPlugin } from '../../core/registry-client.js';
import type { RegistryIndex } from '@civic-mcp/sdk';

async function send<T>(message: BackgroundMessage): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as BackgroundResponse<T>;
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

export const api = {
  getInstalled: () => send<InstalledPlugin[]>({ type: 'GET_INSTALLED' }),
  getRegistry: () => send<RegistryIndex>({ type: 'GET_REGISTRY' }),
  install: (pluginId: string) => send<{ installed: boolean }>({ type: 'INSTALL_PLUGIN', pluginId }),
  uninstall: (pluginId: string) => send<{ uninstalled: boolean }>({ type: 'UNINSTALL_PLUGIN', pluginId }),
  setEnabled: (pluginId: string, enabled: boolean) =>
    send<{ enabled: boolean }>({ type: 'SET_PLUGIN_ENABLED', pluginId, enabled }),
  checkUpdates: () => send<unknown>({ type: 'CHECK_UPDATES' }),
  openMarketplace: () => send<object>({ type: 'OPEN_MARKETPLACE' }),
  openSettings: (pluginId?: string) => send<object>({ type: 'OPEN_SETTINGS', pluginId }),
};
