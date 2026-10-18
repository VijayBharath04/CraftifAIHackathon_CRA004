import json
import logging
from contextlib import asynccontextmanager
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .services.detector import PersonDetector
from .services.zone_service import zone_engine
from .services.demo_service import demo_engine
from .database import db
from .routers import health, events, zones, settings as settings_router, detection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ai_guardian.main")

detector_instance: PersonDetector = None
active_ws_clients: Set[WebSocket] = set()

def get_detector() -> PersonDetector:
    global detector_instance
    if detector_instance is None:
        detector_instance = PersonDetector(model_path=settings.MODEL_PATH, confidence_threshold=settings.CONFIDENCE_THRESHOLD)
    return detector_instance

@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector_instance
    logger.info("Initializing AI Guardian Core Services...")
    get_detector()
    demo_engine.seed_demo_history(count=6)
    logger.info("AI Guardian backend ready.")
    yield
    logger.info("Shutting down AI Guardian Services...")
    active_ws_clients.clear()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Real-Time AI Camera Surveillance and Restricted-Zone Detection System",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST Routers
app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(events.router, prefix=settings.API_PREFIX)
app.include_router(zones.router, prefix=settings.API_PREFIX)
app.include_router(settings_router.router, prefix=settings.API_PREFIX)
app.include_router(detection.router, prefix=settings.API_PREFIX)

# WebSocket streaming endpoint for low-latency live camera frame inference
@app.websocket("/ws/stream")
async def websocket_stream_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_ws_clients.add(websocket)
    logger.info(f"WebSocket client connected. Total clients: {len(active_ws_clients)}")

    try:
        while True:
            raw_text = await websocket.receive_text()
            data = json.loads(raw_text)
            msg_type = data.get("type", "frame")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "timestamp": data.get("timestamp")})
                continue

            if msg_type == "frame":
                img_b64 = data.get("image", "")
                mode = data.get("mode", "REAL").upper()
                threshold = data.get("threshold", None)
                save_snapshot = data.get("save_snapshot", True)

                zones_list = db.get_zones()

                if mode == "DEMO":
                    detections, risk_state, new_events = demo_engine.generate_demo_frame(zones_list)
                    response = {
                        "type": "detection_result",
                        "person_count": len(detections),
                        "detections": [d.model_dump() for d in detections],
                        "risk_state": risk_state,
                        "active_violations": sum(1 for d in detections if d.status == "INSIDE_RESTRICTED"),
                        "new_events": [e.model_dump() for e in new_events],
                        "inference_time_ms": 7.5,
                        "mode": "DEMO",
                        "model_online": True
                    }
                else:
                    # REAL MODE
                    if not detector_instance or not detector_instance.is_loaded:
                        response = {
                            "type": "detection_result",
                            "person_count": 0,
                            "detections": [],
                            "risk_state": "GREEN",
                            "active_violations": 0,
                            "new_events": [],
                            "inference_time_ms": 0.0,
                            "mode": "REAL",
                            "model_online": False,
                            "error": detector_instance.error_message if detector_instance else "Model not loaded"
                        }
                    else:
                        img = detection.decode_base64_image(img_b64)
                        if img is None:
                            response = {
                                "type": "error",
                                "message": "Failed to decode frame"
                            }
                        else:
                            raw_dets, inf_ms = detector_instance.detect(img, threshold=threshold)
                            snapshot_data = img_b64 if save_snapshot else None
                            updated_dets, risk_state, new_events = zone_engine.evaluate_frame(
                                detections=raw_dets,
                                zones=zones_list,
                                snapshot_base64=snapshot_data,
                                is_demo=False
                            )
                            response = {
                                "type": "detection_result",
                                "person_count": len(updated_dets),
                                "detections": [d.model_dump() for d in updated_dets],
                                "risk_state": risk_state,
                                "active_violations": sum(1 for d in updated_dets if d.status == "INSIDE_RESTRICTED"),
                                "new_events": [e.model_dump() for e in new_events],
                                "inference_time_ms": inf_ms,
                                "mode": "REAL",
                                "model_online": True
                            }

                await websocket.send_json(response)

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        active_ws_clients.discard(websocket)
