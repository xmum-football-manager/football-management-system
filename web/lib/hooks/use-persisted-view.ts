'use client'

import { useState } from 'react'

/**
 * Persists a string view selection in localStorage so the choice is consistent
 * across pages that read the same key.
 */
export function usePersistedView<T extends string>(
  key: string,
  defaultValue: T,
  allowed: readonly T[],
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw && (allowed as readonly string[]).includes(raw)) {
        return raw as T
      }
    } catch {
      /* localStorage may be blocked */
    }
    return defaultValue
  })

  function update(next: T) {
    setValue(next)
    try {
      window.localStorage.setItem(key, next)
    } catch {
      /* ignore */
    }
  }

  return [value, update]
}
