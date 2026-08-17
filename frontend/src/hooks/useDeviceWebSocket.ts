import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Location, ConnectionStatus } from '../types/location'
import type { Alert } from '../types/alert'

const WS_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('http', 'ws') || 'ws://localhost:8000'

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAYS = [2000, 4000, 8000, 16000, 32000]

export function useDeviceWebSocket(
  deviceId: string | undefined,
  onAlert?: (alert: Alert) => void,
  onTripEvent?: (eventName: string, trip: any) => void
) {
  const [location, setLocation] = useState<Location | null>(null)
  const [latestAlert, setLatestAlert] = useState<Alert | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED')
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const deviceIdRef = useRef<string | undefined>(undefined)
  const connectionGenRef = useRef(0)
  const onAlertRef = useRef(onAlert)
  const onTripEventRef = useRef(onTripEvent)

  useEffect(() => {
    onAlertRef.current = onAlert
  }, [onAlert])

  useEffect(() => {
    onTripEventRef.current = onTripEvent
  }, [onTripEvent])


  const clearReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const disconnect = useCallback(() => {
    connectionGenRef.current += 1
    clearReconnect()
    reconnectAttemptRef.current = 0

    const ws = wsRef.current
    wsRef.current = null
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      ws.close()
    }

    setConnectionStatus('DISCONNECTED')
  }, [clearReconnect])

  const connect = useCallback(async () => {
    if (!deviceId) {
      setConnectionStatus('DISCONNECTED')
      return
    }

    // Invalidate any in-flight connection / reconnect for previous generation
    connectionGenRef.current += 1
    const gen = connectionGenRef.current
    clearReconnect()

    const existing = wsRef.current
    wsRef.current = null
    if (existing) {
      existing.onopen = null
      existing.onmessage = null
      existing.onerror = null
      existing.onclose = null
      existing.close()
    }

    setConnectionStatus('CONNECTING')
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (connectionGenRef.current !== gen || deviceIdRef.current !== deviceId) {
        return
      }

      if (!token) {
        setConnectionStatus('ERROR')
        setError('Session expired or invalid. Please log in again.')
        return
      }

      const wsUrl = `${WS_BASE_URL}/api/v1/ws/devices/${deviceId}?token=${token}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (connectionGenRef.current !== gen || deviceIdRef.current !== deviceId) {
          ws.close()
          return
        }
        setConnectionStatus('CONNECTED')
        setError(null)
        reconnectAttemptRef.current = 0
      }

      ws.onmessage = (event) => {
        if (connectionGenRef.current !== gen || deviceIdRef.current !== deviceId) {
          return
        }
        try {
          const message = JSON.parse(event.data)

          if (message.event === 'location_update') {
            setLocation(message.data)
          } else if (message.event === 'alert') {
            const alertData: Alert = message.data
            setLatestAlert(alertData)
            if (onAlertRef.current) {
              onAlertRef.current(alertData)
            }
          } else if (message.event === 'trip_started' || message.event === 'trip_completed') {
            if (onTripEventRef.current) {
              onTripEventRef.current(message.event, message.data)
            }
          } else if (message.event === 'error') {
            setError(typeof message.data === 'string' ? message.data : 'WebSocket error')
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.onerror = () => {
        if (connectionGenRef.current !== gen || deviceIdRef.current !== deviceId) {
          return
        }
        setConnectionStatus('ERROR')
        setError('WebSocket connection error')
      }

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null
        }

        if (connectionGenRef.current !== gen || deviceIdRef.current !== deviceId) {
          return
        }

        setConnectionStatus('DISCONNECTED')

        if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAYS[reconnectAttemptRef.current]
          reconnectAttemptRef.current += 1

          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (connectionGenRef.current === gen && deviceIdRef.current === deviceId) {
              connect()
            }
          }, delay)
        } else {
          setConnectionStatus('ERROR')
          setError('WebSocket disconnected. Reconnection attempts exhausted.')
        }
      }
    } catch (err) {
      if (connectionGenRef.current !== gen) {
        return
      }
      console.error('Failed to connect to WebSocket:', err)
      setConnectionStatus('ERROR')
      setError('Failed to connect to live tracking')
    }
  }, [deviceId, clearReconnect])

  useEffect(() => {
    setLocation(null)
    setLatestAlert(null)
    setError(null)
    deviceIdRef.current = deviceId

    if (deviceId) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [deviceId, connect, disconnect])

  const clearLatestAlert = useCallback(() => {
    setLatestAlert(null)
  }, [])

  return {
    location,
    latestAlert,
    clearLatestAlert,
    connectionStatus,
    error,
    disconnect,
    setLocation,
  }
}
