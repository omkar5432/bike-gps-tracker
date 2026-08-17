import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import DeviceList from '../components/DeviceList'
import LiveMap from '../components/LiveMap'
import TelemetryPanel from '../components/TelemetryPanel'
import LocationHistoryPanel from '../components/LocationHistoryPanel'
import TripHistoryPanel from '../components/TripHistoryPanel'
import GeofencePanel from '../components/GeofencePanel'
import AlertsPanel from '../components/AlertsPanel'
import DeviceRegistration from '../components/DeviceRegistration'
import { useDeviceWebSocket } from '../hooks/useDeviceWebSocket'
import {
  fetchDevice,
  fetchLocationHistory,
  fetchTrips,
  fetchTripRoute,
  fetchTripSummary,
  fetchGeofences,
  fetchAlerts,
} from '../services/api'
import type { Device } from '../types/device'
import type { Location, Trip, TripSummary } from '../types/location'
import type { Geofence } from '../types/geofence'
import type { Alert } from '../types/alert'

const SELECTED_DEVICE_STORAGE_KEY = 'bike_gps_selected_device_id'
const HISTORY_LIMIT = 100
const TRIP_LIMIT = 20
const ALERT_LIMIT = 50

type ActiveTab = 'telemetry' | 'history' | 'trips' | 'geofences' | 'alerts'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [showRegistration, setShowRegistration] = useState(false)
  const [deviceListKey, setDeviceListKey] = useState(0)
  const [activeTab, setActiveTab] = useState<ActiveTab>('telemetry')

  // History & Trips
  const [history, setHistory] = useState<Location[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [tripSummary, setTripSummary] = useState<TripSummary | null>(null)
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [selectedTripRoute, setSelectedTripRoute] = useState<Location[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [tripsLoading, setTripsLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [tripsError, setTripsError] = useState<string | null>(null)

  // Geofences & Alerts
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [geofencesLoading, setGeofencesLoading] = useState(false)
  const [geofencesError, setGeofencesError] = useState<string | null>(null)

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertsError, setAlertsError] = useState<string | null>(null)

  // Live Alert Toast
  const [toastAlert, setToastAlert] = useState<Alert | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)

  const [panelError, setPanelError] = useState<string | null>(null)
  const restoredRef = useRef(false)

  const handleIncomingAlert = useCallback((incoming: Alert) => {
    setAlerts((prev) => {
      if (prev.some((a) => a.id === incoming.id)) return prev
      return [incoming, ...prev]
    })

    setToastAlert(incoming)
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastAlert(null)
    }, 6000)
  }, [])

  const loadTrips = useCallback(async (deviceId: string) => {
    setTripsLoading(true)
    setTripsError(null)
    try {
      const [tripsData, summaryData] = await Promise.all([
        fetchTrips(deviceId, TRIP_LIMIT),
        fetchTripSummary(deviceId).catch(() => null),
      ])
      setTrips(tripsData)
      setTripSummary(summaryData)
    } catch (err) {
      setTrips([])
      setTripSummary(null)
      setTripsError(err instanceof Error ? err.message : 'Failed to load trips')
    } finally {
      setTripsLoading(false)
    }
  }, [])

  const handleIncomingTripEvent = useCallback(
    (_eventName: string, _tripData: any) => {
      if (selectedDevice) {
        loadTrips(selectedDevice.device_id)
      }
    },
    [selectedDevice, loadTrips]
  )

  const { location, connectionStatus, error: wsError, disconnect, setLocation } =
    useDeviceWebSocket(selectedDevice?.device_id, handleIncomingAlert, handleIncomingTripEvent)

  const clearDeviceData = useCallback(() => {
    setHistory([])
    setTrips([])
    setTripSummary(null)
    setSelectedTrip(null)
    setSelectedTripRoute(null)
    setGeofences([])
    setAlerts([])
    setHistoryError(null)
    setTripsError(null)
    setGeofencesError(null)
    setAlertsError(null)
    setLocation(null)
    setToastAlert(null)
  }, [setLocation])

  const loadHistory = useCallback(async (deviceId: string) => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const data = await fetchLocationHistory(deviceId, HISTORY_LIMIT)
      setHistory(data)
      if (data.length > 0) {
        setLocation((prev) => prev ?? data[0])
      }
    } catch (err) {
      setHistory([])
      setHistoryError(err instanceof Error ? err.message : 'Failed to load location history')
    } finally {
      setHistoryLoading(false)
    }
  }, [setLocation])

  const loadGeofences = useCallback(async (deviceId: string) => {
    setGeofencesLoading(true)
    setGeofencesError(null)
    try {
      const data = await fetchGeofences(deviceId)
      setGeofences(data)
    } catch (err) {
      setGeofences([])
      setGeofencesError(err instanceof Error ? err.message : 'Failed to load geofences')
    } finally {
      setGeofencesLoading(false)
    }
  }, [])

  const loadAlerts = useCallback(async (deviceId: string) => {
    setAlertsLoading(true)
    setAlertsError(null)
    try {
      const data = await fetchAlerts(deviceId, ALERT_LIMIT)
      setAlerts(data)
    } catch (err) {
      setAlerts([])
      setAlertsError(err instanceof Error ? err.message : 'Failed to load alerts')
    } finally {
      setAlertsLoading(false)
    }
  }, [])

  const handleSelectTrip = useCallback(
    async (trip: Trip) => {
      if (!selectedDevice) return
      setSelectedTrip(trip)
      try {
        const route = await fetchTripRoute(selectedDevice.device_id, trip.id)
        setSelectedTripRoute(route)
      } catch (err) {
        setPanelError(err instanceof Error ? err.message : 'Failed to load trip route')
        setSelectedTripRoute([])
      }
    },
    [selectedDevice]
  )

  const handleClearSelectedTrip = useCallback(() => {
    setSelectedTrip(null)
    setSelectedTripRoute(null)
  }, [])


  const refreshDeviceMeta = useCallback(async (deviceId: string) => {
    try {
      const fresh = await fetchDevice(deviceId)
      setSelectedDevice((prev) =>
        prev && prev.device_id === deviceId ? { ...prev, ...fresh } : prev
      )
    } catch {
      // Non-fatal: keep existing device info
    }
  }, [])

  const handleDeviceSelect = useCallback(
    (device: Device) => {
      if (selectedDevice?.device_id === device.device_id) {
        return
      }
      clearDeviceData()
      setSelectedDevice(device)
      setPanelError(null)
      localStorage.setItem(SELECTED_DEVICE_STORAGE_KEY, device.device_id)
    },
    [selectedDevice?.device_id, clearDeviceData]
  )

  const handleDevicesLoaded = useCallback(
    (devices: Device[]) => {
      if (restoredRef.current) return
      restoredRef.current = true

      const savedId = localStorage.getItem(SELECTED_DEVICE_STORAGE_KEY)
      if (savedId) {
        const found = devices.find((d) => d.device_id === savedId)
        if (found) {
          setSelectedDevice(found)
          return
        }
      }
      if (devices.length === 1) {
        setSelectedDevice(devices[0])
        localStorage.setItem(SELECTED_DEVICE_STORAGE_KEY, devices[0].device_id)
      }
    },
    []
  )

  // Load all device details when device changes
  useEffect(() => {
    if (!selectedDevice) {
      clearDeviceData()
      return
    }

    const id = selectedDevice.device_id
    loadHistory(id)
    loadTrips(id)
    loadGeofences(id)
    loadAlerts(id)
    refreshDeviceMeta(id)
  }, [
    selectedDevice?.device_id,
    loadHistory,
    loadTrips,
    loadGeofences,
    loadAlerts,
    refreshDeviceMeta,
    clearDeviceData,
  ])

  // Merge live updates into history route (newest-first list)
  useEffect(() => {
    if (!location || !selectedDevice) return
    if (location.device_id !== selectedDevice.device_id) return

    setHistory((prev) => {
      if (prev.some((p) => p.id === location.id)) {
        return prev
      }
      return [location, ...prev].slice(0, HISTORY_LIMIT)
    })

    setSelectedDevice((prev) =>
      prev
        ? {
            ...prev,
            status: 'ONLINE',
            last_seen: location.timestamp,
          }
        : prev
    )
  }, [location, selectedDevice?.device_id])

  const handleRegistrationSuccess = () => {
    setDeviceListKey((prev) => prev + 1)
    setShowRegistration(false)
    restoredRef.current = false
  }

  const handleLogout = async () => {
    disconnect()
    clearDeviceData()
    setSelectedDevice(null)
    localStorage.removeItem(SELECTED_DEVICE_STORAGE_KEY)
    await signOut()
  }

  const handleGeofenceCreated = (newGeo: Geofence) => {
    setGeofences((prev) => [...prev, newGeo])
  }

  const handleGeofenceUpdated = (updatedGeo: Geofence) => {
    setGeofences((prev) =>
      prev.map((g) => (g.id === updatedGeo.id ? updatedGeo : g))
    )
  }

  const handleGeofenceDeleted = (geofenceId: number) => {
    setGeofences((prev) => prev.filter((g) => g.id !== geofenceId))
  }

  const handleAlertAcknowledged = (alertId: number) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? { ...a, acknowledged: true, acknowledged_at: new Date().toISOString() }
          : a
      )
    )
  }

  const unackedAlertsCount = alerts.filter((a) => !a.acknowledged).length
  const routePoints = history

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          backgroundColor: '#007bff',
          color: 'white',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Bike GPS Tracker</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>{user?.email}</span>
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Real-time Alert Toast Notification */}
      {toastAlert && (
        <div
          style={{
            position: 'fixed',
            top: '4.5rem',
            right: '1.5rem',
            backgroundColor: toastAlert.type === 'OVERSPEED' ? '#d32f2f' : '#2e7d32',
            color: 'white',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            zIndex: 9999,
            maxWidth: '380px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            animation: 'fadeIn 0.3s ease-in-out',
          }}
        >
          <div>
            <strong style={{ display: 'block', fontSize: '0.85rem' }}>
              ⚠️ REAL-TIME ALERT: {toastAlert.type}
            </strong>
            <span style={{ fontSize: '0.8rem' }}>{toastAlert.message}</span>
          </div>
          <button
            onClick={() => setToastAlert(null)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.1rem',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {(panelError || wsError) && (
        <div
          style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '0.5rem 1.5rem',
            fontSize: '0.875rem',
          }}
        >
          {panelError || wsError}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          style={{
            width: '300px',
            borderRight: '1px solid #ddd',
            overflow: 'auto',
            backgroundColor: '#f9f9f9',
          }}
        >
          <div style={{ padding: '1rem', borderBottom: '1px solid #ddd' }}>
            <button
              onClick={() => setShowRegistration(!showRegistration)}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                backgroundColor: showRegistration ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              {showRegistration ? 'Cancel' : '+ Add Device'}
            </button>
          </div>

          {showRegistration && (
            <DeviceRegistration onRegistrationSuccess={handleRegistrationSuccess} />
          )}

          <DeviceList
            key={deviceListKey}
            selectedDevice={selectedDevice}
            onDeviceSelect={handleDeviceSelect}
            onDevicesLoaded={handleDevicesLoaded}
          />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <LiveMap
              location={location}
              routePoints={routePoints}
              geofences={geofences}
              device={selectedDevice}
              connectionStatus={connectionStatus}
              selectedTrip={selectedTrip}
              selectedTripRoute={selectedTripRoute}
              onClearSelectedTrip={handleClearSelectedTrip}
            />
          </div>

          {/* Bottom Multi-Tab Panel */}
          <div
            style={{
              height: '290px',
              borderTop: '1px solid #ddd',
              backgroundColor: 'white',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Tab Navigation Header */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid #e0e0e0',
                backgroundColor: '#f8f9fa',
                padding: '0 0.5rem',
              }}
            >
              <button
                onClick={() => setActiveTab('telemetry')}
                style={{
                  padding: '0.6rem 1rem',
                  border: 'none',
                  borderBottom: activeTab === 'telemetry' ? '3px solid #007bff' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  fontWeight: activeTab === 'telemetry' ? 'bold' : 'normal',
                  color: activeTab === 'telemetry' ? '#007bff' : '#495057',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                📊 Telemetry
              </button>

              <button
                onClick={() => setActiveTab('history')}
                style={{
                  padding: '0.6rem 1rem',
                  border: 'none',
                  borderBottom: activeTab === 'history' ? '3px solid #007bff' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  fontWeight: activeTab === 'history' ? 'bold' : 'normal',
                  color: activeTab === 'history' ? '#007bff' : '#495057',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                🕒 Location History ({history.length})
              </button>

              <button
                onClick={() => setActiveTab('trips')}
                style={{
                  padding: '0.6rem 1rem',
                  border: 'none',
                  borderBottom: activeTab === 'trips' ? '3px solid #007bff' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  fontWeight: activeTab === 'trips' ? 'bold' : 'normal',
                  color: activeTab === 'trips' ? '#007bff' : '#495057',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                🚴 Past Trips ({trips.length})
              </button>

              <button
                onClick={() => setActiveTab('geofences')}
                style={{
                  padding: '0.6rem 1rem',
                  border: 'none',
                  borderBottom: activeTab === 'geofences' ? '3px solid #007bff' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  fontWeight: activeTab === 'geofences' ? 'bold' : 'normal',
                  color: activeTab === 'geofences' ? '#007bff' : '#495057',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                🛡️ Geofences ({geofences.length})
              </button>

              <button
                onClick={() => setActiveTab('alerts')}
                style={{
                  padding: '0.6rem 1rem',
                  border: 'none',
                  borderBottom: activeTab === 'alerts' ? '3px solid #007bff' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  fontWeight: activeTab === 'alerts' ? 'bold' : 'normal',
                  color: activeTab === 'alerts' ? '#007bff' : '#495057',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                ⚠️ Alerts ({alerts.length})
                {unackedAlertsCount > 0 && (
                  <span
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      padding: '0.05rem 0.4rem',
                      borderRadius: '10px',
                    }}
                  >
                    {unackedAlertsCount}
                  </span>
                )}
              </button>
            </div>

            {/* Tab Content Container */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {activeTab === 'telemetry' && (
                <div style={{ display: 'flex', height: '100%' }}>
                  <div style={{ flex: 1, borderRight: '1px solid #eee', height: '100%', overflow: 'auto' }}>
                    <TelemetryPanel
                      device={selectedDevice}
                      location={location}
                      connectionStatus={connectionStatus}
                    />
                  </div>
                  <div style={{ flex: 1.2, height: '100%', overflow: 'auto' }}>
                    <LocationHistoryPanel
                      locations={history}
                      loading={historyLoading}
                      error={historyError}
                      onRefresh={() => {
                        if (selectedDevice) {
                          loadHistory(selectedDevice.device_id)
                        } else {
                          setPanelError('Select a device to load history.')
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <LocationHistoryPanel
                  locations={history}
                  loading={historyLoading}
                  error={historyError}
                  onRefresh={() => {
                    if (selectedDevice) {
                      loadHistory(selectedDevice.device_id)
                    } else {
                      setPanelError('Select a device to load history.')
                    }
                  }}
                />
              )}

              {activeTab === 'trips' && (
                <TripHistoryPanel
                  trips={trips}
                  summary={tripSummary}
                  selectedTripId={selectedTrip?.id}
                  loading={tripsLoading}
                  error={tripsError}
                  onRefresh={() => {
                    if (selectedDevice) {
                      loadTrips(selectedDevice.device_id)
                    } else {
                      setPanelError('Select a device to load trips.')
                    }
                  }}
                  onSelectTrip={handleSelectTrip}
                />
              )}


              {activeTab === 'geofences' && (
                <GeofencePanel
                  deviceId={selectedDevice?.device_id}
                  currentLocation={location}
                  geofences={geofences}
                  loading={geofencesLoading}
                  error={geofencesError}
                  onRefresh={() => {
                    if (selectedDevice) {
                      loadGeofences(selectedDevice.device_id)
                    } else {
                      setPanelError('Select a device to load geofences.')
                    }
                  }}
                  onGeofenceCreated={handleGeofenceCreated}
                  onGeofenceUpdated={handleGeofenceUpdated}
                  onGeofenceDeleted={handleGeofenceDeleted}
                />
              )}

              {activeTab === 'alerts' && (
                <AlertsPanel
                  deviceId={selectedDevice?.device_id}
                  alerts={alerts}
                  loading={alertsLoading}
                  error={alertsError}
                  onRefresh={() => {
                    if (selectedDevice) {
                      loadAlerts(selectedDevice.device_id)
                    } else {
                      setPanelError('Select a device to load alerts.')
                    }
                  }}
                  onAlertAcknowledged={handleAlertAcknowledged}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
