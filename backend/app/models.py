from datetime import datetime, timezone
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
import uuid

class EventModel(BaseModel):
    event_id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:10]}")
    event_type: str = "RESTRICTED_ZONE_ENTRY"
    zone: str = "Restricted Zone A"
    zone_id: Optional[str] = None
    severity: str = "HIGH"  # LOW, MEDIUM, HIGH, CRITICAL
    person_count: int = 1
    confidence: float = 0.90
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    snapshot_path: Optional[str] = None
    snapshot_base64: Optional[str] = None
    acknowledged: bool = False
    acknowledged_at: Optional[str] = None
    is_demo: bool = False
    details: Optional[Dict[str, Any]] = None

class ZonePoint(BaseModel):
    x: float
    y: float

class ZoneModel(BaseModel):
    id: str = Field(default_factory=lambda: f"zone_{uuid.uuid4().hex[:8]}")
    name: str = "Restricted Zone A"
    polygon: List[List[float]] = Field(default_factory=lambda: [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.75, 0.75],
        [0.25, 0.75]
    ])
    severity: str = "HIGH"  # LOW, MEDIUM, HIGH, CRITICAL
    warning_buffer: int = 35
    enabled: bool = True
    color: str = "#EF4444"

class DetectedPerson(BaseModel):
    id: int
    bbox: List[float]  # [x1, y1, x2, y2] normalized 0..1 or pixel coordinates
    confidence: float
    reference_point: List[float]  # [x, y]
    status: str = "OUTSIDE"  # OUTSIDE, WARNING, INSIDE_RESTRICTED
    zone_name: Optional[str] = None
    zone_id: Optional[str] = None

class FrameInferenceResult(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    person_count: int = 0
    detections: List[DetectedPerson] = []
    risk_state: str = "GREEN"  # GREEN, YELLOW, RED
    active_violations: int = 0
    new_events: List[EventModel] = []
    inference_time_ms: float = 0.0
    mode: str = "REAL"  # REAL or DEMO
    model_online: bool = True

class SystemHealth(BaseModel):
    status: str = "HEALTHY"
    backend_uptime_seconds: float = 0.0
    model_loaded: bool = True
    model_name: str = "YOLOv8n"
    inference_device: str = "CPU"
    database_connected: bool = True
    active_ws_connections: int = 0
    total_events: int = 0
    unacknowledged_events: int = 0
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AppSettingsModel(BaseModel):
    confidence_threshold: float = 0.45
    detection_interval_ms: int = 150
    warning_buffer_px: int = 40
    snapshot_enabled: bool = True
    alert_sound_enabled: bool = True
    default_mode: str = "REAL"
    active_camera_id: Optional[str] = "default"
