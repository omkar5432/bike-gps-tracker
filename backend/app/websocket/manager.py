import json
import logging
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class ConnectionManager:
    """
    In-memory WebSocket connection manager for real-time GPS tracking.
    
    Architecture:
        device_id -> Set[WebSocket connections]
    
    For multi-instance deployments, this should be replaced with Redis pub/sub.
    """
    
    def __init__(self):
        # device_id -> set of active WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # connection_id -> device_id mapping for cleanup
        self.connection_to_device: Dict[int, str] = {}
        self._connection_id_counter = 0
    
    def _get_next_connection_id(self) -> int:
        self._connection_id_counter += 1
        return self._connection_id_counter
    
    async def connect(self, websocket: WebSocket, device_id: str) -> int:
        """
        Register a WebSocket connection for a device.
        WebSocket should already be accepted by the endpoint.
        Returns connection ID for tracking.
        """
        connection_id = self._get_next_connection_id()
        
        if device_id not in self.active_connections:
            self.active_connections[device_id] = set()
        
        self.active_connections[device_id].add(websocket)
        self.connection_to_device[connection_id] = device_id
        
        logger.info(f"WebSocket connected: device_id={device_id}, connection_id={connection_id}")
        
        return connection_id
    
    def disconnect(self, connection_id: int):
        """
        Remove a connection by ID and clean up empty device sets.
        """
        device_id = self.connection_to_device.pop(connection_id, None)
        
        if device_id and device_id in self.active_connections:
            # Find and remove the specific connection
            # Since we can't directly remove from set by WebSocket object,
            # we'll handle this in the disconnect method that receives the websocket
            pass
    
    async def disconnect_websocket(self, websocket: WebSocket, device_id: str):
        """
        Remove a specific WebSocket connection from a device's subscribers.
        """
        if device_id in self.active_connections:
            self.active_connections[device_id].discard(websocket)
            
            # Clean up empty device sets
            if not self.active_connections[device_id]:
                del self.active_connections[device_id]
                logger.info(f"No more connections for device {device_id}, cleaned up")
        
        # Remove from connection_to_device mapping
        to_remove = [conn_id for conn_id, dev_id in self.connection_to_device.items() if dev_id == device_id]
        for conn_id in to_remove:
            del self.connection_to_device[conn_id]
        
        logger.info(f"WebSocket disconnected: device_id={device_id}")
    
    async def broadcast_to_device(self, device_id: str, message: dict):
        """
        Broadcast a message to all connected clients for a specific device.
        Handles connection failures gracefully - one failed client won't affect others.
        """
        if device_id not in self.active_connections:
            logger.debug(f"No active connections for device {device_id}")
            return
        
        dead_connections = set()
        success_count = 0
        
        for connection in self.active_connections[device_id]:
            try:
                await connection.send_json(message)
                success_count += 1
            except Exception as e:
                logger.warning(f"Failed to send to connection for device {device_id}: {e}")
                dead_connections.add(connection)
        
        # Remove dead connections
        for dead_conn in dead_connections:
            self.active_connections[device_id].discard(dead_conn)
        
        # Clean up if no connections remain
        if not self.active_connections[device_id]:
            del self.active_connections[device_id]
        
        logger.info(f"Broadcast to device {device_id}: {success_count} clients, {len(dead_connections)} failed")
    
    def get_connection_count(self, device_id: str) -> int:
        """Get the number of active connections for a device."""
        return len(self.active_connections.get(device_id, set()))
    
    def get_total_connections(self) -> int:
        """Get total number of active connections across all devices."""
        return sum(len(conns) for conns in self.active_connections.values())


# Global singleton instance
manager = ConnectionManager()
