'use client'

import { useEffect, useRef, useCallback } from 'react'
import QRCode from 'qrcode'

interface Props {
  url: string
  onClose: () => void
}

export function QrModal({ url, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 240,
        margin: 2,
        color: { dark: '#0f172a', light: '#f8fafc' },
      })
    }
  }, [url])

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--ink-800)',
          border: '1px solid var(--ink-700)',
          borderRadius: 'var(--radius-xl)',
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          maxWidth: 320,
          width: '90vw',
        }}
      >
        <p style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--brand-lime)',
          margin: 0,
        }}>Scan to follow live</p>

        <div style={{
          background: '#f8fafc',
          borderRadius: 12,
          padding: 8,
          lineHeight: 0,
        }}>
          <canvas ref={canvasRef} />
        </div>

        <p style={{
          fontSize: 11, color: 'var(--ink-400)',
          wordBreak: 'break-all', textAlign: 'center', margin: 0,
        }}>{url}</p>

        <button
          onClick={onClose}
          style={{
            marginTop: 4,
            padding: '10px 24px',
            background: 'var(--ink-700)',
            border: '1px solid var(--ink-600)',
            borderRadius: 999,
            color: 'var(--ink-200)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
