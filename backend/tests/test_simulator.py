import sys
from pathlib import Path
import pytest

# Ensure project root is in sys.path
PROJECT_ROOT = str(Path(__file__).resolve().parents[2])
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from simulator.gps_simulator import GPSSimulator
from backend.app.schemas.location import LocationCreate

def test_gps_simulator_generates_valid_payload():
    sim = GPSSimulator(
        start_lat=18.520430,
        start_lon=73.856744,
        target_speed=30.0,
        start_battery=100.0
    )

    payload = sim.step(interval_seconds=5.0)

    # 1. Verify schema validation passes
    loc_schema = LocationCreate(**payload)
    assert loc_schema.latitude == pytest.approx(18.520430, abs=0.01)
    assert loc_schema.longitude == pytest.approx(73.856744, abs=0.01)
    assert loc_schema.speed >= 0.0
    assert 0.0 <= loc_schema.battery <= 100.0
    assert loc_schema.gps_accuracy > 0.0
    assert loc_schema.satellites >= 6
    assert loc_schema.timestamp.tzinfo is not None

def test_gps_simulator_movement_progression():
    sim = GPSSimulator(
        start_lat=18.520430,
        start_lon=73.856744,
        target_speed=40.0,
        start_battery=100.0
    )

    step1 = sim.step(interval_seconds=5.0)
    step2 = sim.step(interval_seconds=5.0)
    step3 = sim.step(interval_seconds=5.0)

    # Coordinates must progress
    assert (step3["latitude"], step3["longitude"]) != (step1["latitude"], step1["longitude"])
    # Battery must drain gradually
    assert step3["battery"] <= step1["battery"]

def test_gps_simulator_payload_compatibility_with_api(client, auth_headers_user_a, test_user_a_uuid, db_session):
    # Register test device
    reg_res = client.post(
        "/api/v1/devices",
        json={"device_id": "BIKE-SIM-001", "name": "Simulator Bike"},
        headers=auth_headers_user_a
    )
    assert reg_res.status_code == 201
    raw_secret = reg_res.json()["device_secret"]

    # Generate step payload from simulator
    sim = GPSSimulator(start_lat=18.520430, start_lon=73.856744)
    payload = sim.step(interval_seconds=5.0)

    # Send simulator payload to location endpoint
    headers = {
        "X-Device-ID": "BIKE-SIM-001",
        "X-Device-Secret": raw_secret
    }
    response = client.post("/api/v1/locations", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["device_id"] == "BIKE-SIM-001"
    assert data["latitude"] == payload["latitude"]
    assert data["longitude"] == payload["longitude"]
