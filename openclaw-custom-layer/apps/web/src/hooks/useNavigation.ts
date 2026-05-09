/**
 * useNavigation Hook
 * P6.1: Simple navigation hook for state-based routing
 *
 * Provides navigation capabilities without react-router-dom.
 */

import { useCallback, useMemo } from 'react'

/**
 * Hook for navigating between pages
 */
export function useNavigation() {
  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path)
    // Dispatch popstate event to trigger App.tsx listener
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  const currentPath = useMemo(() => window.location.pathname, [])

  return { navigate, currentPath }
}

/**
 * Hook for reading URL search params
 */
export function useSearchParams(): [URLSearchParams, (params: Record<string, string>, options?: { replace?: boolean }) => void] {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), [])

  const setSearchParams = useCallback((params: Record<string, string>, options?: { replace?: boolean }) => {
    const newUrl = new URL(window.location.href)

    // Clear existing params if setting empty object
    if (Object.keys(params).length === 0) {
      newUrl.search = ''
    } else {
      Object.entries(params).forEach(([key, value]) => {
        newUrl.searchParams.set(key, value)
      })
    }

    if (options?.replace) {
      window.history.replaceState({}, '', newUrl.toString())
    } else {
      window.history.pushState({}, '', newUrl.toString())
    }

    // Dispatch popstate to trigger updates
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  return [searchParams, setSearchParams]
}
