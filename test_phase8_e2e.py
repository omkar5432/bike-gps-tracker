import asyncio
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone
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
from backend.app.models.geofence import Geofence
from backend.app.models.alert import Alert

from backend.app.models.trip import Trip
from backend.app.models.location import Location

async def run_e2e_verification():
    print("==================================================", flush=True)
    print("PHASE 8 -- GEOFENCING & REAL-TIME ALERTS E2E TEST", flush=True)
    print("==================================================", flush=True)

    db = SessionLocal()
    user_a_id = "ba8cf4d1-2ba4-43b2-99aa-f2a125cb5d41"
    user_b_id = "bb8cf4d1-2ba4-43b2-99aa-f2a125cb5d42"
    device_id = "BIKE-P7-E2E"

    token_a = create_access_token({"sub": user_a_id, "email": "testuser_a@example.com"})
    token_b = create_access_token({"sub": user_b_id, "email": "testuser_b@example.com"})

    headers_a = {"Authorization": f"Bearer {token_a}", "Content-Type": "application/json"}
    headers_b = {"Authorization": f"Bearer {token_b}", "Content-Type": "application/json"}

    # 1. Ensure BIKE-P7-E2E exists and belongs to user_a
    device = db.query(Device).filter_by(device_id=device_id).first()
    raw_secret = generate_device_secret()
    if not device:
        device = Device(
            device_id=device_id,
            name="Phase 8 Test Bike",
            user_id=user_a_id,
            device_secret_hash=hash_device_secret(raw_secret)
        )
        db.add(device)
        db.commit()
        db.refresh(device)
    else:
        device.device_secret_hash = hash_device_secret(raw_secret)
        device.user_id = user_a_id
        db.commit()

    device_headers = {
        "X-Device-ID": device_id,
        "X-Device-Secret": raw_secret,
        "Content-Type": "application/json"
    }

    # Clean old test geofences, alerts, trips & locations for this device
    db.query(Alert).filter_by(device_id=device.id).delete()
    db.query(Geofence).filter_by(device_id=device.id).delete()
    db.query(Trip).filter_by(device_id=device.id).delete()
    db.query(Location).filter_by(device_id=device.id).delete()
    db.commit()
    db.close()

    print(f"\n[STEP 1 & 2] Authenticated User A and selected device: {device_id}", flush=True)

    async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=15.0) as http_client:
        # Connect WebSocket
        ws_url = f"{WS_BASE_URL}/api/v1/ws/devices/{device_id}?token={token_a}"
        print(f"Connecting to WebSocket: {ws_url[:55]}...", flush=True)

        async with websockets.connect(ws_url) as ws:
            # 1st message is "connected"
            conn_msg = json.loads(await ws.recv())
            assert conn_msg["event"] == "connected"
            print("[PASS] WebSocket connected event received successfully", flush=True)

            # 3 & 4. Create Geofence around (18.520430, 73.856744) radius 300m
            geo_payload = {
                "name": "E2E Test Safe Zone",
                "latitude": 18.520430,
                "longitude": 73.856744,
                "radius": 300.0,
                "enabled": True
            }
            res_create = await http_client.post(f"/api/v1/geofences/{device_id}", json=geo_payload, headers=headers_a)
            assert res_create.status_code == 201, f"Create geofence failed: {res_create.text}"
            geo_data = res_create.json()
            geofence_id = geo_data["id"]
            print(f"[PASS] [STEP 4 & 5] Created Geofence: ID={geofence_id}, Name='{geo_data['name']}', Radius={geo_data['radius']}m", flush=True)

            # 6 & 7. Send initial GPS location INSIDE geofence
            # Background task to continuously accumulate all WebSocket messages
            ws_events = []
            async def ws_reader():
                try:
                    while True:
                        raw = await ws.recv()
                        ws_events.append(json.loads(raw))
                except Exception:
                    pass

            reader_task = asyncio.create_task(ws_reader())

            # 6 & 7. Send initial location inside geofence
            loc1 = {
                "latitude": 18.520430,
                "longitude": 73.856744,
                "speed": 15.0,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            res_loc1 = await http_client.post("/api/v1/locations", json=loc1, headers=device_headers)
            assert res_loc1.status_code == 201

            await asyncio.sleep(0.3)
            assert any(e["event"] == "location_update" for e in ws_events)
            print("[PASS] [STEP 6 & 7] Initial location inside geofence ingested and broadcast over WebSocket", flush=True)

            # 8 & 9. Move simulator OUTSIDE geofence (~1.6km away)
            ws_events.clear()
            loc2 = {
                "latitude": 18.535000,
                "longitude": 73.856744,
                "speed": 22.0,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            res_loc2 = await http_client.post("/api/v1/locations", json=loc2, headers=device_headers)
            assert res_loc2.status_code == 201

            await asyncio.sleep(0.4)
            loc_events = [e for e in ws_events if e["event"] == "location_update"]
            alert_events = [e for e in ws_events if e["event"] == "alert"]

            assert len(loc_events) >= 1, "Missing location update"
            assert len(alert_events) >= 1, "Missing alert event for GEOFENCE_EXIT"
            exit_alert = alert_events[0]["data"]
            assert exit_alert["type"] == "GEOFENCE_EXIT"
            print(f"[PASS] [STEP 8 & 9] Received GEOFENCE_EXIT alert over WebSocket: '{exit_alert['message']}'", flush=True)

            # 10, 11, 12. Move simulator back INSIDE geofence
            ws_events.clear()
            loc3 = {
                "latitude": 18.520430,
                "longitude": 73.856744,
                "speed": 10.0,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            res_loc3 = await http_client.post("/api/v1/locations", json=loc3, headers=device_headers)
            assert res_loc3.status_code == 201

            await asyncio.sleep(0.4)
            alert_events_2 = [e for e in ws_events if e["event"] == "alert"]
            assert len(alert_events_2) >= 1, "Missing alert event for GEOFENCE_ENTER"
            enter_alert = alert_events_2[0]["data"]
            assert enter_alert["type"] == "GEOFENCE_ENTER"
            print(f"[PASS] [STEP 10, 11, 12] Received GEOFENCE_ENTER alert over WebSocket: '{enter_alert['message']}'", flush=True)

            # 13. List alerts from REST API
            res_alerts = await http_client.get(f"/api/v1/alerts/{device_id}", headers=headers_a)
            assert res_alerts.status_code == 200
            alert_list = res_alerts.json()
            assert len(alert_list) >= 2
            print(f"[PASS] [STEP 13] Retrieved {len(alert_list)} alerts from GET /api/v1/alerts/{device_id}", flush=True)

            # 14 & 15. Acknowledge alert
            alert_to_ack_id = enter_alert["id"]
            res_ack = await http_client.patch(f"/api/v1/alerts/{device_id}/{alert_to_ack_id}/acknowledge", headers=headers_a)
            assert res_ack.status_code == 200
            ack_data = res_ack.json()
            assert ack_data["acknowledged"] is True
            assert ack_data["acknowledged_at"] is not None
            print(f"[PASS] [STEP 14 & 15] Acknowledged alert ID {alert_to_ack_id} at {ack_data['acknowledged_at']}", flush=True)

            # 16. Disable geofence
            res_disable = await http_client.patch(f"/api/v1/geofences/{device_id}/{geofence_id}/disable", headers=headers_a)
            assert res_disable.status_code == 200
            assert res_disable.json()["enabled"] is False
            print(f"[PASS] [STEP 16] Disabled geofence ID {geofence_id}", flush=True)

            # 17 & 18. Send location moving outside while disabled -> Verify NO alert
            ws_events.clear()
            loc4 = {
                "latitude": 18.540000,
                "longitude": 73.856744,
                "speed": 18.0,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            res_loc4 = await http_client.post("/api/v1/locations", json=loc4, headers=device_headers)
            assert res_loc4.status_code == 201

            await asyncio.sleep(0.4)
            assert any(e["event"] == "location_update" for e in ws_events)
            assert not any(e["event"] == "alert" for e in ws_events)
            print("[PASS] [STEP 17 & 18] Verified NO alert is generated when moving outside disabled geofence", flush=True)

            reader_task.cancel()

        # 19 & 20. Device isolation (User B cannot access User A's geofences/alerts)
        res_b_geo = await http_client.get(f"/api/v1/geofences/{device_id}", headers=headers_b)
        assert res_b_geo.status_code == 403, f"Expected 403, got {res_b_geo.status_code}"

        res_b_alert = await http_client.get(f"/api/v1/alerts/{device_id}", headers=headers_b)
        assert res_b_alert.status_code == 403, f"Expected 403, got {res_b_alert.status_code}"
        print("[PASS] [STEP 19 & 20] Cross-user access strictly blocked (HTTP 403 Forbidden)", flush=True)

        # 21 & 22. Unauthenticated access rejected
        res_unauth_geo = await http_client.get(f"/api/v1/geofences/{device_id}")
        assert res_unauth_geo.status_code == 401
        res_unauth_alert = await http_client.get(f"/api/v1/alerts/{device_id}")
        assert res_unauth_alert.status_code == 401
        print("[PASS] [STEP 21 & 22] Unauthenticated access strictly blocked (HTTP 401 Unauthorized)", flush=True)

    print("\n==================================================", flush=True)
    print("ALL 22 PHASE 8 E2E VERIFICATION STEPS PASSED SUCCESSFULLY!", flush=True)
    print("==================================================", flush=True)

if __name__ == "__main__":
    asyncio.run(run_e2e_verification())
