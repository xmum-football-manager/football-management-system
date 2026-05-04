'use client'

import { useEffect, useState } from 'react'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  variant?: ToastVariant
  duration?: number
  onDismiss?: () => void
}

export function Toast({ message, variant = 'info', duration = 2500, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onDismiss])

  if (!visible) return null

  const borderColor =
    variant === 'success' ? 'border-l-4 border-green-500' :
    variant === 'error' ? 'border-l-4 border-red-500' : ''

  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white rounded-lg px-5 py-3 text-[15px] font-medium shadow-lg ${borderColor}`}>
      {message}
    </div>
  )
}

// Toast manager hook
interface ToastState {
  id: number
  message: string
  variant: ToastVariant
}

let toastCount = 0
const listeners: Array<(toasts: ToastState[]) => void> = []
let toasts: ToastState[] = []

function notify(state: ToastState[]) {
  toasts = state
  listeners.forEach(l => l(state))
}

export const toast = {
  success: (message: string) => {
    const id = ++toastCount
    notify([...toasts, { id, message, variant: 'success' }])
  },
  error: (message: string) => {
    const id = ++toastCount
    notify([...toasts, { id, message, variant: 'error' }])
  },
  info: (message: string) => {
    const id = ++toastCount
    notify([...toasts, { id, message, variant: 'info' }])
  },
}

export function ToastContainer() {
  const [activeToasts, setActiveToasts] = useState<ToastState[]>([])

  useEffect(() => {
    listeners.push(setActiveToasts)
    return () => {
      const idx = listeners.indexOf(setActiveToasts)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return (
    <div className="fixed bottom-4 left-0 right-0 flex flex-col items-center gap-2 z-50 pointer-events-none">
      {activeToasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          variant={t.variant}
          onDismiss={() => setActiveToasts(prev => prev.filter(x => x.id !== t.id))}
        />
      ))}
    </div>
  )
}
