# GPS Telemetry Simulator

Python-based GPS hardware emulator for the Bike GPS Tracker project. It simulates real-time bicycle movement, gradual battery discharge, and telemetry pings conforming to the `POST /api/v1/locations` ingestion specification.

## Requirements

```bash
pip install -r requirements.txt
```

## Usage

```bash
# Basic run with device ID and Secret
python simulator.py --device-id BIKE001 --device-secret <YOUR_DEVICE_SECRET>

# Custom route, speed, and interval
python simulator.py \
  --device-id BIKE001 \
  --device-secret <YOUR_DEVICE_SECRET> \
  --latitude 18.520430 \
  --longitude 73.856744 \
  --speed 30.0 \
  --interval 5 \
  --api-url http://localhost:8000
```

## CLI Options

- `--device-id`: Hardware Device ID (default: `BIKE001`)
- `--device-secret`: Device Secret token generated during registration
- `--api-url`: FastAPI backend URL (default: `http://localhost:8000`)
- `--interval`: Telemetry ping interval in seconds (default: `5.0`)
- `--latitude`: Starting latitude in decimal degrees (default: `18.520430`)
- `--longitude`: Starting longitude in decimal degrees (default: `73.856744`)
- `--speed`: Movement speed in km/h (default: `25.0`)
- `--battery`: Starting battery percentage (default: `100.0`)
- `--max-steps`: Maximum pings to send (0 for continuous)
