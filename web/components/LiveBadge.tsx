export function LiveBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '8px 14px',
      background: 'rgba(220,38,38,0.16)',
      border: '1px solid rgba(220,38,38,0.4)',
      borderRadius: 999,
      fontFamily: 'var(--font-display)',
      fontWeight: 800, fontSize: 12,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      color: '#FCA5A5',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 999,
        background: '#DC2626',
        animation: 'pitchPulse 1.6s infinite',
        display: 'inline-block',
      }} />
      Live
    </span>
  )
}
