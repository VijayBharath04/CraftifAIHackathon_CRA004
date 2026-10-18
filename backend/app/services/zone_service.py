import math
import time
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timezone
from ..models import ZoneModel, DetectedPerson, EventModel
from ..database import db

def point_in_polygon(x: float, y: float, polygon: List[List[float]]) -> bool:
    """
    Ray casting algorithm for point-in-polygon test.
    Handles normalized coordinates [0..1].
    """
    n = len(polygon)
    if n < 3:
        return False

    inside = False
    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    else:
                        xinters = p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def dist_point_to_segment(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculates Euclidean distance from point (px, py) to line segment (x1, y1)-(x2, y2)."""
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)
    # Projection parameter t
    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return math.hypot(px - proj_x, py - proj_y)

def dist_point_to_polygon(x: float, y: float, polygon: List[List[float]]) -> float:
    """Returns minimum distance from point to polygon boundary."""
    n = len(polygon)
    if n < 2:
        return float('inf')
    min_dist = float('inf')
    for i in range(n):
        p1x, p1y = polygon[i]
        p2x, p2y = polygon[(i + 1) % n]
        d = dist_point_to_segment(x, y, p1x, p1y, p2x, p2y)
        if d < min_dist:
            min_dist = d
    return min_dist

class ZoneEngine:
    def __init__(self, cooldown_seconds: float = 2.5):
        self.cooldown_seconds = cooldown_seconds
        # Active breach sessions: key = (zone_id, track_key) -> {"last_seen": float, "first_entered": float, "notified": bool}
        self.active_sessions: Dict[str, Dict[str, Any]] = {}

    def evaluate_frame(
        self,
        detections: List[Dict[str, Any]],
        zones: List[ZoneModel],
        snapshot_base64: Optional[str] = None,
        is_demo: bool = False
    ) -> Tuple[List[DetectedPerson], str, List[EventModel]]:
        """
        Evaluates person detections against active zones.
        Returns:
            updated_detections: List of DetectedPerson
            risk_state: "GREEN", "YELLOW", or "RED"
            new_events: List of EventModel triggered during this frame
        """
        now = time.time()
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Clean up stale sessions where person hasn't been seen for > cooldown_seconds
        stale_keys = [
            k for k, sess in self.active_sessions.items()
            if now - sess["last_seen"] > self.cooldown_seconds
        ]
        for k in stale_keys:
            del self.active_sessions[k]

        has_red = False
        has_yellow = False
        new_events: List[EventModel] = []
        updated_detections: List[DetectedPerson] = []

        active_zones = [z for z in zones if z.enabled]

        for det in detections:
            gx, gy = det["reference_point"]  # ground contact point normalized
            det_id = det["id"]
            
            status = "OUTSIDE"
            matched_zone_name = None
            matched_zone_id = None
            matched_zone_severity = "HIGH"

            # Check inside restricted zones first
            for zone in active_zones:
                if point_in_polygon(gx, gy, zone.polygon):
                    status = "INSIDE_RESTRICTED"
                    matched_zone_name = zone.name
                    matched_zone_id = zone.id
                    matched_zone_severity = zone.severity
                    has_red = True
                    break

            # If not inside, check if approaching within warning buffer
            if status != "INSIDE_RESTRICTED":
                for zone in active_zones:
                    # Buffer in normalized units: warning_buffer px on 640px base ~ buffer / 640.0
                    norm_buffer = zone.warning_buffer / 640.0
                    d = dist_point_to_polygon(gx, gy, zone.polygon)
                    if d <= norm_buffer:
                        status = "WARNING"
                        matched_zone_name = zone.name
                        matched_zone_id = zone.id
                        matched_zone_severity = zone.severity
                        has_yellow = True
                        break

            # Handle event generation with deduplication
            if status == "INSIDE_RESTRICTED" and matched_zone_id:
                # Key based on spatial bin + zone to maintain track across frames
                spatial_bin = f"{round(gx, 1)}_{round(gy, 1)}"
                session_key = f"{matched_zone_id}:{spatial_bin}"

                if session_key not in self.active_sessions:
                    # New breach event!
                    self.active_sessions[session_key] = {
                        "first_entered": now,
                        "last_seen": now,
                        "notified": True
                    }
                    event = EventModel(
                        event_type="RESTRICTED_ZONE_ENTRY",
                        zone=matched_zone_name,
                        zone_id=matched_zone_id,
                        severity=matched_zone_severity,
                        person_count=1,
                        confidence=det["confidence"],
                        timestamp=now_iso,
                        snapshot_base64=snapshot_base64,
                        is_demo=is_demo,
                        details={
                            "reference_point": [gx, gy],
                            "bbox": det["bbox"]
                        }
                    )
                    # Persist event
                    saved_event = db.save_event(event)
                    new_events.append(saved_event)
                else:
                    # Continuous presence: update last seen time, do NOT create duplicate event!
                    self.active_sessions[session_key]["last_seen"] = now

            updated_detections.append(DetectedPerson(
                id=det_id,
                bbox=det["bbox"],
                confidence=det["confidence"],
                reference_point=det["reference_point"],
                status=status,
                zone_name=matched_zone_name,
                zone_id=matched_zone_id
            ))

        # Determine overall frame risk state
        if has_red:
            risk_state = "RED"
        elif has_yellow:
            risk_state = "YELLOW"
        else:
            risk_state = "GREEN"

        return updated_detections, risk_state, new_events

zone_engine = ZoneEngine()
