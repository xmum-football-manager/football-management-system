export function LiveBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const isSm = size === 'sm'
  
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', 
      gap: isSm ? 6 : 8,
      padding: isSm ? '4px 10px' : '6px 14px',
      background: 'rgba(163,230,53,0.1)',
      border: '1px solid rgba(163,230,53,0.2)',
      borderRadius: 999,
      fontFamily: 'var(--font-display)',
      fontWeight: 800, 
      fontSize: isSm ? 10 : 12,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'var(--brand-lime)',
    }}>
      <style>{`
        @keyframes liveBadgePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      <span style={{
        width: isSm ? 6 : 8, 
        height: isSm ? 6 : 8, 
        borderRadius: 999,
        background: 'var(--brand-lime)',
        animation: 'liveBadgePulse 1.5s infinite ease-in-out',
        display: 'inline-block',
      }} />
      LIVE
    </span>
  )
}
