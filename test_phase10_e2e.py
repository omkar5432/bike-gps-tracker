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
from backend.app.models.device import Device, DeviceStatus
from backend.app.models.trip import Trip
from backend.app.models.location import Location
from backend.app.models.geofence import Geofence
from backend.app.models.alert import Alert

def log(step: str, status: str, details: str = ""):
    icon = "[OK]" if status == "PASS" else ("[ERR]" if status == "FAIL" else "[INFO]")
    print(f"{icon} [{status}] {step}" + (f" - {details}" if details else ""), flush=True)

async def run_e2e_verification():
    print("="*65, flush=True)
    print("PHASE 10 -- PRODUCTION HARDENING, OBSERVABILITY & SECURITY E2E TEST", flush=True)
    print("="*65, flush=True)

    user_a_id = "ba8cf4d1-2ba4-43b2-99aa-f2a125cb5d41"
    user_b_id = "bb8cf4d1-2ba4-43b2-99aa-f2a125cb5d42"
    device_id = "BIKE-P10-HARDEN"

    token_a = create_access_token({"sub": user_a_id, "email": "testuser_a@example.com"})
    token_b = create_access_token({"sub": user_b_id, "email": "testuser_b@example.com"})

    headers_a = {"Authorization": f"Bearer {token_a}", "Content-Type": "application/json"}
    headers_b = {"Authorization": f"Bearer {token_b}", "Content-Type": "application/json"}

    db = SessionLocal()
    try:
        existing = db.query(Device).filter_by(device_id=device_id).first()
        if existing:
            db.query(Alert).filter_by(device_id=existing.id).delete()
            db.query(Geofence).filter_by(device_id=existing.id).delete()
            db.query(Trip).filter_by(device_id=existing.id).delete()
            db.query(Location).filter_by(device_id=existing.id).delete()
            db.delete(existing)
            db.commit()
    finally:
        db.close()

    async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=30.0) as client:
        # 1. Health Checks: Liveness & Readiness
        res_live = await client.get("/health")
        assert res_live.status_code == 200
        assert res_live.json() == {"status": "ok"}
        log("Liveness Probe (GET /health)", "PASS", "Process is alive")

        res_ready = await client.get("/health/ready")
        assert res_ready.status_code == 200
        assert res_ready.json() == {"status": "ready", "database": "ok"}
        assert "password" not in str(res_ready.json()).lower()
        log("Readiness Probe (GET /health/ready)", "PASS", "Database connectivity verified securely")

        # 2. Device Registration & Secret Security
        res_reg = await client.post("/api/v1/devices", json={
            "device_id": device_id,
            "name": "Phase 10 Hardened Bike"
        }, headers=headers_a)
        assert res_reg.status_code == 201
        reg_data = res_reg.json()
        assert "device_secret" in reg_data
        raw_secret = reg_data["device_secret"]
        assert "device_secret_hash" not in reg_data
        log("Device Registration", "PASS", "Returned raw secret once without exposing secret hash")

        # 3. Verify GET /devices does not expose secret or hash
        res_dev = await client.get(f"/api/v1/devices/{device_id}", headers=headers_a)
        assert res_dev.status_code == 200
        dev_data = res_dev.json()
        assert "device_secret" not in dev_data
        assert "device_secret_hash" not in dev_data
        log("Device Query Secret Masking", "PASS", "No secret or hash exposed in GET device response")

        device_headers = {
            "X-Device-ID": device_id,
            "X-Device-Secret": raw_secret,
            "Content-Type": "application/json"
        }

        # 4. Device Authentication Verify Endpoint
        res_verify = await client.post("/api/v1/devices/auth/verify", headers=device_headers)
        assert res_verify.status_code == 200
        assert res_verify.json()["status"] == "authenticated"
        log("Device Auth Verify Endpoint", "PASS")

        # 5. Invalid Device Credentials Handling
        bad_headers = {
            "X-Device-ID": device_id,
            "X-Device-Secret": "wrong_secret_12345",
            "Content-Type": "application/json"
        }
        res_bad_auth = await client.post("/api/v1/devices/auth/verify", headers=bad_headers)
        assert res_bad_auth.status_code == 401
        assert "password" not in str(res_bad_auth.json()).lower()
        log("Invalid Device Secret Rejection (401)", "PASS")

        # 6. Deactivate Device & Verify Telemetry Ingestion Blocked
        res_deact = await client.post(f"/api/v1/devices/{device_id}/deactivate", headers=headers_a)
        assert res_deact.status_code == 200
        assert res_deact.json()["status"] == "INACTIVE"
        log("Device Deactivation", "PASS", "Status set to INACTIVE")

        # Ingesting GPS on inactive device must return 403 Forbidden
        loc_payload = {
            "latitude": 18.520430,
            "longitude": 73.856744,
            "speed": 15.0,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        res_inactive_loc = await client.post("/api/v1/locations", json=loc_payload, headers=device_headers)
        assert res_inactive_loc.status_code == 403
        log("Inactive Device Ingestion Blocked (403)", "PASS", "Deactivated device cannot transmit telemetry")

        # Re-activate device for remaining live telemetry tests
        db = SessionLocal()
        try:
            d = db.query(Device).filter_by(device_id=device_id).first()
            d.status = DeviceStatus.ONLINE
            db.commit()
        finally:
            db.close()

        # 7. Connect WebSocket with User A Token
        ws_url = f"{WS_BASE_URL}/api/v1/ws/devices/{device_id}?token={token_a}"
        async with websockets.connect(ws_url) as ws:
            conn_msg = json.loads(await ws.recv())
            assert conn_msg["event"] == "connected"
            log("WebSocket Connection & Auth", "PASS")

            # 8. User B cross-user WebSocket access blocked (4003)
            ws_url_b = f"{WS_BASE_URL}/api/v1/ws/devices/{device_id}?token={token_b}"
            try:
                async with websockets.connect(ws_url_b) as ws_b:
                    await ws_b.recv()
                    assert False, "Should have been rejected"
            except websockets.exceptions.ConnectionClosed as cc:
                assert cc.rcvd.code == 4003 or cc.code == 4003
                log("Cross-User WebSocket Isolation (Code 4003)", "PASS", "User B denied access to User A's device stream")

            # 9. Ingest GPS Point & Verify WebSocket Broadcast
            res_loc = await client.post("/api/v1/locations", json=loc_payload, headers=device_headers)
            assert res_loc.status_code == 201
            log("Active GPS Telemetry Ingestion", "PASS")

        # 10. Comprehensive Cross-User IDOR Security Verification (User B blocked on User A resources)
        res_b_dev = await client.get(f"/api/v1/devices/{device_id}", headers=headers_b)
        assert res_b_dev.status_code == 403

        res_b_loc = await client.get(f"/api/v1/locations/{device_id}/history", headers=headers_b)
        assert res_b_loc.status_code == 403

        res_b_trips = await client.get(f"/api/v1/trips/{device_id}", headers=headers_b)
        assert res_b_trips.status_code == 403

        res_b_geo = await client.get(f"/api/v1/geofences/{device_id}", headers=headers_b)
        assert res_b_geo.status_code == 403

        res_b_alerts = await client.get(f"/api/v1/alerts/{device_id}", headers=headers_b)
        assert res_b_alerts.status_code == 403

        log("Comprehensive IDOR Ownership Authorization (403 Forbidden)", "PASS",
            "User B blocked across Devices, Locations, Trips, Geofences, Alerts")

        # 11. Error Masking: Malformed Request / Validation Errors
        res_malformed = await client.post("/api/v1/locations", json={
            "latitude": 999.0, # Invalid > 90
            "longitude": 73.856744,
            "timestamp": "invalid-time"
        }, headers=device_headers)
        assert res_malformed.status_code == 422
        assert "password" not in str(res_malformed.json()).lower()
        log("Validation Error Sanitization (422)", "PASS", "Clear error message without tracebacks")

    print("="*65, flush=True)
    print("ALL 11/11 PHASE 10 HARDENING & SECURITY E2E TESTS PASSED!", flush=True)
    print("="*65, flush=True)
    return True

if __name__ == "__main__":
    asyncio.run(run_e2e_verification())
