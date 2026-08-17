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
import { HeroStatus } from '../components/HeroStatus'
import { MetricCards } from '../components/MetricCards'
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
import {
  BikeIcon,
  RadioIcon,
  SpeedometerIcon,
  RouteIcon,
  ShieldIcon,
  AlertTriangleIcon,
  LogOutIcon,
  MenuIcon,
  CloseIcon,
  ClockIcon,
} from '../components/Icons'

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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
      if (selectedTrip?.id === trip.id) {
        setSelectedTrip(null)
        setSelectedTripRoute(null)
        return
      }

      setSelectedTrip(trip)
      try {
        const route = await fetchTripRoute(selectedDevice.device_id, trip.id)
        setSelectedTripRoute(route)
      } catch (err) {
        setPanelError(err instanceof Error ? err.message : 'Failed to load trip route')
      }
    },
    [selectedDevice, selectedTrip]
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
      // Non-fatal
    }
  }, [])

  const handleDeviceSelect = useCallback(
    (device: Device) => {
      if (selectedDevice?.device_id === device.device_id) {
        setMobileSidebarOpen(false)
        return
      }
      clearDeviceData()
      setSelectedDevice(device)
      setPanelError(null)
      setMobileSidebarOpen(false)
      localStorage.setItem(SELECTED_DEVICE_STORAGE_KEY, device.device_id)
    },
    [selectedDevice?.device_id, clearDeviceData]
  )

  const handleDeviceDeleted = useCallback(
    (deletedDeviceId: string) => {
      if (selectedDevice?.device_id === deletedDeviceId) {
        clearDeviceData()
        setSelectedDevice(null)
        localStorage.removeItem(SELECTED_DEVICE_STORAGE_KEY)
      }
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

  useEffect(() => {
    if (!selectedDevice) return
    const deviceId = selectedDevice.device_id
    refreshDeviceMeta(deviceId)
    loadHistory(deviceId)
    loadTrips(deviceId)
    loadGeofences(deviceId)
    loadAlerts(deviceId)
  }, [selectedDevice?.device_id, refreshDeviceMeta, loadHistory, loadTrips, loadGeofences, loadAlerts])

  const handleRefreshAll = () => {
    if (!selectedDevice) return
    const deviceId = selectedDevice.device_id
    refreshDeviceMeta(deviceId)
    loadHistory(deviceId)
    loadTrips(deviceId)
    loadGeofences(deviceId)
    loadAlerts(deviceId)
  }

  const routePoints = history

  const handleRegistrationSuccess = () => {
    setShowRegistration(false)
    setDeviceListKey((k) => k + 1)
  }

  const handleLogout = async () => {
    disconnect()
    await signOut()
  }

  const handleGeofenceCreated = (newGeo: Geofence) => {
    setGeofences((prev) => [newGeo, ...prev])
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

  const unackedAlertCount = alerts.filter((a) => !a.acknowledged).length

  const getWsBadge = () => {
    switch (connectionStatus) {
      case 'CONNECTED':
        return { label: 'Live Stream Active', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: '#059669', pulse: true }
      case 'CONNECTING':
        return { label: 'Connecting Stream...', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: '#d97706', pulse: false }
      case 'ERROR':
        return { label: 'Stream Error', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#dc2626', pulse: false }
      default:
        return { label: 'Offline Mode', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: '#64748b', pulse: false }
    }
  }

  const wsBadge = getWsBadge()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--bg-app)' }}>
      {/* 2026 SaaS Dark Theme Header */}
      <header
        style={{
          backgroundColor: 'var(--header-bg)',
          borderBottom: '1px solid var(--header-border)',
          color: 'var(--header-text)',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          zIndex: 200,
        }}
      >
        {/* Brand & Mobile Hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '0.2rem',
            }}
            title="Toggle Device List"
          >
            <MenuIcon size={22} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)',
              }}
            >
              <BikeIcon size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                BikeTracker <span style={{ color: '#38bdf8', fontWeight: 500, fontSize: '0.8rem' }}>IoT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Live Connection Pulse */}
        <div style={{ display: 'none', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: wsBadge.bg,
              color: wsBadge.color,
              border: `1px solid ${wsBadge.border}`,
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <span
              className={wsBadge.pulse ? 'animate-pulse-green' : ''}
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: wsBadge.color,
                display: 'inline-block',
              }}
            />
            {wsBadge.label}
          </div>
        </div>

        {/* Right: User Profile & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontWeight: 700,
                fontSize: '0.8rem',
              }}
            >
              {user?.email?.[0].toUpperCase() || 'U'}
            </div>
            <span style={{ color: '#cbd5e1', display: 'none' }}>{user?.email}</span>
          </div>

          <button
            onClick={handleLogout}
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              color: '#cbd5e1',
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
              e.currentTarget.style.color = '#fca5a5'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.color = '#cbd5e1'
            }}
          >
            <LogOutIcon size={14} />
            <span>Logout</span>
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
            backgroundColor: toastAlert.type === 'OVERSPEED' ? '#dc2626' : '#16a34a',
            color: 'white',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 9999,
            maxWidth: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            border: '1px solid rgba(255,255,255,0.3)',
          }}
        >
          <div>
            <strong style={{ display: 'block', fontSize: '0.85rem' }}>
              🚨 REAL-TIME ALERT: {toastAlert.type}
            </strong>
            <span style={{ fontSize: '0.8rem', opacity: 0.95 }}>{toastAlert.message}</span>
          </div>
          <button
            onClick={() => setToastAlert(null)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '0.2rem',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>
      )}

      {/* Main App Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left Sidebar (Desktop fixed + Mobile Slide-over Drawer) */}
        <aside
          style={{
            width: '320px',
            borderRight: '1px solid var(--border-subtle)',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            flexShrink: 0,
            zIndex: 150,
            position: 'relative',
            ...(mobileSidebarOpen
              ? { position: 'absolute', top: 0, left: 0, bottom: 0, boxShadow: 'var(--shadow-xl)' }
              : {}),
          }}
        >
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowRegistration(!showRegistration)}
              className="btn-primary"
              style={{ flex: 1, padding: '0.55rem' }}
            >
              {showRegistration ? 'Cancel Registration' : '+ Register Device'}
            </button>
          </div>

          {showRegistration && (
            <DeviceRegistration
              onRegistrationSuccess={handleRegistrationSuccess}
              onCancel={() => setShowRegistration(false)}
            />
          )}

          <DeviceList
            key={deviceListKey}
            selectedDevice={selectedDevice}
            onDeviceSelect={handleDeviceSelect}
            onDevicesLoaded={handleDevicesLoaded}
            onDeviceDeleted={handleDeviceDeleted}
          />
        </aside>

        {/* Mobile backdrop */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(2px)',
              zIndex: 140,
            }}
          />
        )}

        {/* Right Main Dashboard Area */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflowY: 'auto',
            padding: '1rem 1.25rem',
          }}
        >
          {/* Hero Device Status Bar */}
          <HeroStatus
            device={selectedDevice}
            location={location}
            connectionStatus={connectionStatus}
            onRefresh={handleRefreshAll}
            onAddDevice={() => setShowRegistration(true)}
          />

          {/* Key Metrics Row */}
          <MetricCards
            location={location}
            summary={tripSummary}
            activeTrip={trips.find((t) => t.status === 'ACTIVE') || null}
            loading={historyLoading}
          />

          {/* Core Visual Viewport: Live Map Card */}
          <div
            className="card"
            style={{
              height: '420px',
              minHeight: '320px',
              position: 'relative',
              overflow: 'hidden',
              marginBottom: '1rem',
            }}
          >
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

          {/* IoT Management Hub: Tabbed Bottom Panels */}
          <div
            className="card"
            style={{
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '340px',
              overflow: 'hidden',
              marginBottom: '1rem',
            }}
          >
            {/* Pill Tab Navigation Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: '#f8fafc',
                padding: '0.6rem 0.85rem',
                overflowX: 'auto',
                flexShrink: 0,
              }}
            >
              {[
                { id: 'telemetry', label: '📡 Sensors & Diagnostics' },
                { id: 'trips', label: `🗺️ Trip Logs (${trips.length})` },
                { id: 'history', label: `⏱️ Location Breadcrumbs (${history.length})` },
                { id: 'geofences', label: `🛡️ Safe Zones (${geofences.length})` },
                { id: 'alerts', label: `⚠️ Security Alerts ${unackedAlertCount > 0 ? `(${unackedAlertCount})` : ''}` },
              ].map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as ActiveTab)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.8rem',
                      fontWeight: isActive ? 700 : 600,
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      backgroundColor: isActive ? 'var(--brand-primary)' : 'transparent',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--brand-primary)' : 'transparent',
                      borderRadius: 'var(--radius-full)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Tab Body Contents */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {activeTab === 'telemetry' && (
                <TelemetryPanel
                  device={selectedDevice}
                  location={location}
                  connectionStatus={connectionStatus}
                  loading={historyLoading}
                />
              )}

              {activeTab === 'trips' && (
                <TripHistoryPanel
                  trips={trips}
                  summary={tripSummary}
                  selectedTripId={selectedTrip?.id ?? null}
                  selectedTripRoute={selectedTripRoute}
                  loading={tripsLoading}
                  error={tripsError}
                  onRefresh={() => selectedDevice && loadTrips(selectedDevice.device_id)}
                  onSelectTrip={handleSelectTrip}
                />
              )}

              {activeTab === 'history' && (
                <LocationHistoryPanel
                  locations={history}
                  loading={historyLoading}
                  error={historyError}
                  onRefresh={() => selectedDevice && loadHistory(selectedDevice.device_id)}
                />
              )}

              {activeTab === 'geofences' && (
                <GeofencePanel
                  deviceId={selectedDevice?.device_id}
                  currentLocation={location}
                  geofences={geofences}
                  loading={geofencesLoading}
                  error={geofencesError}
                  onRefresh={() => selectedDevice && loadGeofences(selectedDevice.device_id)}
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
                  onRefresh={() => selectedDevice && loadAlerts(selectedDevice.device_id)}
                  onAlertAcknowledged={handleAlertAcknowledged}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
