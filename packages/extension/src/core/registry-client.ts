/**
 * Registry client — fetches the plugin registry and manages
 * the list of installed plugins in chrome.storage.local.
 */

import type { RegistryIndex, RegistryEntry } from '@civic-mcp/sdk';
import type { AdapterManifest } from '@civic-mcp/sdk';

// The registry JSON is bundled with the extension and also optionally
// fetched from the remote source for updates.
import BUNDLED_REGISTRY from '../../../../registry/registry.json';

const STORAGE_KEY_INSTALLED = 'civic-mcp:installed-plugins';
const STORAGE_KEY_REGISTRY_CACHE = 'civic-mcp:registry-cache';
const REGISTRY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface InstalledPlugin {
  id: string;
  version: string;
  enabled: boolean;
  manifest: AdapterManifest;
  /** JS adapter source code, if applicable */
  code?: string;
  installedAt: string; // ISO 8601
  updatedAt: string;
}

export interface RegistryCache {
  data: RegistryIndex;
  fetchedAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Registry fetching
// ---------------------------------------------------------------------------

export async function fetchRegistry(): Promise<RegistryIndex> {
  // Try cache first
  const cached = await getCachedRegistry();
  if (cached) return cached;

  // Fall back to bundled registry
  return BUNDLED_REGISTRY as unknown as RegistryIndex;
}

async function getCachedRegistry(): Promise<RegistryIndex | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_REGISTRY_CACHE);
    const cache = result[STORAGE_KEY_REGISTRY_CACHE] as RegistryCache | undefined;
    if (!cache) return null;

    const age = Date.now() - new Date(cache.fetchedAt).getTime();
    if (age > REGISTRY_TTL_MS) return null;

    return cache.data;
  } catch {
    return null;
  }
}

export async function refreshRegistry(): Promise<RegistryIndex> {
  // In production this would fetch from the GitHub raw URL.
  // For MVP, return the bundled registry.
  const registry = BUNDLED_REGISTRY as unknown as RegistryIndex;
  const cache: RegistryCache = { data: registry, fetchedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [STORAGE_KEY_REGISTRY_CACHE]: cache });
  return registry;
}

// ---------------------------------------------------------------------------
// Installed plugin management
// ---------------------------------------------------------------------------

async function getInstalledMap(): Promise<Record<string, InstalledPlugin>> {
  const result = await chrome.storage.local.get(STORAGE_KEY_INSTALLED);
  return (result[STORAGE_KEY_INSTALLED] as Record<string, InstalledPlugin>) ?? {};
}

async function saveInstalledMap(map: Record<string, InstalledPlugin>): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_INSTALLED]: map });
}

export async function getInstalledPlugins(): Promise<InstalledPlugin[]> {
  const map = await getInstalledMap();
  return Object.values(map);
}

export async function getInstalledPlugin(id: string): Promise<InstalledPlugin | null> {
  const map = await getInstalledMap();
  return map[id] ?? null;
}

export async function isPluginInstalled(id: string): Promise<boolean> {
  const map = await getInstalledMap();
  return id in map;
}

export async function isPluginEnabled(id: string): Promise<boolean> {
  const plugin = await getInstalledPlugin(id);
  return plugin?.enabled ?? false;
}

export async function installPlugin(
  entry: RegistryEntry,
  manifest: AdapterManifest,
  code?: string,
): Promise<void> {
  const map = await getInstalledMap();
  const now = new Date().toISOString();
  map[manifest.id] = {
    id: manifest.id,
    version: manifest.version,
    enabled: true,
    manifest,
    code,
    installedAt: map[manifest.id]?.installedAt ?? now,
    updatedAt: now,
  };
  await saveInstalledMap(map);
}

export async function uninstallPlugin(id: string): Promise<void> {
  const map = await getInstalledMap();
  delete map[id];
  await saveInstalledMap(map);

  // Also clean up plugin-scoped storage
  const storageKeys = await getPluginStorageKeys(id);
  if (storageKeys.length > 0) {
    await chrome.storage.local.remove(storageKeys);
  }
}

export async function setPluginEnabled(id: string, enabled: boolean): Promise<void> {
  const map = await getInstalledMap();
  if (map[id]) {
    map[id] = { ...map[id]!, enabled };
    await saveInstalledMap(map);
  }
}

async function getPluginStorageKeys(pluginId: string): Promise<string[]> {
  const all = await chrome.storage.local.get(null);
  const prefix = `civic-mcp:plugin:${pluginId}:`;
  return Object.keys(all).filter((k) => k.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Update checking
// ---------------------------------------------------------------------------

export interface UpdateInfo {
  id: string;
  currentVersion: string;
  latestVersion: string;
}

export async function checkForUpdates(): Promise<UpdateInfo[]> {
  const [installed, registry] = await Promise.all([getInstalledPlugins(), fetchRegistry()]);
  const updates: UpdateInfo[] = [];

  for (const plugin of installed) {
    const entry = registry.plugins.find((p) => p.id === plugin.id);
    if (!entry) continue;
    if (entry.latestVersion !== plugin.version) {
      updates.push({
        id: plugin.id,
        currentVersion: plugin.version,
        latestVersion: entry.latestVersion,
      });
    }
  }

  return updates;
}
