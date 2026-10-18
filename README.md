# AI GUARDIAN

 Live Preview URL: https://subtle-jelly-f8607b.netlify.app
 
### Real-Time AI Camera Surveillance and Restricted-Zone Detection System

[![Python 3.14](https://img.shields.io/badge/Python-3.14-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![Ultralytics YOLOv8](https://img.shields.io/badge/YOLOv8-Person_Detection-00FFFF.svg)](https://ultralytics.com)
[![React 19](https://img.shields.io/badge/React-19_TypeScript-61DAFB.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-Dark_Industrial-38BDF8.svg)](https://tailwindcss.com/)

**AI Guardian** is an enterprise-grade Physical AI surveillance and perimeter intelligence web application. It monitors live computer webcams and uploaded video streams, detects persons using deep learning (**Ultralytics YOLOv8**), evaluates geometric membership against user-configurable virtual restricted zones, and generates real-time security events with stateful deduplication.

---

## 1. Architectural Architecture & Detection Workflow

```text
Camera / Video Stream
        │
        ▼
Frame Ingestion & Preprocessing (OpenCV)
        │
        ▼
YOLOv8 Person Detection (COCO Class 0)
        │
        ▼
Bounding Box & Ground-Contact Midpoint Calculation: P = ((x1+x2)/2, y2)
        │
        ▼
Ray-Casting Point-in-Polygon & Warning Buffer Distance Evaluation
        │
        ▼
Risk State Evaluation:
 ├─ GREEN  : Normal Monitoring (all targets outside perimeter)
 ├─ YELLOW : Approaching Warning Buffer (early alert)
 └─ RED    : Breach Confirmed (ground reference inside restricted zone)
        │
        ▼
Stateful Deduplication Engine (Suppresses repeated alerts during continuous presence)
        │
        ▼
Database Persistence (SQLite) & Snapshot Capture
        │
        ▼
Live WebSocket Broadcast (ws://localhost:8000/ws/stream)
        │
        ▼
React Dashboard Telemetry, Charts & Web Audio Synthesizer Alerts
```

---

## 2. Core Features

### A. Live Camera Monitoring
- **Direct Browser Ingestion**: Requests user webcam access (`navigator.mediaDevices.getUserMedia`) and previews video independently of backend availability.
- **Source Flexibility**: Seamlessly toggle between live computer webcam, uploaded `.mp4`/`.avi` video footage, and synthetic simulation.
- **Device & Permission Resilience**: Clear error states for camera denial or absent hardware devices.
- **Interactive HUD Canvas**: Real-time bounding box overlays, confidence score tags, ground-contact points, and zone boundaries.

### B. AI Person Detection
- **Real YOLOv8 Inference**: Pretrained on COCO (`yolov8n.pt`), filtered strictly to `class 0 (person)`.
- **Sub-70ms Warm CPU Latency**: Lightweight, efficient CPU/CUDA execution.
- **Ground-Contact Geometry**: Zone membership is calculated using the bottom-center midpoint of the bounding box ($P_{ground} = ((x_1 + x_2)/2, y_2)$) to eliminate false alarms from head height or arm movement.
- **Configurable Sensitivity**: Real-time slider to adjust detection confidence (10% to 95%).

### C. Configurable Virtual Restricted Zones
- **Interactive Polygon Canvas**: Click and drag polygon vertices directly on top of the live video feed.
- **Configurable Risk Severity**: Assign severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) per zone.
- **Buffer Margin Warning**: Proximity buffer distance (15px to 100px) that triggers the **YELLOW** warning state before breach.
- **Preset Templates**: 1-click presets for Central Vault, Access Corridor, Entrance Gate, and Corner Wedge.

### D. Real-Time Event System & Deduplication
- **Structured Schema**:
  ```json
  {
    "event_id": "evt_e5352853c2",
    "event_type": "RESTRICTED_ZONE_ENTRY",
    "zone": "Perimeter Restricted Zone",
    "severity": "HIGH",
    "person_count": 1,
    "confidence": 0.94,
    "timestamp": "2026-10-18T22:25:50Z",
    "acknowledged": false
  }
  ```
- **Stateful Deduplication**: Emits an alert on first breach; suppresses alerts while the target remains inside; emits a distinct new event if the target exits and re-enters.
- **Audit Controls**: Filter by severity/date, acknowledge incidents with timestamp tracking, export CSV reports, and purge audit history.

### E. Industrial Operations Dashboard
- **6 Core KPI Cards**: Monitoring Status, People Detected, Total Zone Entries, Unacknowledged Events, Camera Status, AI Inference Engine.
- **Telemetry Charts**: Hourly violation frequency area chart (Recharts) and incident classification bar charts.
- **Web Audio Alert Synthesizer**: Built-in dual-pulse warning chimes and alternating sirens via Web Audio API (zero external sound file dependencies).

### F. Dual Operational Modes
- **REAL MODE**: Live computer webcam or uploaded video with real YOLOv8 inference.
- **DEMO MODE**: Explicitly labelled simulated operational scenarios for presentations and test walkthroughs. Simulated events are unambiguously prefixed with `[DEMO]`.

---

## 3. Directory Layout

```
ai-guardian/
├── backend/
│   ├── app/
│   │   ├── config.py             # App settings and environment variables
│   │   ├── database.py           # Thread-safe SQLite persistence layer
│   │   ├── models.py             # Pydantic schemas (Event, Zone, Settings, Detection)
│   │   ├── main.py               # FastAPI entrypoint & WebSocket /ws/stream route
│   │   ├── routers/
│   │   │   ├── health.py         # GET /api/health
│   │   │   ├── events.py         # GET, POST, DELETE /api/events, CSV export
│   │   │   ├── zones.py          # GET, POST, PUT, DELETE /api/zones
│   │   │   ├── settings.py       # GET, PUT /api/settings
│   │   │   └── detection.py      # /frame, /upload-video, /start, /stop
│   │   └── services/
│   │       ├── detector.py       # Ultralytics YOLOv8 person detector engine
│   │       ├── zone_service.py   # Ray-casting point-in-polygon math & deduplication
│   │       └── demo_service.py   # Scripted scenario walkthrough generator
│   ├── data/
│   │   ├── guardian.db           # SQLite database
│   │   ├── yolov8n.pt            # Pretrained YOLOv8 model weights
│   │   ├── snapshots/            # Violation snapshot captures
│   │   └── sample_videos/        # Sample surveillance video generator (.mp4)
│   ├── tests/                    # 15 Pytest unit and integration test suites
│   ├── requirements.txt          # Python dependencies
│   └── run.py                    # Backend runner script
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/           # Navbar, Sidebar
│   │   │   ├── dashboard/        # Overview, LiveMonitoring, RestrictedZones, Events, Analytics, Settings
│   │   │   └── common/           # ToastContainer
│   │   ├── context/              # GuardianContext (Centralized state & audio)
│   │   ├── services/             # API client & Web Audio synthesizer
│   │   ├── types/                # TypeScript interfaces
│   │   ├── App.tsx               # Primary dashboard container
│   │   └── index.css             # Dark industrial theme & custom animations
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── .env.example
└── README.md
```

---

## 4. Quickstart & Installation Instructions

### Prerequisites
- **Python**: 3.10+ (tested on Python 3.14)
- **Node.js**: v18+ (tested on Node v24)
- **Webcam**: Standard USB or built-in laptop webcam (or use included sample video)

---

### Step 1: Backend Setup & Startup

1. Open PowerShell and navigate to the backend directory:
   ```powershell
   cd "D:\vs code\miniproject .py\ai-guardian"
   ```

2. Install backend Python dependencies:
   ```powershell
   pip install -r backend/requirements.txt
   ```

3. Run backend tests to verify mathematical and API integrity:
   ```powershell
   python -m pytest backend/tests -v -o pythonpath=backend
   ```
   *(All 15 tests should pass)*

4. Launch the FastAPI server:
   ```powershell
   python backend/run.py
   ```
   *The backend will be available at `http://127.0.0.1:8000` with interactive Swagger docs at `http://127.0.0.1:8000/docs`.*

---

### Step 2: Frontend Setup & Startup

1. Open a second PowerShell terminal in the frontend directory:
   ```powershell
   cd "D:\vs code\miniproject .py\ai-guardian\frontend"
   ```

2. Install frontend dependencies:
   ```powershell
   npm install
   ```

3. Start the Vite development server:
   ```powershell
   npm run dev
   ```
   *The application dashboard will be live at `http://127.0.0.1:5173`.*

---

## 5. How to Operate AI Guardian

### Running Real Detection (REAL MODE)
1. In the top navigation bar, ensure **REAL MODE** is selected.
2. Navigate to **Live Monitoring** on the sidebar.
3. Click **Start Live Camera** to permit camera access.
4. Step in front of the camera:
   - When outside the red boundary, status remains 🟢 **GREEN**.
   - As you approach within the buffer margin, status shifts to 🟡 **YELLOW** and plays a warning chime.
   - When your feet (ground contact) cross into the polygon, status flashes 🔴 **RED**, an industrial siren sounds, a security incident is logged, and a snapshot is captured.
5. If you remain inside, notice that only one entry event is created (deduplicated). Step out and re-enter to trigger a new event.

### Testing Without a Physical Camera
- **Upload Sample Video**: In Live Monitoring, click **Upload Video** and select `backend/data/sample_videos/test_surveillance.mp4` (an included synthetic test corridor video).
- **Switch to DEMO MODE**: Click the **DEMO MODE** button in the header. The application will cycle through a scripted scenario simulating an unauthorized trespasser traversing into the vault.

---

## 6. Verification & Automated Testing

The automated test suite in `backend/tests/` verifies:
- `test_health_endpoint`: Uptime, inference engine readiness, SQLite connectivity.
- `test_zones_crud`: Zone creation, geometric polygon updates, and deletion.
- `test_events_flow`: Event creation, query filtering, sign-off acknowledgement, and CSV export.
- `test_event_deduplication_and_reentry`: Validates that continuous presence suppresses repeated events, and exiting followed by re-entry generates a fresh event.
- `test_zones`: Ray-casting algorithm accuracy for arbitrary polygons and Euclidean point-to-segment distance calculations.
- `test_validation_and_errors`: Invalid video extensions, non-existent 404 endpoints, malformed base64 image decoding, and polygon vertex constraints.

---

## 7. Known Hardware Limitations & Design Considerations

1. **CPU vs GPU Inference**:
   - On standard CPU hardware, warm frame latency is ~60-70ms (14-16 FPS), which is responsive for security monitoring.
   - For 60+ FPS high-density multi-camera CCTV deployment, an NVIDIA CUDA GPU or TensorRT export is recommended.
2. **Browser Permissions**:
   - `getUserMedia` requires secure contexts (`http://localhost` or `https://`).
   - If camera access is denied by browser settings, the dashboard gracefully explains how to enable permissions or use video upload/demo mode.
