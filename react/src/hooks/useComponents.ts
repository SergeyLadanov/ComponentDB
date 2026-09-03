import { useCallback, useEffect, useRef, useState } from 'react'
import { getComponents } from '../api/components'
import { Component } from '../ts/types'

export function useComponents() {
  const [components, setComponents] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const controller = useRef<AbortController>()

  const reload = useCallback(async () => {
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setLoading(true)
    setError('')
    try {
      const data = await getComponents(request.signal)
      if (!request.signal.aborted) setComponents(data)
    } catch (reason) {
      if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : 'Ошибка загрузки данных.')
    } finally {
      if (!request.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    return () => controller.current?.abort()
  }, [reload])

  return { components, loading, error, reload }
}
