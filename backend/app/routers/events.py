import csv
import io
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Response
from ..models import EventModel
from ..database import db
from ..services.demo_service import demo_engine

router = APIRouter(prefix="/events", tags=["Events"])

@router.get("", response_model=List[EventModel])
def list_events(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    severity: Optional[str] = None,
    zone: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    is_demo: Optional[bool] = None,
    search: Optional[str] = None
):
    return db.get_events(
        limit=limit,
        offset=offset,
        severity=severity,
        zone=zone,
        acknowledged=acknowledged,
        is_demo=is_demo,
        search=search
    )

@router.get("/stats")
def get_stats():
    return db.get_event_stats()

@router.get("/export/csv")
def export_events_csv(
    severity: Optional[str] = None,
    zone: Optional[str] = None,
    is_demo: Optional[bool] = None
):
    events = db.get_events(
        limit=5000,
        offset=0,
        severity=severity,
        zone=zone,
        is_demo=is_demo
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Event ID", "Timestamp", "Event Type", "Zone", "Severity",
        "Person Count", "Confidence", "Acknowledged", "Acknowledged At", "Is Demo"
    ])
    for e in events:
        writer.writerow([
            e.event_id,
            e.timestamp,
            e.event_type,
            e.zone,
            e.severity,
            e.person_count,
            f"{e.confidence:.2f}",
            "Yes" if e.acknowledged else "No",
            e.acknowledged_at or "",
            "DEMO" if e.is_demo else "REAL"
        ])
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ai_guardian_security_events.csv"}
    )

@router.post("/seed-demo")
def seed_demo_events(count: int = Query(8, ge=1, le=20)):
    demo_engine.seed_demo_history(count=count)
    return {"message": f"Successfully generated {count} demonstration security events."}

@router.get("/{event_id}", response_model=EventModel)
def get_event(event_id: str):
    event = db.get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event with ID '{event_id}' not found.")
    return event

@router.post("/{event_id}/acknowledge", response_model=EventModel)
def acknowledge_event(event_id: str):
    event = db.acknowledge_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event with ID '{event_id}' not found.")
    return event

@router.delete("")
def clear_events(keep_unacknowledged: bool = Query(False)):
    deleted = db.clear_events(keep_unacknowledged=keep_unacknowledged)
    return {"message": f"Successfully deleted {deleted} security events.", "deleted_count": deleted}
