export type RiskState = 'GREEN' | 'YELLOW' | 'RED';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AppMode = 'REAL' | 'DEMO';

export interface EventItem {
  event_id: string;
  event_type: string;
  zone: string;
  zone_id?: string;
  severity: Severity;
  person_count: number;
  confidence: number;
  timestamp: string;
  snapshot_path?: string;
  snapshot_base64?: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  is_demo: boolean;
  details?: Record<string, any>;
}

export interface Zone {
  id: string;
  name: string;
  polygon: [number, number][]; // normalized [0..1]
  severity: Severity;
  warning_buffer: number;
  enabled: boolean;
  color: string;
}

export interface DetectedPerson {
  id: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2] normalized
  confidence: number;
  reference_point: [number, number]; // [x, y] ground contact
  status: 'OUTSIDE' | 'WARNING' | 'INSIDE_RESTRICTED';
  zone_name?: string;
  zone_id?: string;
}

export interface FrameResult {
  timestamp: string;
  person_count: number;
  detections: DetectedPerson[];
  risk_state: RiskState;
  active_violations: number;
  new_events: EventItem[];
  inference_time_ms: number;
  mode: AppMode;
  model_online: boolean;
}

export interface SystemHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  backend_uptime_seconds: number;
  model_loaded: boolean;
  model_name: string;
  inference_device: string;
  database_connected: boolean;
  active_ws_connections: number;
  total_events: number;
  unacknowledged_events: number;
  timestamp: string;
}

export interface AppSettings {
  confidence_threshold: number;
  detection_interval_ms: number;
  warning_buffer_px: number;
  snapshot_enabled: boolean;
  alert_sound_enabled: boolean;
  default_mode: string;
  active_camera_id?: string;
}

export interface EventStats {
  total_events: number;
  unacknowledged_events: number;
  by_severity: Record<string, number>;
  by_zone: Record<string, number>;
}
