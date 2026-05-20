import { useEffect, useRef } from 'react'

/**
 * Enterprise Performance Guard
 * Tracks render times and identifies slow components in the ERP UI.
 */
export function usePerfGuard(componentName: string) {
  const renderCount = useRef(0)
  const startTime = useRef(performance.now())

  useEffect(() => {
    const endTime = performance.now()
    const duration = endTime - startTime.current
    renderCount.current += 1

    if (duration > 100) { // Warn only on genuinely slow renders (>100ms)
      console.warn(
        `[PerfGuard] ⚠️ Slow Render in <${componentName}>: ${duration.toFixed(2)}ms (Render #${renderCount.current})`
      )
    }

    // Reset for next potential render
    startTime.current = performance.now()
  })
}

/**
 * Zustand Store Performance Wrapper
 * High-order function to track store mutation latency.
 */
export const trackStoreMutation = async <T>(
  actionName: string,
  mutation: () => Promise<T>
): Promise<T> => {
  const start = performance.now()
  try {
    const result = await mutation()
    const end = performance.now()
    const diff = end - start

    if (diff > 100) {
      console.warn(`[StorePerf] 🐢 Slow Mutation "${actionName}": ${diff.toFixed(2)}ms`)
    }
    
    return result
  } catch (error) {
    throw error
  }
}
