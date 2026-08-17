import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Location, ConnectionStatus, Trip } from '../types/location'
import type { Device } from '../types/device'
import type { Geofence } from '../types/geofence'

// MapLibre GL JS v6 requires an explicit worker URL under Vite.
// Without this, style/attribution load but vector tiles never render (beige map).
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
const TRIP_ROUTE_SOURCE_ID = 'bike-trip-route'
const TRIP_ROUTE_LAYER_ID = 'bike-trip-route-line'
const GEOFENCES_SOURCE_ID = 'bike-geofences'
const GEOFENCES_FILL_LAYER_ID = 'bike-geofences-fill'
const GEOFENCES_LINE_LAYER_ID = 'bike-geofences-line'

function buildRouteGeoJSON(points: Location[]): GeoJSON.Feature<GeoJSON.LineString> {
  // History API returns newest-first; draw chronologically
  const chronological = [...points].reverse()
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
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.longitude, p.latitude]),
    },
  }
}

function createCircleCoordinates(center: [number, number], radiusInMeters: number, points = 64): [number, number][] {
  const coords: [number, number][] = []
  const [lon, lat] = center
  const earthRadius = 6371000 // Earth's radius in meters
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
  const enabledGeofences = geofences.filter((g) => g.enabled)
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

  // Create map once
  useEffect(() => {
    if (!mapContainerRef.current) return

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY
    if (!apiKey) {
      setMapError('Map provider API key is missing.')
      return
    }

    let cancelled = false

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`,
      center: DEFAULT_CENTER,
      zoom: 14,
    })

    mapRef.current = map

    map.on('load', () => {
      if (cancelled) return
      mapReadyRef.current = true

      // Route line source & layer
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
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#007bff',
            'line-width': 4,
            'line-opacity': 0.75,
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

        // Geofence fill
        map.addLayer({
          id: GEOFENCES_FILL_LAYER_ID,
          type: 'fill',
          source: GEOFENCES_SOURCE_ID,
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.2,
          },
        })

        // Geofence boundary line
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

        // Geofence click popup
        map.on('click', GEOFENCES_FILL_LAYER_ID, (e) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          if (!props) return

          if (!geofencePopupRef.current) {
            geofencePopupRef.current = new maplibregl.Popup({ offset: 10 })
          }

          const popupContent = `
            <div style="font-size: 0.85rem; line-height: 1.4;">
              <strong style="color: #059669;">🛡️ Geofence: ${props.name}</strong><br/>
              Radius: <strong>${props.radius} m</strong><br/>
              Center: ${Number(props.lat).toFixed(6)}, ${Number(props.lon).toFixed(6)}
            </div>
          `

          geofencePopupRef.current
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(map)
        })

        // Change cursor on geofence hover
        map.on('mouseenter', GEOFENCES_FILL_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', GEOFENCES_FILL_LAYER_ID, () => {
          map.getCanvas().style.cursor = ''
        })
      }
    })

    map.on('error', () => {
      setMapError('Map failed to load. Check map provider configuration.')
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

  // Clear marker/route/geofences when device changes
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

  // Update / create marker without resetting zoom on every update
  useEffect(() => {
    const map = mapRef.current
    if (!map || !location) {
      if (!location && markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }

    const lngLat: [number, number] = [location.longitude, location.latitude]
    const deviceLabel = device?.name || device?.device_id || location.device_id
    const popupHtml = `
      <div style="font-size: 0.875rem; line-height: 1.4;">
        <strong>${deviceLabel}</strong><br/>
        ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}<br/>
        Speed: ${location.speed !== null && location.speed !== undefined ? `${location.speed.toFixed(1)} km/h` : 'N/A'}
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
      const marker = new maplibregl.Marker({ color: '#007bff' })
        .setLngLat(lngLat)
        .setPopup(popupRef.current)
        .addTo(map)
      markerRef.current = marker
    }

    // Only pan if NOT viewing a historical trip route
    if (!selectedTripRoute) {
      const deviceKey = device?.device_id || location.device_id
      if (hasCenteredForDeviceRef.current !== deviceKey) {
        hasCenteredForDeviceRef.current = deviceKey
        map.flyTo({
          center: lngLat,
          zoom: Math.max(map.getZoom(), 15),
          duration: 1000,
        })
      } else {
        // Soft pan only — preserve zoom
        map.easeTo({
          center: lngLat,
          duration: 500,
        })
      }
    }
  }, [location, device, selectedTripRoute])

  // Update route line
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const applyRoute = () => {
      const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
      if (!source) return

      if (!routePoints || routePoints.length < 2) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        })
        return
      }

      source.setData(buildRouteGeoJSON(routePoints))
    }

    if (mapReadyRef.current) {
      applyRoute()
    } else {
      map.once('load', applyRoute)
    }
  }, [routePoints, device?.device_id])

  // Update historical trip route and start/end markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const applyTripRoute = () => {
      const source = map.getSource(TRIP_ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined

      startMarkerRef.current?.remove()
      startMarkerRef.current = null
      endMarkerRef.current?.remove()
      endMarkerRef.current = null

      if (!selectedTripRoute || selectedTripRoute.length === 0) {
        source?.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        })
        return
      }

      source?.setData(buildTripRouteGeoJSON(selectedTripRoute))

      // Place Start Marker (Green)
      const startPt = selectedTripRoute[0]
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

      // Place End Marker (Red) if > 1 points
      if (selectedTripRoute.length > 1) {
        const endPt = selectedTripRoute[selectedTripRoute.length - 1]
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

      // Auto-fit bounds to the trip route
      if (selectedTripRoute.length > 1) {
        const bounds = new maplibregl.LngLatBounds()
        selectedTripRoute.forEach((pt) => bounds.extend([pt.longitude, pt.latitude]))
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
  }, [selectedTripRoute])

  // Update geofences on map
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

  const getStatusIndicator = () => {
    switch (connectionStatus) {
      case 'CONNECTED':
        return { label: 'Live', color: '#28a745' }
      case 'CONNECTING':
        return { label: 'Connecting...', color: '#ffc107' }
      case 'DISCONNECTED':
        return { label: 'Disconnected', color: '#6c757d' }
      case 'ERROR':
        return { label: 'Error', color: '#dc3545' }
      default:
        return { label: '', color: '#6c757d' }
    }
  }

  const status = getStatusIndicator()

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Historical Trip Route Overlay Banner */}
      {selectedTrip && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e1b4b',
            color: 'white',
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <strong>🗺️ Viewing Historical Trip #{selectedTrip.id}</strong> —{' '}
            <span>{Number(selectedTrip.distance).toFixed(2)} km</span> ({selectedTrip.duration ?? '00:00:00'})
          </div>
          {onClearSelectedTrip && (
            <button
              onClick={onClearSelectedTrip}
              style={{
                backgroundColor: '#7c3aed',
                color: 'white',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              ✕ Return to Live
            </button>
          )}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          backgroundColor: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: status.color,
            display: 'inline-block',
          }}
        />
        {status.label}
      </div>

      {location && (
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '1rem',
            backgroundColor: 'white',
            padding: '0.5rem 0.75rem',
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 1000,
            fontSize: '0.8rem',
            fontFamily: 'monospace',
          }}
        >
          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
        </div>
      )}

      {mapError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            zIndex: 1000,
            maxWidth: '80%',
            textAlign: 'center',
          }}
        >
          {mapError}
        </div>
      )}

      {!location && !mapError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: '1rem 2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 1000,
          }}
        >
          {device ? 'Waiting for GPS...' : 'Select a device to track'}
        </div>
      )}
    </div>
  )
}

