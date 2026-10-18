import { SystemHealth, EventItem, Zone, AppSettings, EventStats, FrameResult, AppMode } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let errorMsg = `API Error ${response.status}: ${response.statusText}`;
    try {
      const errData = await response.json();
      if (errData.detail) errorMsg = errData.detail;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Health
  getHealth: (): Promise<SystemHealth> => fetchJson<SystemHealth>('/api/health'),

  // Events
  getEvents: (params?: {
    limit?: number;
    offset?: number;
    severity?: string;
    zone?: string;
    acknowledged?: boolean;
    is_demo?: boolean;
    search?: string;
  }): Promise<EventItem[]> => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.severity) query.set('severity', params.severity);
    if (params?.zone) query.set('zone', params.zone);
    if (params?.acknowledged !== undefined) query.set('acknowledged', String(params.acknowledged));
    if (params?.is_demo !== undefined) query.set('is_demo', String(params.is_demo));
    if (params?.search) query.set('search', params.search);
    return fetchJson<EventItem[]>(`/api/events?${query.toString()}`);
  },

  getEventStats: (): Promise<EventStats> => fetchJson<EventStats>('/api/events/stats'),

  getEventById: (id: string): Promise<EventItem> => fetchJson<EventItem>(`/api/events/${id}`),

  acknowledgeEvent: (id: string): Promise<EventItem> =>
    fetchJson<EventItem>(`/api/events/${id}/acknowledge`, { method: 'POST' }),

  clearEvents: (keepUnacknowledged = false): Promise<{ message: string; deleted_count: number }> =>
    fetchJson<{ message: string; deleted_count: number }>(`/api/events?keep_unacknowledged=${keepUnacknowledged}`, {
      method: 'DELETE'
    }),

  seedDemoEvents: (count = 8): Promise<{ message: string }> =>
    fetchJson<{ message: string }>(`/api/events/seed-demo?count=${count}`, { method: 'POST' }),

  getCsvExportUrl: (severity?: string, zone?: string): string => {
    const query = new URLSearchParams();
    if (severity) query.set('severity', severity);
    if (zone) query.set('zone', zone);
    return `${API_BASE_URL}/api/events/export/csv?${query.toString()}`;
  },

  // Zones
  getZones: (): Promise<Zone[]> => fetchJson<Zone[]>('/api/zones'),

  createZone: (zone: Zone): Promise<Zone> =>
    fetchJson<Zone>('/api/zones', {
      method: 'POST',
      body: JSON.stringify(zone)
    }),

  updateZone: (id: string, zone: Zone): Promise<Zone> =>
    fetchJson<Zone>(`/api/zones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(zone)
    }),

  deleteZone: (id: string): Promise<{ message: string }> =>
    fetchJson<{ message: string }>(`/api/zones/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: (): Promise<AppSettings> => fetchJson<AppSettings>('/api/settings'),

  updateSettings: (settings: AppSettings): Promise<AppSettings> =>
    fetchJson<AppSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    }),

  // Detection
  startDetection: () => fetchJson<{ status: string; message: string }>('/api/detection/start', { method: 'POST' }),

  stopDetection: () => fetchJson<{ status: string; message: string }>('/api/detection/stop', { method: 'POST' }),

  sendFrame: (payload: {
    image_base64: string;
    mode: AppMode;
    confidence_threshold?: number;
    save_snapshot?: boolean;
  }): Promise<FrameResult> =>
    fetchJson<FrameResult>('/api/detection/frame', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  uploadVideo: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/api/detection/upload-video`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    return response.json();
  }
};
