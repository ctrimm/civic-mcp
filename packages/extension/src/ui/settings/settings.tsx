import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../lib/messages.js';
import { TrustBadge } from '../components/TrustBadge.js';
import type { InstalledPlugin } from '../../core/registry-client.js';

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

function Settings() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read ?plugin= from query string
    const params = new URLSearchParams(window.location.search);
    const pluginParam = params.get('plugin');

    void api.getInstalled().then((installed) => {
      setPlugins(installed as InstalledPlugin[]);
      if (pluginParam) setSelected(pluginParam);
      else if ((installed as InstalledPlugin[]).length > 0)
        setSelected((installed as InstalledPlugin[])[0]!.id);
      setLoading(false);
    });
  }, []);

  const current = plugins.find((p) => p.id === selected) ?? null;

  async function togglePlugin(id: string, enabled: boolean) {
    await api.setEnabled(id, enabled);
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)));
  }

  async function removePlugin(id: string) {
    if (!confirm('Remove this adapter? This cannot be undone.')) return;
    await api.uninstall(id);
    setPlugins((prev) => {
      const next = prev.filter((p) => p.id !== id);
      setSelected(next[0]?.id ?? null);
      return next;
    });
  }

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>Loading…</div>;
  }

  return (
    <div style={{ display: 'flex', maxWidth: 800, margin: '0 auto', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          background: '#fff',
          borderRight: '1px solid #e5e7eb',
          padding: '16px 0',
        }}
      >
        <div style={{ padding: '0 16px 12px', fontWeight: 700, fontSize: 13, color: '#1d4ed8' }}>
          Civic-MCP Settings
        </div>
        {plugins.length === 0 && (
          <div style={{ padding: '0 16px', color: '#9ca3af', fontSize: 13 }}>
            No adapters installed.
          </div>
        )}
        {plugins.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 16px',
              background: selected === p.id ? '#eff6ff' : 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: selected === p.id ? 600 : 400,
              color: selected === p.id ? '#1d4ed8' : '#374151',
              borderLeft: selected === p.id ? '3px solid #2563eb' : '3px solid transparent',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: p.enabled ? '#22c55e' : '#d1d5db',
                marginRight: 6,
              }}
            />
            {p.manifest.name}
          </button>
        ))}
      </aside>

      {/* Detail panel */}
      <main style={{ flex: 1, padding: 24 }}>
        {current ? <PluginDetail plugin={current} onToggle={togglePlugin} onRemove={removePlugin} /> : (
          <div style={{ color: '#9ca3af', padding: 24 }}>Select an adapter from the left.</div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plugin detail panel
// ---------------------------------------------------------------------------

interface DetailProps {
  plugin: InstalledPlugin;
  onToggle: (id: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
}

function PluginDetail({ plugin, onToggle, onRemove }: DetailProps) {
  const { manifest } = plugin;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{manifest.name}</h2>
          <TrustBadge level={manifest.trustLevel} />
        </div>
        <p style={{ color: '#6b7280', fontSize: 13 }}>{manifest.description}</p>
        <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
          v{plugin.version} · Installed {new Date(plugin.installedAt).toLocaleDateString()}
        </p>
      </div>

      {/* Enable / disable */}
      <Section title="Status">
        <Toggle
          label={plugin.enabled ? 'Adapter enabled' : 'Adapter disabled'}
          checked={plugin.enabled}
          onChange={(v) => onToggle(plugin.id, v)}
        />
      </Section>

      {/* Tools */}
      <Section title="Tools">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {manifest.tools.map((tool) => (
            <div
              key={tool.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 10px',
                background: '#f9fafb',
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{tool.name}</span>
              <span
                style={{
                  fontSize: 11,
                  color: tool.securityLevel === 'read_only' ? '#059669' : '#d97706',
                  fontWeight: 600,
                }}
              >
                {tool.securityLevel === 'read_only' ? 'read-only' : 'write'}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Permissions */}
      <Section title="Permissions">
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {manifest.permissions.required.map((perm) => (
            <li key={perm} style={{ fontSize: 13, color: '#374151' }}>
              ✓ {formatPermission(perm)}
            </li>
          ))}
          {(manifest.permissions.optional ?? []).map((perm) => (
            <li key={perm} style={{ fontSize: 13, color: '#9ca3af' }}>
              ○ {formatPermission(perm)} (optional)
            </li>
          ))}
        </ul>
      </Section>

      {/* Domains */}
      <Section title="Allowed Domains">
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {manifest.domains.map((d) => (
            <li key={d} style={{ fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>
              {d}
            </li>
          ))}
        </ul>
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone">
        <button
          onClick={() => onRemove(plugin.id)}
          style={{
            padding: '7px 16px',
            background: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Remove Adapter
        </button>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#6b7280',
          marginBottom: 10,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: '#2563eb', width: 16, height: 16 }}
      />
      {label}
    </label>
  );
}

function formatPermission(perm: string): string {
  const map: Record<string, string> = {
    'read:forms': 'Read form data',
    'write:forms': 'Fill form fields',
    'storage:local': 'Local storage for preferences',
    notifications: 'Show notifications',
    navigate: 'Navigate to allowed pages',
  };
  return map[perm] ?? perm;
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const root = createRoot(document.getElementById('root')!);
root.render(<Settings />);
