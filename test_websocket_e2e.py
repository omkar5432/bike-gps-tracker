import asyncio
import websockets
import json
import sys
from pathlib import Path
from uuid import uuid4

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

# Load environment
from dotenv import load_dotenv
env_path = Path(__file__).parent / "backend" / ".env"
load_dotenv(env_path)

from backend.app.database.connection import SessionLocal
from backend.app.models.device import Device
from backend.app.core.security import create_access_token, generate_device_secret, hash_device_secret

def get_test_credentials():
    db = SessionLocal()
    try:
        test_user_id = "ba8cf4d1-2ba4-43b2-99aa-f2a125cb5d41"
        
        # Get or create test device
        device = db.query(Device).filter(Device.device_id == "E2E-TEST-001").first()
        if not device:
            raw_secret = generate_device_secret()
            device = Device(
                device_id="E2E-TEST-001",
                name="E2E Test Device",
                user_id=test_user_id,
                device_secret_hash=hash_device_secret(raw_secret)
            )
            db.add(device)
            db.commit()
            db.refresh(device)
        else:
            # Update secret for testing
            raw_secret = generate_device_secret()
            device.device_secret_hash = hash_device_secret(raw_secret)
            db.commit()
        
        # Generate JWT token for test user
        token = create_access_token({"sub": test_user_id, "email": "e2e-test@example.com"})
        
        print(f"Test User ID: {test_user_id}")
        print(f"Device: {device.device_id}")
        print(f"Device Secret: {raw_secret}")
        print(f"JWT Token: {token}")
        
        return raw_secret, token
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

async def websocket_client():
    raw_secret, token = get_test_credentials()
    device_id = "E2E-TEST-001"
    uri = f"ws://localhost:8000/api/v1/ws/devices/{device_id}?token={token}"
    
    print(f"\nConnecting to WebSocket: {uri}")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            
            # Listen for messages
            message_count = 0
            while message_count < 5:  # Receive 5 location updates
                message = await websocket.recv()
                data = json.loads(message)
                print(f"\nReceived: {json.dumps(data, indent=2)}")
                message_count += 1
                
                if data["event"] == "location_update":
                    print(f"✓ Location update received: {data['data']['latitude']}, {data['data']['longitude']}")
                
            print("\n✓ E2E test completed successfully!")
                
    except Exception as e:
        print(f"WebSocket error: {e}")

if __name__ == "__main__":
    asyncio.run(websocket_client())
