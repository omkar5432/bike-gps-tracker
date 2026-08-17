# Bike GPS Tracker

A production‑grade personal bike GPS tracking system.

## Overview

This repository contains the full stack for the Bike GPS Tracker project, including:
- **Firmware** (C++/Arduino) for the ESP32‑S3 device
- **Simulator** (Python) to emulate the device during development
- **Backend** (FastAPI) handling authentication, location storage, trip detection, geofencing and real‑time updates
- **Frontend** (React + Vite) providing a rich web dashboard

## Development

The project uses Docker Compose for easy local development. See `docker-compose.yml` for the services.

### Quick start

```bash
# Clone the repo
git clone <repo-url>
cd "Bike GPS Tracker"

# Copy the example env file and edit as needed
cp .env.example .env

# Start all services
docker compose up --build
```

The backend will be available at `http://localhost:8000` and the frontend at `http://localhost:3000`.

## Project Structure

```
Bike GPS Tracker/
├─ backend/
│  └─ app/
│     ├─ __init__.py
│     └─ main.py
├─ frontend/
│  └─ src/ ...
├─ simulator/
│  └─ simulator.py
├─ firmware/
│  └─ ...
├─ docker-compose.yml
├─ .env.example
├─ .gitignore
└─ README.md
```

## Database & Migration Setup

The backend utilizes **PostgreSQL** with the **PostGIS** extension for spatial geolocation storage and queries.

### 1. Environment Configuration

Copy the example environment file and configure `DATABASE_URL`:
```bash
cp .env.example .env
```

Ensure `.env` contains your PostgreSQL connection string:
```ini
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>
```

### 2. Running Database Migrations

Alembic is configured to handle database migrations with PostGIS support.

```bash
# Navigate to backend directory
cd backend

# Apply migrations to the latest revision
alembic upgrade head

# Roll back the most recent migration
alembic downgrade -1

# Create a new migration revision
alembic revision --autogenerate -m "description_of_changes"
```

### 3. Running the Test Suite

Run unit and integration tests for all models and database constraints:
```bash
# Run full test suite with verbose output
pytest -v backend/tests

# Run a specific test file
pytest backend/tests/test_location.py
```

## Database Schema & Models

- **`User`**: Account authentication (`email`, `password_hash`, timestamps).
- **`Device`**: Tracking hardware entity (`device_id`, `name`, `imei`, `status`, `last_seen`, `owner_id`).
- **`Location`**: GPS telemetry with PostGIS `Geography(POINT, 4326)`, coordinate bounds, speed, battery, and satellites constraints.
- **`Trip`**: Computed ride trips (`distance_km`, `max_speed`, `avg_speed`, `duration_seconds`, start/end points).
- **`Geofence`**: Safe zones with center coordinates, radius, and PostGIS `Geography(POINT, 4326)` geometry.
- **`Alert`**: System alerts (`GEOFENCE_ENTER`, `GEOFENCE_EXIT`, `LOW_BATTERY`, `SPEEDING`, `TAMPER`, `FALL_DETECTED`, `MOVEMENT_UNAUTHORIZED`, `DEVICE_OFFLINE`).

## Device Registration & Authentication (Phase 3)

### 1. User-Authenticated Device Registration

Users authenticated via Supabase JWT register devices. The system generates a cryptographically secure random secret, hashes it with `bcrypt`, stores `device_secret_hash`, and returns the raw secret **only once**.

```http
POST /api/v1/devices
Authorization: Bearer <SUPABASE_JWT_ACCESS_TOKEN>
Content-Type: application/json

{
  "device_id": "BIKE001",
  "name": "My Mountain Bike",
  "imei": "354123456789012"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "device_id": "BIKE001",
  "name": "My Mountain Bike",
  "imei": "354123456789012",
  "status": "OFFLINE",
  "created_at": "2026-08-15T12:00:00Z",
  "device_secret": "zX9K8_generated_secret_string..."
}
```

### 2. Device Listing & Details

```http
GET /api/v1/devices
Authorization: Bearer <SUPABASE_JWT_ACCESS_TOKEN>
```

```http
GET /api/v1/devices/{device_id}
Authorization: Bearer <SUPABASE_JWT_ACCESS_TOKEN>
```
*Note: Neither `device_secret` nor `device_secret_hash` is ever returned in GET responses.*

### 3. IoT Device Authentication

Hardware GPS devices (or simulators) authenticate requests using HTTP headers:

```http
POST /api/v1/devices/auth/verify
X-Device-ID: BIKE001
X-Device-Secret: <RAW_DEVICE_SECRET>
```

**Response (200 OK):**
```json
{
  "status": "authenticated",
  "device_id": "BIKE001",
  "device_status": "ONLINE",
  "last_seen": "2026-08-15T12:05:00Z"
}
```

## Location Ingestion API (Phase 4)

### 1. GPS Telemetry Ingestion

GPS devices and simulators send location telemetry using the same device authentication mechanism:

```http
POST /api/v1/locations
X-Device-ID: BIKE001
X-Device-Secret: <RAW_DEVICE_SECRET>
Content-Type: application/json

{
  "latitude": 18.520430,
  "longitude": 73.856744,
  "speed": 42.5,
  "altitude": 560.2,
  "battery": 87.0,
  "gps_accuracy": 5.2,
  "satellites": 9,
  "timestamp": "2026-08-15T10:30:00Z"
}
```

**Response (201 Created):**
```json
{
  "id": 123,
  "device_id": "BIKE001",
  "latitude": 18.520430,
  "longitude": 73.856744,
  "speed": 42.5,
  "altitude": 560.2,
  "battery": 87.0,
  "gps_accuracy": 5.2,
  "satellites": 9,
  "timestamp": "2026-08-15T10:30:00Z",
  "created_at": "2026-08-15T10:30:01Z"
}
```

### 2. Location Validation

The API validates all incoming telemetry:
- **Latitude**: -90 to +90 degrees
- **Longitude**: -180 to +180 degrees
- **Speed**: Non-negative (km/h)
- **Battery**: 0 to 100 percent
- **GPS Accuracy**: Non-negative (meters)
- **Satellites**: Non-negative count
- **Timestamp**: Must be timezone-aware (UTC)

### 3. PostGIS Geometry

Location coordinates are automatically converted to PostGIS `Geography(POINT, 4326)` format for spatial queries. The geometry is stored as `POINT(longitude latitude)`.

### 4. Device State Updates

Successful location ingestion automatically:
- Updates device `last_seen` timestamp
- Sets device status to `ONLINE`
- Persists location with PostGIS geometry

## GPS Simulator (Phase 4)

The simulator emulates physical GPS hardware for development and testing.

### Usage

```bash
# Basic run with device ID and Secret
python simulator/simulator.py --device-id BIKE001 --device-secret <YOUR_DEVICE_SECRET>

# Custom route, speed, and interval
python simulator/simulator.py \
  --device-id BIKE001 \
  --device-secret <YOUR_DEVICE_SECRET> \
  --latitude 18.520430 \
  --longitude 73.856744 \
  --speed 30.0 \
  --interval 5 \
  --api-url http://localhost:8000
```

### CLI Options

- `--device-id`: Hardware Device ID (default: `BIKE001`)
- `--device-secret`: Device Secret token generated during registration
- `--api-url`: FastAPI backend URL (default: `http://localhost:8000`)
- `--interval`: Telemetry ping interval in seconds (default: `5.0`)
- `--latitude`: Starting latitude in decimal degrees (default: `18.520430`)
- `--longitude`: Starting longitude in decimal degrees (default: `73.856744`)
- `--speed`: Movement speed in km/h (default: `25.0`)
- `--battery`: Starting battery percentage (default: `100.0`)
- `--max-steps`: Maximum pings to send (0 for continuous)
- `--retry-delay`: Seconds to wait before retry on network failure (default: `3.0`)

### Simulator Features

- Realistic GPS coordinate progression along smooth trajectories
- Gradual battery discharge simulation
- Speed and heading variation
- Realistic GPS accuracy and satellite count
- Network retry handling with configurable delays
- Secure logging (never exposes device secrets)

### Data Flow

```
GPS Simulator
      ↓
Device Authentication (X-Device-ID, X-Device-Secret)
      ↓
POST /api/v1/locations
      ↓
Location Validation (Pydantic schemas)
      ↓
Location Service (PostGIS geometry creation)
      ↓
PostgreSQL/PostGIS (spatial data storage)
      ↓
Device State Update (last_seen, status)
```

## Real-Time GPS Tracking with WebSocket (Phase 5)

### 1. WebSocket Endpoint

The backend provides a WebSocket endpoint for real-time GPS tracking updates:

```
ws://localhost:8000/api/v1/ws/devices/{device_id}?token={JWT_TOKEN}
```

### 2. Authentication

WebSocket connections require Supabase JWT authentication via query parameter:

- **Token**: Valid Supabase JWT access token
- **Authorization**: User must own the requested device
- **Example**: `ws://localhost:8000/api/v1/ws/devices/BIKE001?token=eyJhbGciOi...`

**Note**: Browsers cannot send custom headers in WebSocket handshake, so the JWT is passed as a query parameter. The token is validated server-side and user ownership is verified before allowing the connection.

### 3. Message Format

#### Connected Event
```json
{
    "event": "connected",
    "data": {
        "device_id": "BIKE001",
        "timestamp": "2026-08-15T00:00:00Z"
    }
}
```

#### Location Update Event
```json
{
    "event": "location_update",
    "data": {
        "id": 123,
        "device_id": "BIKE001",
        "latitude": 18.520430,
        "longitude": 73.856744,
        "speed": 42.5,
        "altitude": 560.2,
        "battery": 87.0,
        "gps_accuracy": 5.2,
        "satellites": 9,
        "timestamp": "2026-08-15T10:30:00Z"
    }
}
```

### 4. Architecture

```
GPS Device / Simulator
        ↓
POST /api/v1/locations
        ↓
Device Authentication
        ↓
Location Validation
        ↓
PostgreSQL/PostGIS (persist location)
        ↓
WebSocket Manager (broadcast)
        ↓
Authorized Connected Clients
```

### 5. Connection Management

- **Multiple Clients**: Multiple authorized clients can subscribe to the same device
- **Ownership Verification**: Users can only connect to devices they own
- **Automatic Cleanup**: Disconnected clients are automatically removed
- **Error Handling**: Failed broadcasts don't affect location persistence

### 6. Security

- JWT tokens are validated before allowing connections
- Device ownership is enforced via database checks
- No secrets (device secrets, JWT tokens) are exposed in WebSocket messages
- Unauthorized connections are rejected with appropriate error codes

### 7. Limitations

The current implementation uses an in-memory WebSocket manager, which is suitable for single-instance deployments. For multi-instance deployments, a shared pub/sub layer (e.g., Redis) would be required to distribute WebSocket messages across instances.

## React Frontend Dashboard (Phase 6)

### 1. Frontend Setup

The React frontend provides a live GPS tracking dashboard with real-time updates via WebSocket.

**Technology Stack:**
- React 19 with TypeScript
- Vite for build tooling
- React Router for navigation
- Supabase Auth for authentication
- MapLibre GL JS for live mapping
- MapTiler for map tiles

### 2. Environment Configuration

Create `frontend/.env` based on `frontend/.env.example`:

```bash
# Backend API URL
VITE_API_BASE_URL=http://localhost:8000

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Map Provider (MapTiler)
VITE_MAPTILER_API_KEY=your_maptiler_api_key
```

**Important:** Never commit actual API keys or secrets. Use placeholder values in `.env.example` only.

### 3. Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 4. Authentication Flow

The frontend uses Supabase Auth for user authentication:

1. User enters email/password on login page
2. Frontend authenticates with Supabase
3. Supabase returns JWT access token
4. Frontend uses token for API requests via `Authorization: Bearer <token>` header
5. Backend validates token and authorizes requests

**Note:** The frontend never manually decodes or trusts JWT payloads for authorization. The backend remains responsible for all authorization decisions.

### 5. Dashboard Features

**Device List:**
- Displays all devices owned by the authenticated user
- Shows device name, ID, status, and last seen time
- Allows device selection for live tracking

**Live Map:**
- Displays selected device on interactive map
- Shows real-time location updates via WebSocket
- Centers map on device location
- Displays connection status indicator

**Telemetry Panel:**
- Real-time speed display
- Battery percentage
- GPS accuracy
- Satellite count
- Altitude
- Coordinates
- Last update timestamp

### 6. WebSocket Integration

The frontend connects to the Phase 5 WebSocket endpoint:

```
ws://localhost:8000/api/v1/ws/devices/{device_id}?token={JWT}
```

**Features:**
- Automatic reconnection with exponential backoff
- Connection status indicators (Live, Connecting, Disconnected, Error)
- Real-time location updates
- Proper cleanup on device change or logout

### 7. Architecture

```
React Frontend
    ↓
Supabase Auth
    ↓
FastAPI Backend (JWT validation)
    ↓
Device List API
    ↓
WebSocket Connection
    ↓
Real-time Location Updates
    ↓
MapLibre GL JS
    ↓
Live Map Display
```

### 8. Security

- No database credentials in frontend code
- No service role keys in frontend
- JWT tokens obtained from Supabase session
- Device secrets never displayed
- WebSocket URLs not logged
- Backend enforces all authorization
- Users can only access their own devices

### 9. CORS Configuration

The backend is configured to allow requests from the Vite dev server (`http://localhost:5173`) for local development.


## Geofencing & Real-Time Alerts (Phase 8)

### 1. Overview & Architecture

Phase 8 introduces geofence safe zone monitoring, automatic state transition detection (ENTER / EXIT), overspeed detection, persistent alert management, and real-time alert broadcasting through WebSockets.

```
GPS Device / Simulator
        ↓
POST /api/v1/locations
        ↓
Persist GPS Telemetry
        ↓
Evaluate Enabled Geofences & Speed Limits
        ↓
State Transition Detected (Outside ⇄ Inside or Overspeed)
        ↓
Create & Persist Alert (bike_gps.alerts)
        ↓
WebSocket Broadcast ("alert" event)
        ↓
Frontend Live Toast & Alerts Tab
```

### 2. Geofence REST API

All geofence operations require Supabase JWT authentication. Strict device ownership is validated for every request.

- **Create Geofence**: `POST /api/v1/geofences/{device_id}`
  ```json
  {
    "name": "Home Safe Zone",
    "latitude": 18.520430,
    "longitude": 73.856744,
    "radius": 300.0,
    "enabled": true
  }
  ```
- **List Geofences**: `GET /api/v1/geofences/{device_id}`
- **Get Specific Geofence**: `GET /api/v1/geofences/{device_id}/{geofence_id}`
- **Update Geofence**: `PUT /api/v1/geofences/{device_id}/{geofence_id}`
- **Enable Geofence**: `PATCH /api/v1/geofences/{device_id}/{geofence_id}/enable`
- **Disable Geofence**: `PATCH /api/v1/geofences/{device_id}/{geofence_id}/disable`
- **Delete Geofence**: `DELETE /api/v1/geofences/{device_id}/{geofence_id}`

### 3. Alert REST API

- **List Alerts**: `GET /api/v1/alerts/{device_id}?limit=50&unacknowledged_only=false`
  - Returns newest alerts first.
  - Supports filtering by unacknowledged status.
- **Acknowledge Alert**: `PATCH /api/v1/alerts/{device_id}/{alert_id}/acknowledge`
  - Sets `acknowledged = true` and `acknowledged_at = NOW()`.

### 4. Real-Time WebSocket Alerts

Alerts are broadcast over the existing WebSocket connection (`/api/v1/ws/devices/{device_id}?token={JWT}`).

**Alert Event Payload:**
```json
{
  "event": "alert",
  "data": {
    "id": 123,
    "device_id": "BIKE-P7-E2E",
    "type": "GEOFENCE_ENTER",
    "message": "Bike entered geofence: Home Safe Zone",
    "latitude": 18.520430,
    "longitude": 73.856744,
    "created_at": "2026-08-16T12:00:00Z",
    "acknowledged": false
  }
}
```

### 5. Detection Logic & State Transitions

- **Distance Calculation**: Uses great-circle Haversine formula between the GPS coordinate and the geofence center point.
- **Transition Rule**:
  - `OUTSIDE -> INSIDE` = `GEOFENCE_ENTER` alert generated.
  - `INSIDE -> OUTSIDE` = `GEOFENCE_EXIT` alert generated.
  - Steady states (`INSIDE -> INSIDE` or `OUTSIDE -> OUTSIDE`) do **not** trigger redundant alerts.
- **Overspeed Alert**:
  - Configurable via `OVERSPEED_THRESHOLD_KMH` environment variable (default: `80.0` km/h).
  - Triggers an `OVERSPEED` alert on exceeding threshold, with duplicate suppression for continuous speeding across consecutive pings.
- **Disabled Geofences**: Excluded from transition checks and do not trigger alerts.

### 6. Frontend Dashboard Integration

- **Live Map**: Visualizes enabled geofences as circular zones with boundary lines and click tooltips on the MapLibre map. Automatically cleans up and reloads when switching devices.
- **Geofences Tab**: View configured geofences, toggle active state, delete zones, and create new geofences manually or using "Use Current GPS".
- **Alerts Tab**: Chronological alert log with type indicators (ENTER, EXIT, OVERSPEED, OFFLINE), coordinate links, and one-click acknowledgement.
- **Real-Time Toasts**: Instant pop-up banners when new alerts are received via WebSocket without needing page refreshes.

---

## Trip Tracking, Trip Analytics & Dashboard Improvements (Phase 9)

Phase 9 introduces automated trip lifecycle detection, historical route reconstruction, ride analytics, and enhanced dashboard visualization using the existing `bike_gps.trips` and `bike_gps.locations` database tables.

### 1. Automatic Trip Lifecycle Engine

- **Trip Start Threshold**: Configurable via `TRIP_START_SPEED_KMH` (default: `5.0` km/h). When a stationary device starts moving ($\ge 5$ km/h), a new active trip is created (`status: ACTIVE`, `end_time: null`).
- **Distance & Speed Accumulation**: Each consecutive telemetry point computes Haversine distance from the previous point, updating cumulative distance, running duration, maximum speed, and average speed.
- **GPS Jump Filtering**: Configurable via `MAX_GPS_JUMP_SPEED_KMH` (default: `150.0` km/h). Unrealistic distance spikes (e.g. GPS multipath anomalies) are filtered out from distance accumulation.
- **Idle Timeout Completion**: Configurable via `TRIP_IDLE_TIMEOUT_SECONDS` (default: `300` s / 5 min). If the device stays idle/stopped for $> 300$ seconds, the active trip is closed (`status: COMPLETED`, `end_time` set, final duration and average speed calculated).

### 2. Trip REST APIs

- **List Device Trips**: `GET /api/v1/trips/{device_id}?limit=20`
  - Returns recent trips ordered newest first with status (`ACTIVE` or `COMPLETED`), formatted duration, distance, max speed, and average speed.
- **Get Specific Trip**: `GET /api/v1/trips/{device_id}/{trip_id}`
  - Retrieves single trip details verifying device ownership (returns 403/404 if unauthorized).
- **Get Trip Route**: `GET /api/v1/trips/{device_id}/{trip_id}/route`
  - Reconstructs all GPS location points recorded during the trip in chronological order.
- **Get Device Trip Summary**: `GET /api/v1/trips/{device_id}/summary`
  - Returns aggregated analytics: `total_trips`, `total_distance_km`, `average_trip_distance_km`, `longest_trip_distance_km`, `max_recorded_speed_kmh`, and `last_trip_start_time`.

### 3. Real-Time Trip WebSocket Events

- When a trip starts: `event: "trip_started"` with trip payload.
- When an active trip completes: `event: "trip_completed"` with finalized metrics.
- Connected dashboard instances automatically refresh trip logs and summary analytics on receiving these events.

### 4. Frontend Dashboard Enhancements

- **Trip Analytics Summary Cards**: Top summary display showing Total Trips, Total Distance, Average Trip Distance, and Maximum Speed.
- **Rich Trip Cards & Status Badges**: Shows active rides (`🟢 Active Ride`) vs finished rides (`✓ Completed`), formatted timestamps, duration, distance, and speed metrics.
- **Interactive Route Inspection**: Clicking "🗺️ View Route" draws the historical ride path in purple (`#7c3aed`) on MapLibre, places Start (🏁) and End (🛑) markers, and automatically fits the map viewport.
- **Return to Live Tracking**: Floating header banner allows one-click switching back to live device tracking without reloading the page.

---

## Production Hardening, Observability & Reliability (Phase 10)

Phase 10 hardens the system for production deployment with strict environment validation, health check probes, global error masking, safe structured logging, in-memory rate limiting, and cross-user authorization enforcement.

### 1. Centralized Configuration Validation
- Validates all critical environment variables (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `JWT_SECRET_KEY`, etc.) during application startup via `backend/app/core/config.py`.
- Fails fast on missing configuration without ever printing secret values or connection credentials.

### 2. Observability & Health Probes
- `GET /health`: Fast liveness probe (`{"status": "ok"}`) for container orchestrators.
- `GET /health/ready`: Readiness probe verifying live database connectivity (`{"status": "ready", "database": "ok"}` or HTTP 503 Service Unavailable). Connection strings and database credentials are fully masked.
- **Structured Request Logging**: Measures request latency in milliseconds and records endpoints safely while stripping `Authorization` headers, JWT tokens, and sensitive query parameters.

### 3. Global Error Handling & Exception Masking
- Unhandled server exceptions, validation errors, and database errors are intercepted by global exception handlers in `backend/app/main.py`.
- Returns sanitized JSON error details (`{"detail": "..."}`) to clients while recording full error traces only in private server logs.

### 4. In-Memory Rate Limiting
- Provides lightweight sliding-window abuse protection in `backend/app/core/rate_limiter.py` per client IP.
- Safeguards authentication, device registration, and WebSocket connection attempts without requiring external caching infrastructure like Redis.

### 5. Security & IDOR Enforcement
- Constant-time verification for hardware device secrets.
- Enforces strict user ownership checks across all endpoints (`/devices`, `/locations`, `/trips`, `/geofences`, `/alerts`, `/ws/devices`).
- Prevents deactivated devices (`status: INACTIVE`) from transmitting telemetry.

## Contributing

Please follow the code-quality and security guidelines outlined in the project documentation.



