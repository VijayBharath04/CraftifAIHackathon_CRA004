from fastapi import APIRouter
from ..models import AppSettingsModel
from ..database import db

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=AppSettingsModel)
def get_settings():
    return db.get_settings()

@router.put("", response_model=AppSettingsModel)
def update_settings(new_settings: AppSettingsModel):
    return db.save_settings(new_settings)
