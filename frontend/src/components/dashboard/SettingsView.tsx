import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Camera, Bell, Shield, Database, Cpu } from 'lucide-react';
import { useGuardian } from '../../context/GuardianContext';
import { AppSettings } from '../../types';
import { api } from '../../services/api';

export const SettingsView: React.FC = () => {
  const { settings, refreshSettings, health, addToast } = useGuardian();

  const [formData, setFormData] = useState<AppSettings>({
    confidence_threshold: 0.45,
    detection_interval_ms: 150,
    warning_buffer_px: 40,
    snapshot_enabled: true,
    alert_sound_enabled: true,
    default_mode: 'REAL',
    active_camera_id: 'default'
  });

  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load available camera devices
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoDevs = devices.filter(d => d.kind === 'videoinput');
        setAvailableDevices(videoDevs);
      }).catch(err => {
        console.warn('Could not enumerate media devices:', err);
      });
    }
  }, []);

  // Sync formData with settings
  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateSettings(formData);
      await refreshSettings();
      addToast('System settings updated successfully', 'success');
    } catch (err: any) {
      addToast(`Error saving settings: ${err.message}`, 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-100 flex items-center space-x-2">
            <SettingsIcon className="w-5 h-5 text-sky-400" />
            <span>Surveillance Engine Configuration</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure computer vision thresholds, frame ingestion frequency, and security protocols
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold tracking-wider uppercase flex items-center space-x-1.5 transition-all shadow-md self-start"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Computer Vision Thresholds */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span>AI Model & Inference Parameters</span>
          </h3>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Detection Confidence Threshold</span>
              <span className="font-mono text-sky-400">
                {(formData.confidence_threshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.95"
              step="0.05"
              value={formData.confidence_threshold}
              onChange={(e) => setFormData({ ...formData, confidence_threshold: parseFloat(e.target.value) })}
              className="w-full accent-sky-400"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Minimum YOLOv8 confidence score required to qualify bounding boxes.
            </p>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Inference Interval (Throttle)</span>
              <span className="font-mono text-sky-400">{formData.detection_interval_ms} ms</span>
            </div>
            <input
              type="range"
              min="50"
              max="500"
              step="25"
              value={formData.detection_interval_ms}
              onChange={(e) => setFormData({ ...formData, detection_interval_ms: parseInt(e.target.value) })}
              className="w-full accent-sky-400"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Frequency between frame inference requests (~{(1000 / formData.detection_interval_ms).toFixed(0)} FPS).
            </p>
          </div>
        </div>

        {/* Video & Camera Hardware */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Camera Hardware Ingestion</span>
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Default Camera Device
            </label>
            <select
              value={formData.active_camera_id || 'default'}
              onChange={(e) => setFormData({ ...formData, active_camera_id: e.target.value })}
              className="w-full px-3 py-2 bg-guardian-panel border border-guardian-border rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-500"
            >
              <option value="default">Default System Webcam</option>
              {availableDevices.map((dev, idx) => (
                <option key={dev.deviceId || idx} value={dev.deviceId}>
                  {dev.label || `Camera Device ${idx + 1}`}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Detected local video capture peripherals.
            </p>
          </div>

          <div className="pt-2">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.snapshot_enabled}
                onChange={(e) => setFormData({ ...formData, snapshot_enabled: e.target.checked })}
                className="rounded bg-guardian-panel border-guardian-border text-sky-500 focus:ring-0"
              />
              <span className="text-xs text-slate-200">
                Save frame snapshot on confirmed zone entry breach
              </span>
            </label>
            <p className="text-[11px] text-slate-400 mt-1 pl-6">
              Embeds compressed visual snapshot with event record for audit review.
            </p>
          </div>
        </div>

        {/* Security & Audio Alarms */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Alerts & Sound Chimes</span>
          </h3>

          <div>
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.alert_sound_enabled}
                onChange={(e) => setFormData({ ...formData, alert_sound_enabled: e.target.checked })}
                className="rounded bg-guardian-panel border-guardian-border text-sky-500 focus:ring-0"
              />
              <span className="text-xs text-slate-200">
                Enable Web Audio synthesized industrial alert sirens
              </span>
            </label>
            <p className="text-[11px] text-slate-400 mt-1 pl-6">
              Plays dual-pulse chimes on warning proximity and alternating sirens on confirmed entry breach.
            </p>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Default Warning Buffer Margin</span>
              <span className="font-mono text-amber-400">{formData.warning_buffer_px} px</span>
            </div>
            <input
              type="range"
              min="15"
              max="100"
              step="5"
              value={formData.warning_buffer_px}
              onChange={(e) => setFormData({ ...formData, warning_buffer_px: parseInt(e.target.value) })}
              className="w-full accent-amber-400"
            />
          </div>
        </div>

        {/* Backend & Database Telemetry */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <Database className="w-4 h-4 text-slate-400" />
            <span>Backend Diagnostic Telemetry</span>
          </h3>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between p-2 rounded bg-guardian-panel border border-guardian-border">
              <span className="text-slate-400">Backend Status:</span>
              <span className="text-emerald-400 font-bold">{health?.status || 'UNKNOWN'}</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-guardian-panel border border-guardian-border">
              <span className="text-slate-400">Model:</span>
              <span className="text-slate-200">{health?.model_name || 'YOLOv8n'}</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-guardian-panel border border-guardian-border">
              <span className="text-slate-400">Compute Device:</span>
              <span className="text-sky-400">{health?.inference_device || 'CPU'}</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-guardian-panel border border-guardian-border">
              <span className="text-slate-400">Database Engine:</span>
              <span className="text-slate-200">SQLite (Local persistent)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
