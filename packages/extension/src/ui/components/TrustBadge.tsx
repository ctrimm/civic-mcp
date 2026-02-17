import type { TrustLevel } from '@civic-mcp/sdk';

interface Props {
  level: TrustLevel;
}

const CONFIG: Record<TrustLevel, { label: string; color: string; bg: string }> = {
  official: { label: 'Official', color: '#065f46', bg: '#d1fae5' },
  verified: { label: 'Verified', color: '#1e40af', bg: '#dbeafe' },
  community: { label: 'Community', color: '#92400e', bg: '#fef3c7' },
};

export function TrustBadge({ level }: Props) {
  const { label, color, bg } = CONFIG[level];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: bg,
      }}
    >
      {label}
    </span>
  );
}
