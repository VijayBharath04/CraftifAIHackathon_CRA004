import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { SystemHealth, EventItem, Zone, AppSettings, RiskState, AppMode, DetectedPerson } from '../types';
import { api } from '../services/api';
import { industrialAudio } from '../services/audio';

export interface ToastItem {
  id: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  message: string;
}

interface GuardianContextType {
  health: SystemHealth | null;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  riskState: RiskState;
  setRiskState: (state: RiskState) => void;
  latestDetections: DetectedPerson[];
  setLatestDetections: (d: DetectedPerson[]) => void;
  events: EventItem[];
  zones: Zone[];
  settings: AppSettings | null;
  isMonitoringActive: boolean;
  setIsMonitoringActive: (active: boolean) => void;
  isCameraConnected: boolean;
  setIsCameraConnected: (connected: boolean) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  toasts: ToastItem[];
  addToast: (msg: string, type?: 'info' | 'warning' | 'danger' | 'success') => void;
  removeToast: (id: string) => void;
  refreshEvents: () => Promise<void>;
  refreshZones: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  acknowledgeEvent: (id: string) => Promise<void>;
  addNewEvents: (newEvts: EventItem[]) => void;
}

const GuardianContext = createContext<GuardianContextType | undefined>(undefined);

export const GuardianProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [mode, setModeState] = useState<AppMode>('REAL');
  const [riskState, setRiskState] = useState<RiskState>('GREEN');
  const [latestDetections, setLatestDetections] = useState<DetectedPerson[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isMonitoringActive, setIsMonitoringActive] = useState<boolean>(true);
  const [isCameraConnected, setIsCameraConnected] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: 'info' | 'warning' | 'danger' | 'success' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
    addToast(`Switched to ${newMode === 'REAL' ? 'REAL MODE (Live Inference)' : 'DEMO MODE (Simulated Scenarios)'}`, 'info');
  }, [addToast]);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      industrialAudio.enabled = next;
      addToast(next ? 'Audio alarms enabled' : 'Audio alarms muted', 'info');
      return next;
    });
  }, [addToast]);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await api.getHealth();
      setHealth(h);
    } catch {
      setHealth(prev => prev ? { ...prev, status: 'OFFLINE' } : null);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      const evts = await api.getEvents({ limit: 40 });
      setEvents(evts);
    } catch (e: any) {
      console.error('Failed to load events:', e);
    }
  }, []);

  const refreshZones = useCallback(async () => {
    try {
      const z = await api.getZones();
      setZones(z);
    } catch (e: any) {
      console.error('Failed to load zones:', e);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
      if (s.alert_sound_enabled !== undefined) {
        setSoundEnabled(s.alert_sound_enabled);
        industrialAudio.enabled = s.alert_sound_enabled;
      }
    } catch (e: any) {
      console.error('Failed to load settings:', e);
    }
  }, []);

  const acknowledgeEvent = useCallback(async (id: string) => {
    try {
      const updated = await api.acknowledgeEvent(id);
      setEvents(prev => prev.map(e => e.event_id === id ? updated : e));
      addToast(`Event ${id} acknowledged`, 'success');
      refreshHealth();
    } catch (e: any) {
      addToast(`Failed to acknowledge event: ${e.message}`, 'danger');
    }
  }, [addToast, refreshHealth]);

  const addNewEvents = useCallback((newEvts: EventItem[]) => {
    if (!newEvts || newEvts.length === 0) return;
    setEvents(prev => [...newEvts, ...prev].slice(0, 50));
    newEvts.forEach(evt => {
      const prefix = evt.is_demo ? '[DEMO] ' : '';
      addToast(`${prefix}SECURITY ALERT: ${evt.zone} breached!`, 'danger');
      industrialAudio.playBreachAlarm();
    });
    refreshHealth();
  }, [addToast, refreshHealth]);

  // Initial loads
  useEffect(() => {
    refreshHealth();
    refreshEvents();
    refreshZones();
    refreshSettings();

    const interval = setInterval(refreshHealth, 6000);
    return () => clearInterval(interval);
  }, [refreshHealth, refreshEvents, refreshZones, refreshSettings]);

  // Play chimes based on riskState transitions
  useEffect(() => {
    if (riskState === 'RED') {
      industrialAudio.playBreachAlarm();
    } else if (riskState === 'YELLOW') {
      industrialAudio.playWarningChime();
    }
  }, [riskState]);

  return (
    <GuardianContext.Provider
      value={{
        health,
        mode,
        setMode,
        riskState,
        setRiskState,
        latestDetections,
        setLatestDetections,
        events,
        zones,
        settings,
        isMonitoringActive,
        setIsMonitoringActive,
        isCameraConnected,
        setIsCameraConnected,
        soundEnabled,
        toggleSound,
        toasts,
        addToast,
        removeToast,
        refreshEvents,
        refreshZones,
        refreshHealth,
        refreshSettings,
        acknowledgeEvent,
        addNewEvents,
      }}
    >
      {children}
    </GuardianContext.Provider>
  );
};

export const useGuardian = () => {
  const context = useContext(GuardianContext);
  if (!context) {
    throw new Error('useGuardian must be used within a GuardianProvider');
  }
  return context;
};
