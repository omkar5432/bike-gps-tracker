import React, { useState } from 'react'
import type { Location } from '../types/location'
import { formatISTTime } from '../utils/timeFormatter'

interface SpeedChartProps {
  locations: Location[]
  height?: number
}

export const SpeedChart: React.FC<SpeedChartProps> = ({ locations, height = 160 }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (!locations || locations.length < 2) {
    return (
      <div
        style={{
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-strong)',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
        }}
      >
        <span>Insufficient GPS breadcrumbs to render speed analytics chart.</span>
      </div>
    )
  }

  // Reverse if needed to ensure chronological order (oldest to newest)
  const points = [...locations].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const speeds = points.map((p) => Number(p.speed ?? 0))
  const maxSpeed = Math.max(...speeds, 20)
  const minSpeed = 0

  const width = 600
  const padding = { top: 16, right: 16, bottom: 24, left: 36 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const getX = (index: number) => padding.left + (index / (points.length - 1)) * chartW
  const getY = (speed: number) => padding.top + chartH - ((speed - minSpeed) / (maxSpeed - minSpeed)) * chartH

  // Build SVG path
  const pathD = points.reduce((acc, p, i) => {
    const x = getX(i)
    const y = getY(Number(p.speed ?? 0))
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
  }, '')

  const areaD = `${pathD} L ${getX(points.length - 1)} ${padding.top + chartH} L ${getX(0)} ${padding.top + chartH} Z`

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {[0, 0.5, 1].map((fraction, i) => {
          const y = padding.top + chartH * (1 - fraction)
          const val = Math.round(minSpeed + fraction * (maxSpeed - minSpeed))
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                fontSize="9"
                fill="#94a3b8"
                textAnchor="end"
                fontFamily="var(--font-mono)"
              >
                {val}
              </text>
            </g>
          )
        })}

        {/* Gradient fill area */}
        <path d={areaD} fill="url(#speedGrad)" />

        {/* Line Stroke */}
        <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />

        {/* Hover interaction columns */}
        {points.map((_, i) => {
          const x = getX(i)
          return (
            <rect
              key={i}
              x={x - (chartW / points.length) / 2}
              y={padding.top}
              width={chartW / points.length}
              height={chartH}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHoverIndex(i)}
            />
          )
        })}

        {/* Active Hover Marker */}
        {hoverIndex !== null && (
          <g>
            <line
              x1={getX(hoverIndex)}
              y1={padding.top}
              x2={getX(hoverIndex)}
              y2={padding.top + chartH}
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <circle
              cx={getX(hoverIndex)}
              cy={getY(Number(points[hoverIndex].speed ?? 0))}
              r="4.5"
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {/* Hover Tooltip Overlay */}
      {activePoint && hoverIndex !== null && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: `${(getX(hoverIndex) / width) * 100}%`,
            transform: 'translateX(-50%)',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '0.35rem 0.65rem',
            borderRadius: '6px',
            fontSize: '0.75rem',
            boxShadow: 'var(--shadow-lg)',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <div style={{ fontWeight: 700, color: '#38bdf8' }}>
            {Number(activePoint.speed ?? 0).toFixed(1)} km/h
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
            {formatISTTime(activePoint.timestamp)}
          </div>
        </div>
      )}
    </div>
  )
}
