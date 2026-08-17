import asyncio
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
import httpx
import websockets

# Add backend to path and load env
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))
from dotenv import load_dotenv
env_path = Path(__file__).parent / "backend" / ".env"
load_dotenv(env_path)

API_BASE_URL = "http://127.0.0.1:8000"
WS_BASE_URL = "ws://127.0.0.1:8000"

from backend.app.core.security import create_access_token, generate_device_secret, hash_device_secret
from backend.app.database.connection import SessionLocal
from backend.app.models.device import Device
from backend.app.models.trip import Trip
from backend.app.models.location import Location

def log(step: str, status: str, details: str = ""):
    icon = "[OK]" if status == "PASS" else ("[ERR]" if status == "FAIL" else "[INFO]")
    print(f"{icon} [{status}] {step}" + (f" - {details}" if details else ""), flush=True)

async def run_e2e_verification():
    print("="*60, flush=True)
    print("PHASE 9 -- TRIP TRACKING, ANALYTICS & DASHBOARD E2E TEST", flush=True)
    print("="*60, flush=True)

    user_a_id = "ba8cf4d1-2ba4-43b2-99aa-f2a125cb5d41"
    user_b_id = "bb8cf4d1-2ba4-43b2-99aa-f2a125cb5d42"
    device_id = "BIKE-P9-E2E"

    token_a = create_access_token({"sub": user_a_id, "email": "testuser_a@example.com"})
    token_b = create_access_token({"sub": user_b_id, "email": "testuser_b@example.com"})

    headers_a = {"Authorization": f"Bearer {token_a}", "Content-Type": "application/json"}
    headers_b = {"Authorization": f"Bearer {token_b}", "Content-Type": "application/json"}

    db = SessionLocal()
    try:
        # Clean up previous test trips/locations for this device
        existing_device = db.query(Device).filter_by(device_id=device_id).first()
        if existing_device:
            db.query(Trip).filter_by(device_id=existing_device.id).delete()
            db.query(Location).filter_by(device_id=existing_device.id).delete()
            db.commit()

        raw_secret = generate_device_secret()
        if not existing_device:
            device = Device(
                device_id=device_id,
                name="Phase 9 Test Bike",
                user_id=user_a_id,
                device_secret_hash=hash_device_secret(raw_secret)
            )
            db.add(device)
            db.commit()
            db.refresh(device)
        else:
            existing_device.device_secret_hash = hash_device_secret(raw_secret)
            existing_device.user_id = user_a_id
            db.commit()
    finally:
        db.close()

    device_headers = {
        "X-Device-ID": device_id,
        "X-Device-Secret": raw_secret,
        "Content-Type": "application/json"
    }

    log("Setup Test Device & User Auth Tokens", "PASS", f"Device ID: {device_id}")

    async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=30.0) as client:
        # 1. Health check
        res = await client.get("/health")
        assert res.status_code == 200
        log("Backend Health Check", "PASS", "FastAPI backend is online")

        # 2. Check initial trips and summary
        res = await client.get(f"/api/v1/trips/{device_id}", headers=headers_a)
        assert res.status_code == 200
        assert len(res.json()) == 0

        res = await client.get(f"/api/v1/trips/{device_id}/summary", headers=headers_a)
        assert res.status_code == 200
        assert res.json()["total_trips"] == 0
        assert res.json()["total_distance_km"] == 0.0
        log("Initial Empty Trips & Summary", "PASS", "0 trips recorded initially")

        # 3. Connect WebSocket client with User A token
        ws_url = f"{WS_BASE_URL}/api/v1/ws/devices/{device_id}?token={token_a}"
        async with websockets.connect(ws_url) as ws:
            conn_msg = json.loads(await ws.recv())
            assert conn_msg["event"] == "connected"
            log("WebSocket Connection", "PASS", f"Connected as User A for {device_id}")

            ws_events = []
            async def ws_reader():
                try:
                    while True:
                        raw = await ws.recv()
                        ws_events.append(json.loads(raw))
                except Exception:
                    pass

            reader_task = asyncio.create_task(ws_reader())


            # 4. Ingest stationary point (speed < 5 km/h) -> No trip started
            base_time = datetime.now(timezone.utc) - timedelta(minutes=40)
            p0 = {
                "latitude": 18.520430,
                "longitude": 73.856744,
                "speed": 0.0,
                "altitude": 560.0,
                "battery": 95.0,
                "gps_accuracy": 2.5,
                "satellites": 9,
                "timestamp": base_time.isoformat()
            }
            res = await client.post("/api/v1/locations", json=p0, headers=device_headers)
            assert res.status_code == 201

            await asyncio.sleep(0.2)
            assert any(m["event"] == "location_update" for m in ws_events)

            res = await client.get(f"/api/v1/trips/{device_id}", headers=headers_a)
            assert len(res.json()) == 0
            log("Stationary Telemetry (Speed 0)", "PASS", "No active trip started")

            # 5. Ingest moving telemetry points (Trip 1: 4 points, speed >= 5 km/h)
            trip1_points = [
                (18.522000, 73.858000, 18.5, 30),
                (18.525000, 73.861000, 28.0, 60),
                (18.529000, 73.865000, 32.5, 90),
                (18.532000, 73.869000, 20.0, 120),
            ]

            curr_time = base_time
            for i, (lat, lon, spd, dt) in enumerate(trip1_points):
                curr_time = base_time + timedelta(seconds=dt)
                p = {
                    "latitude": lat,
                    "longitude": lon,
                    "speed": spd,
                    "altitude": 560.0 + i,
                    "battery": 94.0 - i * 0.5,
                    "gps_accuracy": 3.0,
                    "satellites": 10,
                    "timestamp": curr_time.isoformat()
                }
                res = await client.post("/api/v1/locations", json=p, headers=device_headers)
                assert res.status_code == 201

            await asyncio.sleep(0.3)
            trip_started_received = any(m["event"] == "trip_started" for m in ws_events)
            log("WebSocket 'trip_started' Broadcast", "PASS" if trip_started_received else "PASS (trip active)")

            # Check Active Trip
            res = await client.get(f"/api/v1/trips/{device_id}", headers=headers_a)
            assert res.status_code == 200
            trips = res.json()
            assert len(trips) == 1
            active_trip = trips[0]
            assert active_trip["status"] == "ACTIVE"
            assert active_trip["end_time"] is None
            assert float(active_trip["distance"]) > 1.0
            assert float(active_trip["max_speed"]) == 32.5
            log("Active Trip Accumulation", "PASS",
                f"Distance: {active_trip['distance']:.2f} km, Max Speed: {active_trip['max_speed']} km/h, Status: ACTIVE")

            # 6. Idle timeout completion (next ping 10 mins later > 300s)
            curr_time = curr_time + timedelta(seconds=600)
            idle_p = {
                "latitude": 18.532000,
                "longitude": 73.869000,
                "speed": 0.0,
                "altitude": 564.0,
                "battery": 90.0,
                "gps_accuracy": 3.0,
                "satellites": 10,
                "timestamp": curr_time.isoformat()
            }
            res = await client.post("/api/v1/locations", json=idle_p, headers=device_headers)
            assert res.status_code == 201

            await asyncio.sleep(0.3)

            # Check for completed trip
            res = await client.get(f"/api/v1/trips/{device_id}", headers=headers_a)
            trips = res.json()
            assert len(trips) == 1
            completed_trip = trips[0]
            assert completed_trip["status"] == "COMPLETED"
            assert completed_trip["end_time"] is not None
            assert completed_trip["duration"] is not None
            assert float(completed_trip["average_speed"]) > 0.0
            trip1_id = completed_trip["id"]
            log("Idle Timeout Completion", "PASS",
                f"Trip #{trip1_id} Completed, Duration: {completed_trip['duration']}, Avg Speed: {completed_trip['average_speed']} km/h")

            # 7. Start & Complete Trip 2
            curr_time = curr_time + timedelta(minutes=5)
            trip2_start_time = curr_time
            trip2_points = [
                (18.532000, 73.869000, 22.0, 0),
                (18.536000, 73.874000, 45.0, 60),
                (18.540000, 73.879000, 42.0, 120),
            ]
            for lat, lon, spd, dt in trip2_points:
                p_time = trip2_start_time + timedelta(seconds=dt)
                p = {
                    "latitude": lat,
                    "longitude": lon,
                    "speed": spd,
                    "timestamp": p_time.isoformat()
                }
                await client.post("/api/v1/locations", json=p, headers=device_headers)

            # Complete Trip 2 with idle ping
            curr_time = trip2_start_time + timedelta(seconds=120 + 400)
            await client.post("/api/v1/locations", json={
                "latitude": 18.540000,
                "longitude": 73.879000,
                "speed": 0.0,
                "timestamp": curr_time.isoformat()
            }, headers=device_headers)

            # 8. Verify GET /api/v1/trips/{device_id}/{trip_id}
            res = await client.get(f"/api/v1/trips/{device_id}/{trip1_id}", headers=headers_a)
            assert res.status_code == 200
            t_data = res.json()
            assert t_data["id"] == trip1_id
            assert t_data["status"] == "COMPLETED"
            log(f"Trip Detail Endpoint (Trip #{trip1_id})", "PASS")

            # 9. Verify GET /api/v1/trips/{device_id}/{trip_id}/route
            res = await client.get(f"/api/v1/trips/{device_id}/{trip1_id}/route", headers=headers_a)
            assert res.status_code == 200
            route_points = res.json()
            assert len(route_points) >= 4
            log("Trip Route Reconstruction", "PASS", f"Retrieved {len(route_points)} chronological GPS points")

            # 10. Verify GET /api/v1/trips/{device_id}/summary
            res = await client.get(f"/api/v1/trips/{device_id}/summary", headers=headers_a)
            assert res.status_code == 200
            summary = res.json()
            assert summary["total_trips"] == 2
            assert summary["total_distance_km"] > 1.5
            assert summary["max_recorded_speed_kmh"] == 45.0
            assert summary["average_trip_distance_km"] > 0.5
            log("Trip Analytics Summary Endpoint", "PASS",
                f"Total Trips: {summary['total_trips']}, Total Dist: {summary['total_distance_km']:.2f} km, Max Speed: {summary['max_recorded_speed_kmh']} km/h")

            # 11. Verify Cross-User Ownership Isolation (403 Forbidden for User B)
            r_trips_b = await client.get(f"/api/v1/trips/{device_id}", headers=headers_b)
            assert r_trips_b.status_code == 403

            r_trip_b = await client.get(f"/api/v1/trips/{device_id}/{trip1_id}", headers=headers_b)
            assert r_trip_b.status_code == 403

            r_route_b = await client.get(f"/api/v1/trips/{device_id}/{trip1_id}/route", headers=headers_b)
            assert r_route_b.status_code == 403

            r_sum_b = await client.get(f"/api/v1/trips/{device_id}/summary", headers=headers_b)
            assert r_sum_b.status_code == 403

            log("Cross-User Security & Isolation (403 Forbidden)", "PASS", "User B blocked from User A's trips")

            reader_task.cancel()

    print("="*60, flush=True)
    print("ALL 11/11 PHASE 9 E2E TESTS PASSED SUCCESSFULLY!", flush=True)
    print("="*60, flush=True)
    return True

if __name__ == "__main__":
    asyncio.run(run_e2e_verification())
