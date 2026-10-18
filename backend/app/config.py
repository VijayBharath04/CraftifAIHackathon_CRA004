import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
SNAPSHOT_DIR = DATA_DIR / "snapshots"
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = DATA_DIR / "yolov8n.pt"
DB_PATH = DATA_DIR / "guardian.db"

class Settings:
    PROJECT_NAME: str = "AI Guardian"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Model configuration
    MODEL_PATH: str = str(MODEL_PATH)
    CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.45"))
    DETECTION_INTERVAL_MS: int = int(os.getenv("DETECTION_INTERVAL_MS", "150"))
    PERSON_CLASS_ID: int = 0
    
    # Zone configuration
    WARNING_BUFFER_PX: int = int(os.getenv("WARNING_BUFFER_PX", "40"))
    DEDUPLICATION_COOLDOWN_S: float = float(os.getenv("DEDUPLICATION_COOLDOWN_S", "3.0"))
    
    # Snapshots and Storage
    SNAPSHOT_ENABLED: bool = os.getenv("SNAPSHOT_ENABLED", "true").lower() in ("true", "1")
    SNAPSHOT_DIR: str = str(SNAPSHOT_DIR)
    DB_PATH: str = str(DB_PATH)
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

settings = Settings()
