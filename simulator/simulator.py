import sys
import time
import requests
try:
    from .config import parse_args
    from .gps_simulator import GPSSimulator
except ImportError:
    from config import parse_args
    from gps_simulator import GPSSimulator

def run_simulator():
    args = parse_args()

    if not args.device_secret:
        print("[ERROR] Device secret not provided. Pass via --device-secret or set DEVICE_SECRET environment variable.")
        sys.exit(1)

    print(f"=== Starting Bike GPS Telemetry Simulator ===")
    print(f"  Device ID:        {args.device_id}")
    print(f"  Target Endpoint:  {args.api_url}/api/v1/locations")
    print(f"  Interval:         {args.interval}s")
    print(f"  Start Location:   {args.latitude}, {args.longitude}")
    print(f"  Target Speed:     {args.speed} km/h")
    print("=============================================\n")

    gps = GPSSimulator(
        start_lat=args.latitude,
        start_lon=args.longitude,
        target_speed=args.speed,
        start_battery=args.battery
    )

    headers = {
        "X-Device-ID": args.device_id,
        "X-Device-Secret": args.device_secret,
        "Content-Type": "application/json"
    }

    url = f"{args.api_url.rstrip('/')}/api/v1/locations"
    step_count = 0

    try:
        while True:
            step_count += 1
            payload = gps.step(interval_seconds=args.interval)

            try:
                response = requests.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=10.0
                )

                lat = payload["latitude"]
                lon = payload["longitude"]
                speed = payload["speed"]
                batt = payload["battery"]
                status = response.status_code

                if response.status_code == 201:
                    print(f"[{args.device_id}] #{step_count:04d} | {lat:.6f}, {lon:.6f} | {speed:4.1f} km/h | Batt: {batt:5.1f}% | HTTP {status}")
                else:
                    print(f"[{args.device_id}] #{step_count:04d} | {lat:.6f}, {lon:.6f} | HTTP {status} - {response.text}")

            except requests.exceptions.RequestException as e:
                print(f"[{args.device_id}] #{step_count:04d} | Connection failed to {url}. Retrying in {args.retry_delay}s... ({e.__class__.__name__})")
                time.sleep(args.retry_delay)
                continue

            if args.max_steps > 0 and step_count >= args.max_steps:
                print(f"\n[INFO] Reached maximum requested steps ({args.max_steps}). Simulator exiting.")
                break

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print(f"\n[INFO] Simulator stopped by user after {step_count} telemetry pings.")

if __name__ == "__main__":
    run_simulator()
