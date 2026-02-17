import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../lib/messages.js';
import { TrustBadge } from '../components/TrustBadge.js';
import type { InstalledPlugin } from '../../core/registry-client.js';

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

function Popup() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const installed = await api.getInstalled();
      setPlugins(installed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggleEnabled(id: string, enabled: boolean) {
    await api.setEnabled(id, enabled);
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)));
  }

  async function remove(id: string) {
    await api.uninstall(id);
    setPlugins((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header />
      <main style={{ flex: 1, padding: '8px 0' }}>
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && plugins.length === 0 && <EmptyState />}
        {!loading && !error && plugins.map((p) => (
          <PluginRow
            key={p.id}
            plugin={p}
            onToggle={(enabled) => void toggleEnabled(p.id, enabled)}
            onRemove={() => void remove(p.id)}
            onSettings={() => void api.openSettings(p.id)}
          />
        ))}
      </main>
      <footer style={{ borderTop: '1px solid #e5e7eb', padding: '8px 12px' }}>
        <button
          onClick={() => void api.openMarketplace()}
          style={{
            width: '100%',
            padding: '6px 0',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          + Browse Marketplace
        </button>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Header() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderBottom: '1px solid #e5e7eb',
        background: '#1d4ed8',
        color: '#fff',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 15 }}>Civic-MCP</span>
      <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 'auto' }}>AI for Gov Services</span>
    </header>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#6b7280' }}>
      Loading plugins…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{ padding: '12px', color: '#dc2626', fontSize: 13 }}>
      Error: {message}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#6b7280' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🏛️</div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>No adapters installed</div>
      <div style={{ fontSize: 12 }}>Browse the marketplace to find adapters for your state.</div>
    </div>
  );
}

interface PluginRowProps {
  plugin: InstalledPlugin;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
  onSettings: () => void;
}

function PluginRow({ plugin, onToggle, onRemove, onSettings }: PluginRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid #f3f4f6',
        opacity: plugin.enabled ? 1 : 0.55,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: plugin.enabled ? '#22c55e' : '#d1d5db',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {plugin.manifest.name}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
          <TrustBadge level={plugin.manifest.trustLevel} />
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            {plugin.manifest.tools.length} tool{plugin.manifest.tools.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>v{plugin.version}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <IconButton title={plugin.enabled ? 'Disable' : 'Enable'} onClick={() => onToggle(!plugin.enabled)}>
          {plugin.enabled ? '⏸' : '▶️'}
        </IconButton>
        <IconButton title="Settings" onClick={onSettings}>⚙️</IconButton>
        <IconButton title="Remove" onClick={onRemove}>🗑️</IconButton>
      </div>
    </div>
  );
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px 4px',
        fontSize: 14,
        borderRadius: 4,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
