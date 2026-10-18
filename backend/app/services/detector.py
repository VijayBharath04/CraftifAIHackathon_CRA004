import time
import os
import logging
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import cv2

logger = logging.getLogger("ai_guardian.detector")

class PersonDetector:
    def __init__(self, model_path: str = "backend/data/yolov8n.pt", confidence_threshold: float = 0.45):
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.model = None
        self.device = "cpu"
        self.is_loaded = False
        self.error_message = None
        self._load_model()

    def _load_model(self):
        try:
            import torch
            from ultralytics import YOLO

            # Check CUDA
            if torch.cuda.is_available():
                self.device = "cuda"
            else:
                self.device = "cpu"

            # Check if model path exists, else fallback to standard yolov8n.pt
            target_path = self.model_path
            if not os.path.exists(target_path):
                # Search in local data dir or root
                alt_paths = [
                    "backend/data/yolov8n.pt",
                    "data/yolov8n.pt",
                    "yolov8n.pt"
                ]
                for p in alt_paths:
                    if os.path.exists(p):
                        target_path = p
                        break

            logger.info(f"Loading YOLOv8 model from {target_path} on {self.device}...")
            self.model = YOLO(target_path)
            self.is_loaded = True
            logger.info("YOLOv8 model loaded successfully.")
        except Exception as e:
            self.is_loaded = False
            self.error_message = str(e)
            logger.error(f"Failed to load YOLOv8 model: {e}")

    def detect(self, image: np.ndarray, threshold: Optional[float] = None) -> Tuple[List[Dict[str, Any]], float]:
        """
        Runs person detection on a BGR image.
        Returns:
            detections: List of dicts with:
                id: int
                bbox: [x1, y1, x2, y2] normalized (0..1)
                pixel_bbox: [x1, y1, x2, y2] in pixels
                confidence: float
                reference_point: [x, y] normalized (bottom-center)
                center_point: [x, y] normalized (centroid)
            inference_time_ms: float
        """
        if not self.is_loaded or self.model is None:
            return [], 0.0

        conf = threshold if threshold is not None else self.confidence_threshold
        h, w = image.shape[:2]
        start_time = time.perf_counter()

        try:
            # classes=[0] filters strictly for person
            results = self.model.predict(
                source=image,
                conf=conf,
                classes=[0],
                verbose=False,
                device=self.device
            )
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0

            detections = []
            if len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes
                for idx, box in enumerate(boxes):
                    coords = box.xyxy[0].cpu().numpy()  # [x1, y1, x2, y2]
                    score = float(box.conf[0].cpu().numpy())
                    cls_id = int(box.cls[0].cpu().numpy())

                    if cls_id != 0:
                        continue

                    x1_px, y1_px, x2_px, y2_px = float(coords[0]), float(coords[1]), float(coords[2]), float(coords[3])

                    # Normalized coordinates [0..1]
                    x1_norm = max(0.0, min(1.0, x1_px / w))
                    y1_norm = max(0.0, min(1.0, y1_px / h))
                    x2_norm = max(0.0, min(1.0, x2_px / w))
                    y2_norm = max(0.0, min(1.0, y2_px / h))

                    # Ground-contact midpoint: ((x1 + x2)/2, y2)
                    ground_x = (x1_norm + x2_norm) / 2.0
                    ground_y = y2_norm

                    # Center point: ((x1 + x2)/2, (y1 + y2)/2)
                    center_x = (x1_norm + x2_norm) / 2.0
                    center_y = (y1_norm + y2_norm) / 2.0

                    detections.append({
                        "id": idx + 1,
                        "bbox": [round(x1_norm, 4), round(y1_norm, 4), round(x2_norm, 4), round(y2_norm, 4)],
                        "pixel_bbox": [round(x1_px, 1), round(y1_px, 1), round(x2_px, 1), round(y2_px, 1)],
                        "confidence": round(score, 3),
                        "reference_point": [round(ground_x, 4), round(ground_y, 4)],
                        "center_point": [round(center_x, 4), round(center_y, 4)]
                    })

            return detections, round(elapsed_ms, 2)
        except Exception as e:
            logger.error(f"Inference error: {e}")
            return [], 0.0
