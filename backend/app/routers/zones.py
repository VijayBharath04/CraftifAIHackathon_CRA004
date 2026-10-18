from typing import List
from fastapi import APIRouter, HTTPException
from ..models import ZoneModel
from ..database import db

router = APIRouter(prefix="/zones", tags=["Zones"])

@router.get("", response_model=List[ZoneModel])
def get_zones():
    return db.get_zones()

@router.post("", response_model=ZoneModel)
def create_zone(zone: ZoneModel):
    if len(zone.polygon) < 3:
        raise HTTPException(status_code=400, detail="Zone polygon must contain at least 3 vertices.")
    return db.save_zone(zone)

@router.put("/{zone_id}", response_model=ZoneModel)
def update_zone(zone_id: str, zone: ZoneModel):
    zone.id = zone_id
    if len(zone.polygon) < 3:
        raise HTTPException(status_code=400, detail="Zone polygon must contain at least 3 vertices.")
    return db.save_zone(zone)

@router.delete("/{zone_id}")
def delete_zone(zone_id: str):
    success = db.delete_zone(zone_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")
    return {"message": f"Zone '{zone_id}' successfully deleted."}
