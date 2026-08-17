import os
import argparse
from typing import Optional

def parse_args():
    parser = argparse.ArgumentParser(
        description="Bike GPS Tracker - IoT Telemetry & Movement Simulator"
    )

    parser.add_argument(
        "--device-id",
        type=str,
        default=os.getenv("DEVICE_ID", "BIKE001"),
        help="Device identifier (default: from DEVICE_ID env or 'BIKE001')"
    )
    parser.add_argument(
        "--device-secret",
        type=str,
        default=os.getenv("DEVICE_SECRET", ""),
        help="Device secret for authentication (default: from DEVICE_SECRET env)"
    )
    parser.add_argument(
        "--api-url",
        type=str,
        default=os.getenv("API_URL", "http://localhost:8000"),
        help="Base URL of the FastAPI backend (default: http://localhost:8000)"
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=float(os.getenv("SIMULATOR_INTERVAL", "5.0")),
        help="Telemetry transmit interval in seconds (default: 5.0)"
    )
    parser.add_argument(
        "--latitude",
        type=float,
        default=float(os.getenv("START_LAT", "18.520430")),
        help="Starting latitude in decimal degrees (default: 18.520430)"
    )
    parser.add_argument(
        "--longitude",
        type=float,
        default=float(os.getenv("START_LON", "73.856744")),
        help="Starting longitude in decimal degrees (default: 73.856744)"
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=float(os.getenv("START_SPEED", "25.0")),
        help="Target travel speed in km/h (default: 25.0)"
    )
    parser.add_argument(
        "--battery",
        type=float,
        default=float(os.getenv("START_BATTERY", "100.0")),
        help="Starting battery percentage (default: 100.0)"
    )
    parser.add_argument(
        "--max-steps",
        type=int,
        default=int(os.getenv("MAX_STEPS", "0")),
        help="Maximum number of pings to send (0 for continuous running)"
    )
    parser.add_argument(
        "--retry-delay",
        type=float,
        default=3.0,
        help="Seconds to wait before retrying on network connection failure"
    )

    return parser.parse_args()
