#!/usr/bin/env node
/**
 * scripts/update-registry.js
 *
 * Scans all adapters in adapters/ and regenerates registry/registry.json
 * with current metadata from each adapter's manifest.json.
 *
 * Usage: npm run registry:update
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ADAPTERS_DIR = path.join(ROOT, 'adapters');
const REGISTRY_FILE = path.join(ROOT, 'registry', 'registry.json');

const CATEGORY_NAMES = {
  state_benefits: 'State Benefits Programs',
  federal: 'Federal Services',
  local_government: 'Local Government',
  healthcare: 'Healthcare',
  housing: 'Housing',
  employment: 'Employment',
  education: 'Education',
};

function main() {
  if (!fs.existsSync(ADAPTERS_DIR)) {
    console.log('No adapters/ directory found. Creating empty registry.');
    writeRegistry([]);
    return;
  }

  const adapterDirs = fs
    .readdirSync(ADAPTERS_DIR)
    .filter((name) => fs.statSync(path.join(ADAPTERS_DIR, name)).isDirectory());

  const plugins = [];

  for (const dir of adapterDirs) {
    const manifestPath = path.join(ADAPTERS_DIR, dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      console.warn(`  SKIP ${dir} — no manifest.json`);
      continue;
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      console.error(`  ERROR ${dir} — invalid JSON: ${err.message}`);
      continue;
    }

    const entry = buildRegistryEntry(manifest);
    plugins.push(entry);
    console.log(`  OK   ${manifest.id}@${manifest.version}`);
  }

  writeRegistry(plugins);
  console.log(`\nRegistry updated: ${plugins.length} plugin(s) written to registry/registry.json`);
}

function buildRegistryEntry(manifest) {
  const existing = loadExistingEntry(manifest.id);

  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    latestVersion: manifest.version,
    category: manifest.category || 'state_benefits',
    tags: manifest.tags || [],
    trustLevel: manifest.trustLevel || 'community',
    verified: manifest.verified || false,
    downloadUrl:
      existing?.downloadUrl ||
      `https://github.com/civic-mcp/plugin-registry/releases/download/${manifest.id}-${manifest.version}/plugin.zip`,
    manifestUrl: `https://raw.githubusercontent.com/civic-mcp/civic-mcp/main/adapters/${manifest.id}/manifest.json`,
    updatedAt: new Date().toISOString(),
    installs: existing?.installs || 0,
    rating: existing?.rating || 0,
    ...(manifest.state ? { state: manifest.state } : {}),
    ...(manifest.agency ? { agency: manifest.agency } : {}),
  };
}

function loadExistingEntry(id) {
  if (!fs.existsSync(REGISTRY_FILE)) return null;
  try {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    return registry.plugins?.find((p) => p.id === id) || null;
  } catch {
    return null;
  }
}

function writeRegistry(plugins) {
  // Tally categories
  const categoryCounts = {};
  for (const p of plugins) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  }

  const categories = Object.entries(CATEGORY_NAMES).map(([id, name]) => ({
    id,
    name,
    count: categoryCounts[id] || 0,
  }));

  const registry = {
    version: '1.0',
    updatedAt: new Date().toISOString(),
    plugins,
    categories,
  };

  fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2) + '\n');
}

main();
