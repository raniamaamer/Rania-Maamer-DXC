// DXC Tunisia — useFetch hook
// Generic data fetching hook with loading/error states and auto-refresh

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * @param {Function} fetcher - Async function returning data
 * @param {Array} deps - Dependencies array (re-fetch when changed)
 * @param {Object} options
 * @param {number} options.refreshInterval - Auto-refresh in ms (0 = disabled)
 */
export function useFetch(fetcher, deps = [], options = {}) {
  const { refreshInterval = 0 } = options
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  // Stringify deps to detect actual value changes (avoids stale closure issues)
  const depsKey = JSON.stringify(deps)

  useEffect(() => {
    mountedRef.current = true
    let intervalId = null

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetcher()
        if (mountedRef.current) setData(result)
      } catch (err) {
        if (mountedRef.current) setError(err.message || 'Erreur réseau')
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    }

    load()

    if (refreshInterval > 0) {
      intervalId = setInterval(load, refreshInterval)
    }

    return () => {
      mountedRef.current = false
      if (intervalId) clearInterval(intervalId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, refreshInterval])

  return { data, loading, error }
}

/**
 * Specialized hook for KPI data with filter support.
 * Re-fetches automatically whenever any filter value changes.
 */
export function useKPI(fetcher, filters = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  // Use a stable serialized key so effect fires on actual filter changes
  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    mountedRef.current = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetcher(filters)
        if (mountedRef.current) setData(result)
      } catch (err) {
        if (mountedRef.current) setError(err.message || 'Erreur réseau')
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    }

    load()

    // Auto-refresh every 60s
    const intervalId = setInterval(load, 60_000)

    return () => {
      mountedRef.current = false
      clearInterval(intervalId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  return { data, loading, error }
}
