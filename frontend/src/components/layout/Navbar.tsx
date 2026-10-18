import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Video, VideoOff, Volume2, VolumeX, Activity, Cpu } from 'lucide-react';
import { useGuardian } from '../../context/GuardianContext';

export const Navbar: React.FC = () => {
  const {
    health,
    mode,
    setMode,
    isCameraConnected,
    isMonitoringActive,
    soundEnabled,
    toggleSound
  } = useGuardian();

  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isHealthy = health?.status === 'HEALTHY';
  const isDegraded = health?.status === 'DEGRADED';

  return (
    <header className="h-16 border-b border-guardian-border bg-guardian-card px-4 md:px-6 flex items-center justify-between z-20 select-none">
      {/* Brand & Title */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-guardian-panel border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-sm shadow-sky-500/10">
          <Shield className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold tracking-wider text-slate-100 uppercase">AI GUARDIAN</h1>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-sky-950 text-sky-300 border border-sky-800">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block tracking-wide">
            Real-Time AI Camera Surveillance & Restricted-Zone Detection
          </p>
        </div>
      </div>

      {/* Center / Right Control Cluster */}
      <div className="flex items-center space-x-3 md:space-x-5">
        {/* Mode Selector Pill (REAL vs DEMO) */}
        <div className="flex items-center bg-guardian-panel p-1 rounded-lg border border-guardian-border">
          <button
            onClick={() => setMode('REAL')}
            className={`px-3 py-1 rounded text-xs font-semibold tracking-wide transition-all ${
              mode === 'REAL'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Uses actual webcam or uploaded video with real YOLOv8 inference"
          >
            REAL MODE
          </button>
          <button
            onClick={() => setMode('DEMO')}
            className={`px-3 py-1 rounded text-xs font-semibold tracking-wide transition-all flex items-center space-x-1 ${
              mode === 'DEMO'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Runs simulated operational walkthrough scenarios"
          >
            <span>DEMO MODE</span>
          </button>
        </div>

        {/* Camera Connection Badge */}
        <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-guardian-panel border border-guardian-border text-xs font-mono">
          {isCameraConnected ? (
            <>
              <Video className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">CAM LIVE</span>
            </>
          ) : (
            <>
              <VideoOff className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">CAM IDLE</span>
            </>
          )}
        </div>

        {/* Inference Engine Status */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-guardian-panel border border-guardian-border text-xs font-mono">
          <Cpu className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-300">
            {health?.model_loaded ? `YOLOv8 (${health.inference_device})` : 'AI OFFLINE'}
          </span>
        </div>

        {/* Backend Health Badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-guardian-panel border border-guardian-border text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              isHealthy
                ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                : isDegraded
                ? 'bg-amber-500 shadow-sm shadow-amber-500/50'
                : 'bg-rose-500 shadow-sm shadow-rose-500/50'
            }`}
          />
          <span
            className={`${
              isHealthy
                ? 'text-emerald-400 font-medium'
                : isDegraded
                ? 'text-amber-400'
                : 'text-rose-400 font-medium'
            }`}
          >
            {health?.status || 'CONNECTING...'}
          </span>
        </div>

        {/* Audio Alert Toggle */}
        <button
          onClick={toggleSound}
          className={`p-2 rounded-lg border transition-all ${
            soundEnabled
              ? 'bg-guardian-panel text-sky-400 border-guardian-border hover:border-sky-500/50'
              : 'bg-guardian-panel text-slate-500 border-guardian-border hover:text-slate-300'
          }`}
          title={soundEnabled ? 'Mute Security Audio Alarms' : 'Enable Security Audio Alarms'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Clock */}
        <div className="hidden xl:block text-xs font-mono text-slate-400 tracking-wider">
          {currentTime}
        </div>
      </div>
    </header>
  );
};
