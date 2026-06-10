import React, { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../lib/messages.js';
import { TrustBadge } from '../components/TrustBadge.js';
import type { RegistryEntry } from '@civic-mcp/sdk';
import type { InstalledPlugin } from '../../core/registry-client.js';

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

type FilterCategory = 'all' | 'state_benefits' | 'federal' | 'local_government';

function Marketplace() {
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterCategory>('all');

  useEffect(() => {
    void Promise.all([api.getRegistry(), api.getInstalled()]).then(([reg, inst]) => {
      setRegistry(reg.plugins);
      setInstalled(new Set((inst as InstalledPlugin[]).map((p) => p.id)));
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return registry.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        (p.state?.toLowerCase() ?? '').includes(q);
      const matchesFilter = filter === 'all' || p.category === filter;
      return matchesSearch && matchesFilter;
    });
  }, [registry, search, filter]);

  async function handleInstall(id: string) {
    setInstalling((prev) => new Set([...prev, id]));
    try {
      await api.install(id);
      setInstalled((prev) => new Set([...prev, id]));
    } catch (err) {
      alert(`Installation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setInstalling((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>
          🏛️ Civic-MCP Marketplace
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>
          Install adapters so AI agents can help you navigate government services.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          type="search"
          placeholder="Search by state, program, or agency…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            outline: 'none',
          }}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterCategory)}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            background: '#fff',
          }}
        >
          <option value="all">All categories</option>
          <option value="state_benefits">State Benefits</option>
          <option value="federal">Federal</option>
          <option value="local_government">Local Government</option>
        </select>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Loading…</div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
          No adapters match your search.
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {filtered.map((entry) => (
          <PluginCard
            key={entry.id}
            entry={entry}
            isInstalled={installed.has(entry.id)}
            isInstalling={installing.has(entry.id)}
            onInstall={() => void handleInstall(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plugin card
// ---------------------------------------------------------------------------

interface CardProps {
  entry: RegistryEntry;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: () => void;
}

function PluginCard({ entry, isInstalled, isInstalling, onInstall }: CardProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{entry.name}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <TrustBadge level={entry.trustLevel} />
            {entry.state && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#374151',
                  background: '#f3f4f6',
                  padding: '1px 5px',
                  borderRadius: 4,
                }}
              >
                {entry.state}
              </span>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>{entry.description}</p>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {entry.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 11,
              background: '#eff6ff',
              color: '#1d4ed8',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>v{entry.latestVersion}</span>
        <button
          onClick={onInstall}
          disabled={isInstalled || isInstalling}
          style={{
            padding: '6px 16px',
            background: isInstalled ? '#d1fae5' : '#2563eb',
            color: isInstalled ? '#065f46' : '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: isInstalled ? 'default' : 'pointer',
            fontWeight: 600,
            fontSize: 13,
            opacity: isInstalling ? 0.7 : 1,
          }}
        >
          {isInstalled ? '✓ Installed' : isInstalling ? 'Installing…' : 'Install'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const root = createRoot(document.getElementById('root')!);
root.render(<Marketplace />);
