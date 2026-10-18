import base64
import time
import os
import shutil
from typing import Dict, Any, Optional
import numpy as np
import cv2
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from ..models import FrameInferenceResult, EventModel, DetectedPerson
from ..database import db
from ..services.zone_service import zone_engine
from ..services.demo_service import demo_engine
from ..config import settings

router = APIRouter(prefix="/detection", tags=["Detection"])

class FramePayload(BaseModel):
    image_base64: str
    mode: str = "REAL"  # REAL or DEMO
    confidence_threshold: Optional[float] = None
    save_snapshot: bool = True

is_system_monitoring_active = True

@router.post("/start")
def start_detection():
    global is_system_monitoring_active
    is_system_monitoring_active = True
    return {"status": "ACTIVE", "message": "Detection processing started."}

@router.post("/stop")
def stop_detection():
    global is_system_monitoring_active
    is_system_monitoring_active = False
    return {"status": "PAUSED", "message": "Detection processing stopped."}

def decode_base64_image(base64_str: str) -> Optional[np.ndarray]:
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None

@router.post("/frame", response_model=FrameInferenceResult)
def process_single_frame(payload: FramePayload):
    from ..main import get_detector
    detector = get_detector()
    zones = db.get_zones()

    if payload.mode.upper() == "DEMO":
        detections, risk_state, new_events = demo_engine.generate_demo_frame(zones)
        return FrameInferenceResult(
            person_count=len(detections),
            detections=detections,
            risk_state=risk_state,
            active_violations=sum(1 for d in detections if d.status == "INSIDE_RESTRICTED"),
            new_events=new_events,
            inference_time_ms=8.5,
            mode="DEMO",
            model_online=True
        )

    # REAL MODE: requires model
    if not detector or not detector.is_loaded:
        return FrameInferenceResult(
            person_count=0,
            detections=[],
            risk_state="GREEN",
            active_violations=0,
            new_events=[],
            inference_time_ms=0.0,
            mode="REAL",
            model_online=False
        )

    img = decode_base64_image(payload.image_base64)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid base64 image data.")

    # Run detection
    raw_detections, inf_ms = detector.detect(img, threshold=payload.confidence_threshold)

    # Snapshot base64 if enabled
    snapshot_data = payload.image_base64 if payload.save_snapshot else None

    # Evaluate zones
    updated_dets, risk_state, new_events = zone_engine.evaluate_frame(
        detections=raw_detections,
        zones=zones,
        snapshot_base64=snapshot_data,
        is_demo=False
    )

    return FrameInferenceResult(
        person_count=len(updated_dets),
        detections=updated_dets,
        risk_state=risk_state,
        active_violations=sum(1 for d in updated_dets if d.status == "INSIDE_RESTRICTED"),
        new_events=new_events,
        inference_time_ms=inf_ms,
        mode="REAL",
        model_online=True
    )

@router.post("/upload-video")
async def process_uploaded_video(file: UploadFile = File(...)):
    from ..main import detector_instance

    if not file.filename.lower().endswith((".mp4", ".avi", ".mov", ".mkv")):
        raise HTTPException(status_code=400, detail="Invalid video format. Supported formats: .mp4, .avi, .mov, .mkv")

    save_path = os.path.join(settings.SNAPSHOT_DIR, f"upload_{int(time.time())}_{file.filename}")
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    cap = cv2.VideoCapture(save_path)
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Failed to open uploaded video file.")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = round(cap.get(cv2.CAP_PROP_FPS) or 25.0, 1)
    duration_s = round(total_frames / max(fps, 1.0), 1)

    zones = db.get_zones()
    processed_count = 0
    persons_detected_total = 0
    violations_detected = 0
    stride = max(1, int(fps // 5))  # Sample ~5 frames per second

    frame_idx = 0
    while cap.isOpened() and frame_idx < total_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % stride == 0 and detector_instance and detector_instance.is_loaded:
            processed_count += 1
            raw_dets, _ = detector_instance.detect(frame)
            persons_detected_total += len(raw_dets)
            dets, rstate, events = zone_engine.evaluate_frame(raw_dets, zones, is_demo=False)
            if rstate == "RED":
                violations_detected += 1
        frame_idx += 1

    cap.release()

    return {
        "status": "SUCCESS",
        "filename": file.filename,
        "total_frames": total_frames,
        "fps": fps,
        "duration_seconds": duration_s,
        "analyzed_frames": processed_count,
        "persons_detected": persons_detected_total,
        "violations_detected": violations_detected,
        "video_path": save_path
    }
