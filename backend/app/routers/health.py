import time
from datetime import datetime, timezone
from fastapi import APIRouter
from ..models import SystemHealth
from ..database import db
from ..services.detector import PersonDetector

router = APIRouter(prefix="/health", tags=["Health"])

START_TIME = time.time()

@router.get("", response_model=SystemHealth)
def get_health():
    from ..main import get_detector, active_ws_clients
    detector = get_detector()
    stats = db.get_event_stats()

    is_model_loaded = detector.is_loaded if detector else False
    dev = detector.device.upper() if detector else "UNKNOWN"

    return SystemHealth(
        status="HEALTHY" if is_model_loaded else "DEGRADED",
        backend_uptime_seconds=round(time.time() - START_TIME, 1),
        model_loaded=is_model_loaded,
        model_name="YOLOv8n (Person Detection)",
        inference_device=dev,
        database_connected=True,
        active_ws_connections=len(active_ws_clients),
        total_events=stats["total_events"],
        unacknowledged_events=stats["unacknowledged_events"],
        timestamp=datetime.now(timezone.utc).isoformat()
    )
