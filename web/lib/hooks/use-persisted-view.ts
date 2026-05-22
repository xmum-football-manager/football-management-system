'use client'

import { useEffect, useState } from 'react'

/**
 * Persists a string view selection in localStorage so the choice is consistent
 * across pages that read the same key.
 */
export function usePersistedView<T extends string>(
  key: string,
  defaultValue: T,
  allowed: readonly T[],
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(defaultValue)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw && (allowed as readonly string[]).includes(raw)) {
        setValue(raw as T)
      }
    } catch {
      /* localStorage may be blocked */
    }
    // intentionally run once per key; `allowed` is treated as stable by callers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

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
