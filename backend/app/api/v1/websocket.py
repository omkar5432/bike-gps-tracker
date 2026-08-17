import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.orm import Session
from ...core.auth import get_db
from ...core.security import verify_supabase_jwt
from ...models.device import Device
from ...websocket.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/ws/devices/{device_id}")
async def websocket_device_tracking(
    websocket: WebSocket,
    device_id: str,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time GPS tracking of a specific device.
    
    Authentication: JWT token via ?token= query parameter (sanitized from server logs)
    Authorization: User must own the requested device
    
    Example: ws://localhost:8000/api/v1/ws/devices/BIKE001?token=<JWT_TOKEN>
    """
    # Accept the connection first
    await websocket.accept()
    
    # Try to authenticate
    try:
        token = websocket.query_params.get("token")
        if not token:
            logger.warning(f"WebSocket connection attempted without token for device: {device_id}")
            await websocket.close(code=4001, reason="Missing authentication token")
            return
        
        payload = verify_supabase_jwt(token)
        
        # Extract Supabase user UUID (normalized to `sub` by verify_supabase_jwt)
        user_id = payload.get("sub") or payload.get("user_id") or payload.get("id")
        
        if not user_id:
            logger.warning(f"WebSocket connection with invalid token payload for device: {device_id}")
            await websocket.close(code=4001, reason="Invalid token payload")
            return

        user_id = str(user_id)
            
    except Exception as e:
        logger.warning(f"WebSocket authentication failed for device {device_id}: {type(e).__name__}")
        await websocket.close(code=4001, reason="Invalid or expired authentication token")
        return
    
    # Verify device exists
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        logger.warning(f"WebSocket connection attempted for non-existent device: {device_id}")
        await websocket.close(code=4000, reason="Device not found")
        return

    
    # Verify user owns the device
    if str(device.user_id) != str(user_id):
        logger.warning(f"User {user_id} attempted to connect to device {device_id} owned by another user")
        await websocket.close(code=4003, reason="Access denied: You do not own this device")
        return
    
    # Register with manager
    connection_id = await manager.connect(websocket, device_id)
    
    # Send connected event
    try:
        await websocket.send_json({
            "event": "connected",
            "data": {
                "device_id": device_id,
                "timestamp": "2026-08-15T00:00:00Z"
            }
        })
        logger.info(f"User {user_id} connected to device {device_id} (connection_id={connection_id})")
    except Exception as e:
        logger.error(f"Failed to send connected event: {e}")
        await manager.disconnect_websocket(websocket, device_id)
        return
    
    # Handle WebSocket lifecycle
    try:
        while True:
            # Keep connection alive with ping/pong
            data = await websocket.receive_text()
            
            # Handle any client messages if needed
            # For now, we primarily broadcast from server to client
            logger.debug(f"Received message from client for device {device_id}: {data}")
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected normally for device {device_id}")
    except Exception as e:
        logger.error(f"WebSocket error for device {device_id}: {e}")
    finally:
        # Clean up connection
        await manager.disconnect_websocket(websocket, device_id)
