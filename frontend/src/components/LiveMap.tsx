import { useEffect, useRef, useState, useCallback } from 'react'
import * as maplibregl from 'maplibre-gl'
import { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { formatISTDateTime } from '../utils/timeFormatter'
import { isValidCoordinate, filterValidLocations, getFreshnessStatus } from '../utils/gpsValidator'
import { reverseGeocode, type PlaceDetails } from '../utils/reverseGeocode'
import type { Location, ConnectionStatus, Trip } from '../types/location'
import type { Device } from '../types/device'
import type { Geofence } from '../types/geofence'
import {
  CrosshairIcon,
  FitBoundsIcon,
  ZoomInIcon,
  ZoomOutIcon,
  NavigationIcon,
  CopyIcon,
  CheckIcon,
} from './Icons'

// MapLibre GL JS worker setup
setWorkerUrl(maplibreWorkerUrl)

interface LiveMapProps {
  location: Location | null
  routePoints: Location[]
  geofences?: Geofence[]
  device: Device | null
  connectionStatus: ConnectionStatus
  selectedTrip?: Trip | null
  selectedTripRoute?: Location[] | null
  onClearSelectedTrip?: () => void
}

const DEFAULT_CENTER: [number, number] = [73.856744, 18.520430] // Pune, India
const ROUTE_SOURCE_ID = 'bike-route'
const ROUTE_LAYER_ID = 'bike-route-line'
const ROUTE_CASING_LAYER_ID = 'bike-route-casing'
const TRIP_ROUTE_SOURCE_ID = 'bike-trip-route'
const TRIP_ROUTE_LAYER_ID = 'bike-trip-route-line'
const GEOFENCES_SOURCE_ID = 'bike-geofences'
const GEOFENCES_FILL_LAYER_ID = 'bike-geofences-fill'
const GEOFENCES_LINE_LAYER_ID = 'bike-geofences-line'

function buildRouteGeoJSON(points: Location[]): GeoJSON.Feature<GeoJSON.LineString> {
  const valid = filterValidLocations(points)
  // Reverse to get chronological order (backend sends newest first)
  const chronological = [...valid].reverse()
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: chronological.map((p) => [p.longitude, p.latitude]),
    },
  }
}

function buildTripRouteGeoJSON(points: Location[]): GeoJSON.Feature<GeoJSON.LineString> {
  const valid = filterValidLocations(points)
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: valid.map((p) => [p.longitude, p.latitude]),
    },
  }
}

function createCircleCoordinates(center: [number, number], radiusInMeters: number, points = 64): [number, number][] {
  const coords: [number, number][] = []
  const [lon, lat] = center
  const earthRadius = 6371000
  const latRad = (lat * Math.PI) / 180
  const lonRad = (lon * Math.PI) / 180
  const dByR = radiusInMeters / earthRadius

  for (let i = 0; i <= points; i++) {
    const bearing = (i * 2 * Math.PI) / points
    const pLat = Math.asin(
      Math.sin(latRad) * Math.cos(dByR) +
      Math.cos(latRad) * Math.sin(dByR) * Math.cos(bearing)
    )
    const pLon = lonRad + Math.atan2(
      Math.sin(bearing) * Math.sin(dByR) * Math.cos(latRad),
      Math.cos(dByR) - Math.sin(latRad) * Math.sin(pLat)
    )
    coords.push([(pLon * 180) / Math.PI, (pLat * 180) / Math.PI])
  }
  return coords
}

function buildGeofencesGeoJSON(geofences: Geofence[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const enabledGeofences = geofences.filter((g) => g.enabled && isValidCoordinate(g.latitude, g.longitude))
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = enabledGeofences.map((geo) => {
    const circleCoords = createCircleCoordinates([geo.longitude, geo.latitude], geo.radius)
    return {
      type: 'Feature',
      properties: {
        id: geo.id,
        name: geo.name,
        radius: geo.radius,
        lat: geo.latitude,
        lon: geo.longitude,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [circleCoords],
      },
    }
  })

  return {
    type: 'FeatureCollection',
    features,
  }
}

export default function LiveMap({
  location,
  routePoints,
  geofences = [],
  device,
  connectionStatus,
  selectedTrip,
  selectedTripRoute,
  onClearSelectedTrip,
}: LiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const geofencePopupRef = useRef<maplibregl.Popup | null>(null)
  const startMarkerRef = useRef<maplibregl.Marker | null>(null)
  const endMarkerRef = useRef<maplibregl.Marker | null>(null)
  const hasCenteredForDeviceRef = useRef<string | null>(null)
  const mapReadyRef = useRef(false)

  const [mapError, setMapError] = useState<string | null>(null)
  const [followBike, setFollowBike] = useState(false)
  const [placeInfo, setPlaceInfo] = useState<PlaceDetails | null>(null)
  const [copiedCoords, setCopiedCoords] = useState(false)

  // Filter valid locations
  const validLocation = location && isValidCoordinate(location.latitude, location.longitude) ? location : null
  const validRoutePoints = filterValidLocations(routePoints)
  const validTripPoints = selectedTripRoute ? filterValidLocations(selectedTripRoute) : null
  const freshness = getFreshnessStatus(validLocation?.timestamp || device?.last_seen)

  // Fetch reverse geocoded place name when location changes
  useEffect(() => {
    if (!validLocation) {
      setPlaceInfo(null)
      return
    }

    let isMounted = true
    reverseGeocode(validLocation.latitude, validLocation.longitude).then((info) => {
      if (isMounted) {
        setPlaceInfo(info)
      }
    })

    return () => {
      isMounted = false
    }
  }, [validLocation?.latitude, validLocation?.longitude])

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY
    if (!apiKey) {
      setMapError('Map provider API key is missing.')
      return
    }

    let cancelled = false

    const initialCenter = validLocation
      ? [validLocation.longitude, validLocation.latitude] as [number, number]
      : DEFAULT_CENTER

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`,
      center: initialCenter,
      zoom: validLocation ? 15 : 12,
      attributionControl: false,
    })

    // Add compact attribution control
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    mapRef.current = map

    map.on('load', () => {
      if (cancelled) return
      mapReadyRef.current = true

      // Route Casing layer (outer glow/shadow)
      if (!map.getSource(ROUTE_SOURCE_ID)) {
        map.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [] },
          },
        })

        map.addLayer({
          id: ROUTE_CASING_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#1e3a8a',
            'line-width': 6,
            'line-opacity': 0.4,
          },
        })

        // Route Primary Line
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#2563eb',
            'line-width': 4,
            'line-opacity': 0.9,
          },
        })
      }

      // Historical Trip Route source & layer
      if (!map.getSource(TRIP_ROUTE_SOURCE_ID)) {
        map.addSource(TRIP_ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [] },
          },
        })

        map.addLayer({
          id: TRIP_ROUTE_LAYER_ID,
          type: 'line',
          source: TRIP_ROUTE_SOURCE_ID,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#7c3aed',
            'line-width': 5,
            'line-opacity': 0.9,
          },
        })
      }

      // Geofences source & layers
      if (!map.getSource(GEOFENCES_SOURCE_ID)) {
        map.addSource(GEOFENCES_SOURCE_ID, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        })

        map.addLayer({
          id: GEOFENCES_FILL_LAYER_ID,
          type: 'fill',
          source: GEOFENCES_SOURCE_ID,
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.2,
          },
        })

        map.addLayer({
          id: GEOFENCES_LINE_LAYER_ID,
          type: 'line',
          source: GEOFENCES_SOURCE_ID,
          paint: {
            'line-color': '#059669',
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
        })

        map.on('click', GEOFENCES_FILL_LAYER_ID, (e) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          if (!props) return

          if (!geofencePopupRef.current) {
            geofencePopupRef.current = new maplibregl.Popup({ offset: 10 })
          }

          const popupContent = `
            <div style="font-size: 0.85rem; line-height: 1.4; padding: 4px;">
              <strong style="color: #059669; font-size: 0.9rem;">🛡️ Safe Zone: ${props.name}</strong><br/>
              Radius: <strong>${props.radius} m</strong><br/>
              Center: ${Number(props.lat).toFixed(6)}, ${Number(props.lon).toFixed(6)}
            </div>
          `

          geofencePopupRef.current
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(map)
        })

        map.on('mouseenter', GEOFENCES_FILL_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', GEOFENCES_FILL_LAYER_ID, () => {
          map.getCanvas().style.cursor = ''
        })
      }
    })

    map.on('error', () => {
      setMapError('Map provider failed to load tiles.')
    })

    return () => {
      cancelled = true
      mapReadyRef.current = false
      markerRef.current?.remove()
      markerRef.current = null
      popupRef.current?.remove()
      popupRef.current = null
      geofencePopupRef.current?.remove()
      geofencePopupRef.current = null
      startMarkerRef.current?.remove()
      startMarkerRef.current = null
      endMarkerRef.current?.remove()
      endMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Clear marker/route when device changes
  useEffect(() => {
    hasCenteredForDeviceRef.current = null

    if (!device) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      const map = mapRef.current
      if (map && mapReadyRef.current) {
        const routeSource = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
        routeSource?.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        })

        const tripSource = map.getSource(TRIP_ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
        tripSource?.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        })

        const geoSource = map.getSource(GEOFENCES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
        geoSource?.setData({
          type: 'FeatureCollection',
          features: [],
        })
      }
    }
  }, [device?.device_id])

  // Create or update Custom Bike Marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!validLocation) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }

    const lngLat: [number, number] = [validLocation.longitude, validLocation.latitude]
    const deviceLabel = device?.name || device?.device_id || validLocation.device_id
    const isLive = freshness.state === 'LIVE'

    // Marker Element with pulse ring
    let el = markerRef.current?.getElement()
    if (!el) {
      el = document.createElement('div')
      el.className = 'custom-bike-marker'
      el.style.width = '44px'
      el.style.height = '44px'
      el.style.position = 'relative'
      el.style.cursor = 'pointer'
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
    }

    // Inner marker styling with pulse
    el.innerHTML = `
      <div style="position: absolute; inset: 0; border-radius: 50%; background-color: ${isLive ? '#10b981' : '#3b82f6'}; opacity: ${isLive ? '0.35' : '0.15'}; ${isLive ? 'animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;' : ''}"></div>
      <div style="width: 34px; height: 34px; border-radius: 50%; background-color: #ffffff; border: 2.5px solid ${isLive ? '#059669' : '#2563eb'}; box-shadow: 0 4px 12px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; z-index: 2; position: relative;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${isLive ? '#059669' : '#2563eb'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18.5" cy="17.5" r="3.5" />
          <circle cx="5.5" cy="17.5" r="3.5" />
          <circle cx="15" cy="5" r="1" />
          <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
        </svg>
      </div>
      <div style="position: absolute; bottom: -4px; width: 8px; height: 8px; background-color: ${isLive ? '#059669' : '#64748b'}; border: 1.5px solid #ffffff; border-radius: 50%; z-index: 3;"></div>
    `

    const popupHtml = `
      <div style="font-size: 0.85rem; line-height: 1.45; min-width: 180px; padding: 4px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <strong style="font-size: 0.95rem; color: #0f172a;">${deviceLabel}</strong>
          <span style="font-size: 0.7rem; font-weight: 700; color: ${freshness.color}; background: ${freshness.bg}; border: 1px solid ${freshness.border}; padding: 1px 6px; border-radius: 999px;">
            ${freshness.label}
          </span>
        </div>
        ${placeInfo ? `<div style="color: #334155; font-weight: 500; font-size: 0.8rem; margin-bottom: 4px;">📍 ${placeInfo.shortAddress}</div>` : ''}
        <div style="color: #64748b; font-family: monospace; font-size: 0.75rem;">
          ${validLocation.latitude.toFixed(6)}, ${validLocation.longitude.toFixed(6)}
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #475569;">
          <span>Speed: <strong>${validLocation.speed !== null && validLocation.speed !== undefined ? `${validLocation.speed.toFixed(1)} km/h` : '0.0 km/h'}</strong></span>
          <span>Satellites: <strong>${validLocation.satellites ?? 'N/A'}</strong></span>
        </div>
        <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px;">
          ${formatISTDateTime(validLocation.timestamp)}
        </div>
      </div>
    `

    if (!popupRef.current) {
      popupRef.current = new maplibregl.Popup({ offset: 25, closeButton: false })
    }
    popupRef.current.setHTML(popupHtml)

    if (markerRef.current) {
      markerRef.current.setLngLat(lngLat)
      markerRef.current.setPopup(popupRef.current)
    } else {
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(lngLat)
        .setPopup(popupRef.current)
        .addTo(map)
      markerRef.current = marker
    }

    // Centering behavior:
    if (!selectedTripRoute) {
      const deviceKey = device?.device_id || validLocation.device_id
      if (hasCenteredForDeviceRef.current !== deviceKey) {
        hasCenteredForDeviceRef.current = deviceKey
        map.flyTo({
          center: lngLat,
          zoom: Math.max(map.getZoom(), 15),
          duration: 1000,
        })
      } else if (followBike) {
        map.easeTo({
          center: lngLat,
          duration: 600,
        })
      }
    }
  }, [validLocation, device, selectedTripRoute, followBike, freshness, placeInfo])

  // Update Breadcrumb Route Line (Only Valid Points!)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const applyRoute = () => {
      const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
      if (!source) return

      if (!validRoutePoints || validRoutePoints.length < 2) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        })
        return
      }

      source.setData(buildRouteGeoJSON(validRoutePoints))
    }

    if (mapReadyRef.current) {
      applyRoute()
    } else {
      map.once('load', applyRoute)
    }
  }, [validRoutePoints, device?.device_id])

  // Update Historical Trip Route
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const applyTripRoute = () => {
      const source = map.getSource(TRIP_ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined

      startMarkerRef.current?.remove()
      startMarkerRef.current = null
      endMarkerRef.current?.remove()
      endMarkerRef.current = null

      if (!validTripPoints || validTripPoints.length === 0) {
        source?.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        })
        return
      }

      source?.setData(buildTripRouteGeoJSON(validTripPoints))

      // Start Marker
      const startPt = validTripPoints[0]
      const startEl = document.createElement('div')
      startEl.style.backgroundColor = '#16a34a'
      startEl.style.color = '#ffffff'
      startEl.style.fontSize = '0.7rem'
      startEl.style.fontWeight = 'bold'
      startEl.style.padding = '0.2rem 0.4rem'
      startEl.style.borderRadius = '4px'
      startEl.style.border = '2px solid #ffffff'
      startEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)'
      startEl.innerText = '🏁 Start'

      startMarkerRef.current = new maplibregl.Marker({ element: startEl })
        .setLngLat([startPt.longitude, startPt.latitude])
        .addTo(map)

      // End Marker
      if (validTripPoints.length > 1) {
        const endPt = validTripPoints[validTripPoints.length - 1]
        const endEl = document.createElement('div')
        endEl.style.backgroundColor = '#dc2626'
        endEl.style.color = '#ffffff'
        endEl.style.fontSize = '0.7rem'
        endEl.style.fontWeight = 'bold'
        endEl.style.padding = '0.2rem 0.4rem'
        endEl.style.borderRadius = '4px'
        endEl.style.border = '2px solid #ffffff'
        endEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)'
        endEl.innerText = '🛑 End'

        endMarkerRef.current = new maplibregl.Marker({ element: endEl })
          .setLngLat([endPt.longitude, endPt.latitude])
          .addTo(map)
      }

      // Fit bounds
      if (validTripPoints.length > 1) {
        const bounds = new maplibregl.LngLatBounds()
        validTripPoints.forEach((pt) => bounds.extend([pt.longitude, pt.latitude]))
        map.fitBounds(bounds, {
          padding: 60,
          maxZoom: 16,
          duration: 1000,
        })
      } else {
        map.flyTo({
          center: [startPt.longitude, startPt.latitude],
          zoom: 15,
          duration: 800,
        })
      }
    }

    if (mapReadyRef.current) {
      applyTripRoute()
    } else {
      map.once('load', applyTripRoute)
    }
  }, [validTripPoints])

  // Update Geofences
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const applyGeofences = () => {
      const source = map.getSource(GEOFENCES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
      if (!source) return

      if (!device || !geofences || geofences.length === 0) {
        source.setData({
          type: 'FeatureCollection',
          features: [],
        })
        return
      }

      source.setData(buildGeofencesGeoJSON(geofences))
    }

    if (mapReadyRef.current) {
      applyGeofences()
    } else {
      map.once('load', applyGeofences)
    }
  }, [geofences, device?.device_id])

  // Map Controls Actions
  const handleLocateBike = useCallback(() => {
    if (!mapRef.current || !validLocation) return
    mapRef.current.flyTo({
      center: [validLocation.longitude, validLocation.latitude],
      zoom: 16,
      duration: 1000,
    })
  }, [validLocation])

  const handleFitRoute = useCallback(() => {
    if (!mapRef.current) return
    const pointsToFit = validTripPoints && validTripPoints.length > 0 ? validTripPoints : validRoutePoints

    if (pointsToFit.length === 0 && validLocation) {
      handleLocateBike()
      return
    }

    if (pointsToFit.length === 1) {
      mapRef.current.flyTo({
        center: [pointsToFit[0].longitude, pointsToFit[0].latitude],
        zoom: 16,
        duration: 800,
      })
      return
    }

    const bounds = new maplibregl.LngLatBounds()
    pointsToFit.forEach((pt) => bounds.extend([pt.longitude, pt.latitude]))
    mapRef.current.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      maxZoom: 16,
      duration: 1000,
    })
  }, [validTripPoints, validRoutePoints, validLocation, handleLocateBike])

  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ duration: 300 })
  }

  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 300 })
  }

  const handleCopyCoordinates = () => {
    if (!validLocation) return
    navigator.clipboard.writeText(`${validLocation.latitude.toFixed(6)}, ${validLocation.longitude.toFixed(6)}`)
    setCopiedCoords(true)
    setTimeout(() => setCopiedCoords(false), 2500)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '380px', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Review Mode Banner */}
      {selectedTrip && (
        <div
          style={{
            position: 'absolute',
            top: '0.85rem',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e1b4b',
            color: '#ffffff',
            padding: '0.55rem 1.15rem',
            borderRadius: 'var(--radius-full)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            border: '1px solid #4338ca',
            fontSize: '0.825rem',
            maxWidth: '90%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🗺️</span>
            <strong>Reviewing Trip #{selectedTrip.id}</strong>
            <span style={{ color: '#c7d2fe' }}>({selectedTrip.distance ? `${Number(selectedTrip.distance).toFixed(2)} km` : 'Route'})</span>
          </div>

          {onClearSelectedTrip && (
            <button
              onClick={onClearSelectedTrip}
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              ✕ Exit
            </button>
          )}
        </div>
      )}

      {/* Professional Floating Map Controls (Right Side) */}
      <div
        style={{
          position: 'absolute',
          top: '0.85rem',
          right: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
          zIndex: 1000,
        }}
      >
        {/* Connection Status Badge */}
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: freshness.color,
          }}
        >
          <span
            className={freshness.dotClass}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: freshness.color,
              display: 'inline-block',
            }}
          />
          <span>{freshness.label}</span>
          {validRoutePoints.length > 0 && !selectedTrip && (
            <span style={{ color: 'var(--text-muted)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '0.4rem', fontWeight: 500 }}>
              {validRoutePoints.length} pts
            </span>
          )}
        </div>

        {/* Action Button Group */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {validLocation && (
            <button
              onClick={handleLocateBike}
              title="Locate Bike (Center & Zoom)"
              style={{
                backgroundColor: '#ffffff',
                border: 'none',
                borderBottom: '1px solid var(--border-subtle)',
                padding: '0.55rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
            >
              <CrosshairIcon size={18} />
            </button>
          )}

          {validRoutePoints.length > 1 && (
            <button
              onClick={handleFitRoute}
              title="Fit Full Route in View"
              style={{
                backgroundColor: '#ffffff',
                border: 'none',
                borderBottom: '1px solid var(--border-subtle)',
                padding: '0.55rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
            >
              <FitBoundsIcon size={18} />
            </button>
          )}

          {validLocation && (
            <button
              onClick={() => setFollowBike(!followBike)}
              title={followBike ? 'Follow Bike Active (Click to disable)' : 'Auto-Follow Bike Mode'}
              style={{
                backgroundColor: followBike ? '#eff6ff' : '#ffffff',
                border: 'none',
                borderBottom: '1px solid var(--border-subtle)',
                padding: '0.55rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: followBike ? '#2563eb' : '#64748b',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = followBike ? '#dbeafe' : '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = followBike ? '#eff6ff' : '#ffffff')}
            >
              <NavigationIcon size={18} color={followBike ? '#2563eb' : '#64748b'} />
            </button>
          )}

          <button
            onClick={handleZoomIn}
            title="Zoom In"
            style={{
              backgroundColor: '#ffffff',
              border: 'none',
              borderBottom: '1px solid var(--border-subtle)',
              padding: '0.55rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            <ZoomInIcon size={18} />
          </button>

          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            style={{
              backgroundColor: '#ffffff',
              border: 'none',
              padding: '0.55rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            <ZoomOutIcon size={18} />
          </button>
        </div>
      </div>

      {/* Enhanced Floating Location Information Panel (Bottom Left) */}
      {validLocation && (
        <div
          style={{
            position: 'absolute',
            bottom: '0.85rem',
            left: '0.85rem',
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(8px)',
            padding: '0.65rem 0.9rem',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            zIndex: 1000,
            border: '1px solid var(--border-subtle)',
            maxWidth: 'calc(100% - 1.7rem)',
            minWidth: '240px',
          }}
        >
          {/* Place Name & Suburb */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.95rem', marginTop: '-1px' }}>📍</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {placeInfo?.shortAddress || 'Locating Address...'}
              </div>
              {placeInfo?.state && (
                <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                  {placeInfo.state}, {placeInfo.country || 'India'}
                </div>
              )}
            </div>
          </div>

          {/* Coordinates with Copy button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.2rem 0.5rem',
              marginTop: '0.4rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
            }}
          >
            <span>{validLocation.latitude.toFixed(6)}, {validLocation.longitude.toFixed(6)}</span>
            <button
              onClick={handleCopyCoordinates}
              title="Copy GPS Coordinates"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0.1rem',
                color: copiedCoords ? '#059669' : '#64748b',
                marginLeft: '0.4rem',
              }}
            >
              {copiedCoords ? <CheckIcon size={14} color="#059669" /> : <CopyIcon size={14} />}
            </button>
          </div>

          {/* Freshness & Metrics row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <span>{freshness.relativeTime}</span>
            {validLocation.satellites !== null && validLocation.satellites !== undefined && (
              <span>🛰️ {validLocation.satellites} sats</span>
            )}
          </div>
        </div>
      )}

      {/* Map Legend (Bottom Center / Left) */}
      {validRoutePoints.length > 1 && !selectedTrip && (
        <div
          style={{
            position: 'absolute',
            bottom: '0.85rem',
            right: '0.85rem',
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(4px)',
            padding: '0.35rem 0.65rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            zIndex: 999,
            border: '1px solid var(--border-subtle)',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }} />
            <span>Bike</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '14px', height: '3px', borderRadius: '2px', backgroundColor: '#2563eb', display: 'inline-block' }} />
            <span>Route</span>
          </div>
        </div>
      )}

      {/* Map Engine Error Banner */}
      {mapError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
            padding: '1.25rem 1.75rem',
            borderRadius: 'var(--radius-lg)',
            zIndex: 1000,
            maxWidth: '85%',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Map Engine Error</strong>
          <span style={{ fontSize: '0.85rem' }}>{mapError}</span>
        </div>
      )}

      {/* No Location / Searching Overlay */}
      {!validLocation && !mapError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(6px)',
            padding: '1.25rem 1.85rem',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-subtle)',
            zIndex: 1000,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>🛰️</div>
          <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
            {device ? 'Acquiring GPS Fix...' : 'Select a device to track'}
          </strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {device ? 'Live coordinates will appear as soon as the bike broadcasts telemetry.' : 'Add or choose a registered GPS unit from the sidebar.'}
          </span>
        </div>
      )}
    </div>
  )
}
