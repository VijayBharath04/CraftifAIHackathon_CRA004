import time
import pytest
from app.services.zone_service import ZoneEngine
from app.models import ZoneModel

def test_event_deduplication_and_reentry():
    engine = ZoneEngine(cooldown_seconds=0.5)
    
    # 1 Zone: square [0.2, 0.2] to [0.8, 0.8]
    zones = [
        ZoneModel(
            id="test_zone_1",
            name="Restricted Zone 1",
            polygon=[[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]],
            severity="HIGH",
            warning_buffer=30,
            enabled=True
        )
    ]
    
    # Frame 1: Person inside zone (0.5, 0.5)
    det_frame1 = [{
        "id": 1,
        "bbox": [0.4, 0.3, 0.6, 0.5],
        "confidence": 0.92,
        "reference_point": [0.5, 0.5]
    }]
    
    updated1, risk1, events1 = engine.evaluate_frame(det_frame1, zones)
    assert risk1 == "RED"
    assert len(events1) == 1
    assert events1[0].event_type == "RESTRICTED_ZONE_ENTRY"
    assert events1[0].zone == "Restricted Zone 1"
    
    # Frame 2: Person still inside zone -> should NOT emit duplicate event
    det_frame2 = [{
        "id": 1,
        "bbox": [0.41, 0.31, 0.61, 0.51],
        "confidence": 0.94,
        "reference_point": [0.51, 0.51]
    }]
    updated2, risk2, events2 = engine.evaluate_frame(det_frame2, zones)
    assert risk2 == "RED"
    assert len(events2) == 0, "Duplicate event was emitted during continuous presence!"
    
    # Frame 3: Person still inside zone -> 0 new events
    updated3, risk3, events3 = engine.evaluate_frame(det_frame2, zones)
    assert len(events3) == 0
    
    # Frame 4: Person exits zone to outside (0.1, 0.1)
    det_frame4 = [{
        "id": 1,
        "bbox": [0.05, 0.05, 0.15, 0.15],
        "confidence": 0.90,
        "reference_point": [0.1, 0.1]
    }]
    updated4, risk4, events4 = engine.evaluate_frame(det_frame4, zones)
    assert risk4 == "GREEN"
    assert len(events4) == 0
    
    # Wait for cooldown to expire (> 0.5s)
    time.sleep(0.6)
    
    # Frame 5: Person re-enters zone -> MUST emit a new event!
    updated5, risk5, events5 = engine.evaluate_frame(det_frame1, zones)
    assert risk5 == "RED"
    assert len(events5) == 1, "Failed to emit new event upon re-entry!"
    assert events5[0].event_type == "RESTRICTED_ZONE_ENTRY"
