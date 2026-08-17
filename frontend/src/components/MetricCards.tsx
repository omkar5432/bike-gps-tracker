import React from 'react'
import type { Location, TripSummary, Trip } from '../types/location'
import { SpeedometerIcon, RouteIcon, SatelliteIcon, AltitudeIcon, CrosshairIcon, ClockIcon } from './Icons'

interface MetricCardsProps {
  location: Location | null
  summary: TripSummary | null
  activeTrip: Trip | null
  loading?: boolean
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  location,
  summary,
  activeTrip,
  loading = false,
}) => {
  const currentSpeed = location?.speed ?? 0
  const speedFormatted = location && location.speed !== null && location.speed !== undefined
    ? Number(location.speed).toFixed(1)
    : '0.0'

  const totalDistance = summary?.total_distance_km
    ? `${Number(summary.total_distance_km).toFixed(2)} km`
    : activeTrip?.distance
    ? `${Number(activeTrip.distance).toFixed(2)} km`
    : '0.00 km'

  const gpsAccuracy = location?.gps_accuracy !== null && location?.gps_accuracy !== undefined
    ? `± ${Math.round(location.gps_accuracy)} m`
    : 'N/A'

  const altitude = location?.altitude !== null && location?.altitude !== undefined
    ? `${Math.round(location.altitude)} m`
    : 'N/A'

  const satellites = location?.satellites !== null && location?.satellites !== undefined
    ? location.satellites
    : 'N/A'

  const rideState = activeTrip
    ? (activeTrip.duration || 'In Progress')
    : currentSpeed > 2
    ? 'Moving'
    : 'Parked / Stationary'

  const cards = [
    {
      title: 'Current Speed',
      value: speedFormatted,
      unit: 'km/h',
      icon: <SpeedometerIcon size={20} color="#2563eb" />,
      subtext: currentSpeed > 0 ? (currentSpeed > 50 ? 'High Speed' : 'Normal Pace') : 'Stationary',
      color: '#2563eb',
      bgColor: '#eff6ff',
    },
    {
      title: 'Total Distance',
      value: totalDistance.split(' ')[0],
      unit: 'km',
      icon: <RouteIcon size={20} color="#7c3aed" />,
      subtext: `${summary?.total_trips ?? 0} completed trips`,
      color: '#7c3aed',
      bgColor: '#f5f3ff',
    },
    {
      title: 'Ride Duration',
      value: rideState,
      unit: '',
      icon: <ClockIcon size={20} color="#059669" />,
      subtext: activeTrip ? 'Active Recording' : 'Engine Idle',
      color: '#059669',
      bgColor: '#ecfdf5',
    },
    {
      title: 'GPS Accuracy',
      value: gpsAccuracy,
      unit: '',
      icon: <CrosshairIcon size={20} color="#d97706" />,
      subtext: (location?.gps_accuracy ?? 99) < 15 ? 'High Precision Lock' : 'Standard Lock',
      color: '#d97706',
      bgColor: '#fffbeb',
    },
    {
      title: 'Elevation / Altitude',
      value: altitude,
      unit: '',
      icon: <AltitudeIcon size={20} color="#0891b2" />,
      subtext: 'Above sea level',
      color: '#0891b2',
      bgColor: '#ecfeff',
    },
    {
      title: 'Satellites',
      value: satellites,
      unit: 'Locked',
      icon: <SatelliteIcon size={20} color="#4f46e5" />,
      subtext: Number(satellites) >= 6 ? 'Strong Signal' : 'Acquiring Signal',
      color: '#4f46e5',
      bgColor: '#eef2ff',
    },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.85rem',
        marginBottom: '1rem',
      }}
    >
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="card"
          style={{
            padding: '1rem 1.1rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {card.title}
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: card.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {card.icon}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {loading ? '...' : card.value}
            </span>
            {card.unit && (
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {card.unit}
              </span>
            )}
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
            {card.subtext}
          </div>
        </div>
      ))}
    </div>
  )
}
