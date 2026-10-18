import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Upload,
  Camera,
  Play,
  Square,
  RefreshCw,
  Sliders,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  Maximize2
} from 'lucide-react';
import { useGuardian } from '../../context/GuardianContext';
import { api } from '../../services/api';
import { DetectedPerson, Zone } from '../../types';

export const LiveMonitoring: React.FC = () => {
  const {
    mode,
    riskState,
    setRiskState,
    latestDetections,
    setLatestDetections,
    zones,
    refreshZones,
    addNewEvents,
    health,
    isCameraConnected,
    setIsCameraConnected,
    addToast
  } = useGuardian();

  // Media elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // States
  const [sourceType, setSourceType] = useState<'webcam' | 'video' | 'synthetic'>('webcam');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [saveSnapshots, setSaveSnapshots] = useState<boolean>(true);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number>(0);
  const [activeZone, setActiveZone] = useState<Zone | null>(null);
  const [dragVertexIndex, setDragVertexIndex] = useState<number | null>(null);

  // FPS tracking
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(Date.now());

  // Set active zone from context
  useEffect(() => {
    if (zones.length > 0) {
      setActiveZone(zones[selectedZoneIndex] || zones[0]);
    }
  }, [zones, selectedZoneIndex]);

  // Establish WebSocket connection for live inference
  useEffect(() => {
    const wsUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
      .replace('http://', 'ws://')
      .replace('https://', 'wss://') + '/ws/stream';

    const connectWs = () => {
      try {
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          console.log('Detection WebSocket connected.');
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'detection_result') {
              setLatestDetections(data.detections || []);
              setRiskState(data.risk_state || 'GREEN');
              setLatencyMs(data.inference_time_ms || 0);

              if (data.new_events && data.new_events.length > 0) {
                addNewEvents(data.new_events);
              }
            }
          } catch (err) {
            console.error('Error parsing WS message:', err);
          }
        };
        ws.onerror = (err) => {
          console.warn('WebSocket connection error, will use REST fallback if needed:', err);
        };
        ws.onclose = () => {
          console.log('WebSocket closed.');
        };
        wsRef.current = ws;
      } catch (err) {
        console.error('Failed to create WebSocket:', err);
      }
    };

    connectWs();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [setLatestDetections, setRiskState, addNewEvents]);

  // Start webcam
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API (getUserMedia) not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
        setIsCameraConnected(true);
        setSourceType('webcam');
        addToast('Live camera feed connected', 'success');
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setIsCameraConnected(false);
      setIsStreaming(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera permissions in your browser address bar.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera device detected on this system. You can upload a video file or switch to DEMO MODE.');
      } else {
        setCameraError(`Camera initialization failed: ${err.message || 'Unknown device error'}`);
      }
      addToast('Camera could not be accessed. Demo mode and video upload available.', 'warning');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setIsCameraConnected(false);
    setLatestDetections([]);
    setRiskState('GREEN');
    addToast('Camera monitoring stopped', 'info');
  };

  // Handle uploaded video file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      addToast('Please select a valid video file (.mp4, .webm, etc.)', 'danger');
      return;
    }

    const url = URL.createObjectURL(file);
    setUploadedVideoUrl(url);
    setSourceType('video');
    setCameraError(null);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = url;
      videoRef.current.loop = true;
      videoRef.current.muted = true;
      videoRef.current.play();
      setIsStreaming(true);
      setIsCameraConnected(true);
      addToast(`Playing uploaded video: ${file.name}`, 'success');
    }
  };

  // Frame processing loop
  useEffect(() => {
    let animId: number;
    let lastInferenceTime = 0;
    const intervalMs = mode === 'DEMO' ? 180 : 120;

    const captureAndInfer = async () => {
      const now = Date.now();

      // Update FPS counter
      frameCountRef.current++;
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      // Check if ready for next inference cycle
      if (now - lastInferenceTime >= intervalMs) {
        lastInferenceTime = now;

        const video = videoRef.current;
        const canvas = offscreenCanvasRef.current;

        // If streaming real video
        if (isStreaming && video && video.readyState >= 2 && canvas) {
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, 640, 480);
            const base64Data = canvas.toDataURL('image/jpeg', 0.65);

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'frame',
                image: base64Data,
                mode: mode,
                save_snapshot: saveSnapshots
              }));
            } else {
              // REST fallback
              try {
                const res = await api.sendFrame({
                  image_base64: base64Data,
                  mode: mode,
                  save_snapshot: saveSnapshots
                });
                setLatestDetections(res.detections);
                setRiskState(res.risk_state);
                setLatencyMs(res.inference_time_ms);
                if (res.new_events && res.new_events.length > 0) {
                  addNewEvents(res.new_events);
                }
              } catch (err) {
                // Backend error fallback
              }
            }
          }
        } else if (mode === 'DEMO') {
          // If in DEMO MODE with no physical camera streaming, still request demo frames
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'frame',
              image: '',
              mode: 'DEMO'
            }));
          }
        }
      }

      animId = requestAnimationFrame(captureAndInfer);
    };

    animId = requestAnimationFrame(captureAndInfer);
    return () => cancelAnimationFrame(animId);
  }, [isStreaming, mode, saveSnapshots, setLatestDetections, setRiskState, addNewEvents]);

  // Render canvas overlay (Zones, bounding boxes, status HUD)
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Draw virtual restricted zones
    zones.forEach((z) => {
      if (!z.enabled || z.polygon.length < 3) return;

      const pts = z.polygon.map(([px, py]) => [px * w, py * h]);

      // Warning Buffer outline
      const bufferPx = (z.warning_buffer / 640) * w;
      ctx.save();
      ctx.strokeStyle = riskState === 'YELLOW' ? '#F59E0B' : 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      // Expanded boundary approximation
      pts.forEach(([x, y], idx) => {
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Restricted Zone polygon
      ctx.save();
      ctx.beginPath();
      pts.forEach(([x, y], idx) => {
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();

      // Fill
      if (riskState === 'RED') {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
      } else {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      }
      ctx.fill();

      // Border
      ctx.strokeStyle = riskState === 'RED' ? '#EF4444' : 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Zone label
      const firstPt = pts[0];
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`⊘ ${z.name.toUpperCase()} [${z.severity}]`, firstPt[0] + 6, firstPt[1] + 16);

      // Draw vertices as draggable handles if this is the active zone
      if (activeZone && activeZone.id === z.id) {
        pts.forEach(([vx, vy], vIdx) => {
          ctx.beginPath();
          ctx.arc(vx, vy, 5, 0, Math.PI * 2);
          ctx.fillStyle = dragVertexIndex === vIdx ? '#38BDF8' : '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }
      ctx.restore();
    });

    // 2. Draw detected people bounding boxes
    latestDetections.forEach((det) => {
      const [x1n, y1n, x2n, y2n] = det.bbox;
      const x1 = x1n * w;
      const y1 = y1n * h;
      const bw = (x2n - x1n) * w;
      const bh = (y2n - y1n) * h;

      const isBreaching = det.status === 'INSIDE_RESTRICTED';
      const isWarning = det.status === 'WARNING';

      const boxColor = isBreaching ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981';

      ctx.save();
      // Bounding box
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, bw, bh);

      // Corner accent brackets
      const bracketLen = 10;
      ctx.lineWidth = 3;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(x1, y1 + bracketLen);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + bracketLen, y1);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(x1 + bw, y1 + bh - bracketLen);
      ctx.lineTo(x1 + bw, y1 + bh);
      ctx.lineTo(x1 + bw - bracketLen, y1 + bh);
      ctx.stroke();

      // Label background
      const label = `PERSON ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 11px monospace';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = boxColor;
      ctx.fillRect(x1, Math.max(0, y1 - 18), textWidth + 10, 18);

      // Label text
      ctx.fillStyle = '#0F172A';
      ctx.fillText(label, x1 + 5, Math.max(12, y1 - 4));

      // Ground contact point dot
      const [gx, gy] = det.reference_point;
      ctx.beginPath();
      ctx.arc(gx * w, gy * h, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = boxColor;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Ground crosshair indicator
      ctx.strokeStyle = boxColor;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(gx * w - 8, gy * h);
      ctx.lineTo(gx * w + 8, gy * h);
      ctx.moveTo(gx * w, gy * h - 8);
      ctx.lineTo(gx * w, gy * h + 8);
      ctx.stroke();

      ctx.restore();
    });
  }, [zones, activeZone, latestDetections, riskState, dragVertexIndex]);

  // Handle vertex dragging on overlay canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeZone || !overlayCanvasRef.current) return;
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    // Check if clicked close to any vertex
    for (let i = 0; i < activeZone.polygon.length; i++) {
      const [vx, vy] = activeZone.polygon[i];
      const dist = Math.hypot(clickX - vx, clickY - vy);
      if (dist < 0.05) {
        setDragVertexIndex(i);
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragVertexIndex === null || !activeZone || !overlayCanvasRef.current) return;
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const newX = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
    const newY = Math.max(0.02, Math.min(0.98, (e.clientY - rect.top) / rect.height));

    const updatedPoly: [number, number][] = [...activeZone.polygon];
    updatedPoly[dragVertexIndex] = [round(newX), round(newY)];

    setActiveZone({ ...activeZone, polygon: updatedPoly });
  };

  const handleCanvasMouseUp = async () => {
    if (dragVertexIndex !== null && activeZone) {
      setDragVertexIndex(null);
      try {
        await api.updateZone(activeZone.id, activeZone);
        await refreshZones();
        addToast(`Updated polygon boundary for ${activeZone.name}`, 'info');
      } catch (err: any) {
        console.error('Failed to save updated zone polygon:', err);
      }
    }
  };

  const round = (val: number) => Math.round(val * 1000) / 1000;

  return (
    <div className="space-y-6">
      {/* Top HUD Banner showing industrial Risk State */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 transition-all ${
          riskState === 'RED'
            ? 'bg-rose-950/60 border-rose-600 text-rose-100 pulse-danger'
            : riskState === 'YELLOW'
            ? 'bg-amber-950/50 border-amber-600 text-amber-200'
            : 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
        }`}
      >
        <div className="flex items-center space-x-3">
          {riskState === 'RED' ? (
            <ShieldAlert className="w-5 h-5 text-rose-400 animate-bounce" />
          ) : riskState === 'YELLOW' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          )}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">
              {riskState === 'RED'
                ? 'STATE: CRITICAL BREACH - PERSON IN RESTRICTED ZONE'
                : riskState === 'YELLOW'
                ? 'STATE: WARNING - PERIMETER APPROACH DETECTED'
                : 'STATE: NORMAL MONITORING - PERIMETER SECURE'}
            </div>
            <div className="text-[11px] opacity-80">
              {riskState === 'RED'
                ? 'Active violation recorded. Security notification dispatched.'
                : riskState === 'YELLOW'
                ? 'Target within warning buffer zone. Continuous tracking active.'
                : 'No unauthorized targets inside defined virtual restricted boundaries.'}
            </div>
          </div>
        </div>

        {/* Telemetry chips */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="px-2 py-1 rounded bg-black/40 border border-white/10">
            FPS: <strong className="text-white">{fps}</strong>
          </span>
          <span className="px-2 py-1 rounded bg-black/40 border border-white/10">
            LATENCY: <strong className="text-white">{latencyMs.toFixed(0)}ms</strong>
          </span>
          <span className="px-2 py-1 rounded bg-black/40 border border-white/10">
            TARGETS: <strong className="text-white">{latestDetections.length}</strong>
          </span>
        </div>
      </div>

      {/* Camera Preview and Canvas Overlay Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Video Viewport (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-guardian-border aspect-[4/3] max-h-[560px] flex items-center justify-center shadow-xl">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />

            {/* Video element */}
            <video
              ref={videoRef}
              className={`w-full h-full object-contain ${!isStreaming ? 'hidden' : ''}`}
              playsInline
              muted
            />

            {/* Canvas overlay for bounding boxes & zones */}
            <canvas
              ref={overlayCanvasRef}
              width={640}
              height={480}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              className="absolute inset-0 w-full h-full object-contain cursor-crosshair z-10"
            />

            {/* Offscreen canvas for frame capture */}
            <canvas ref={offscreenCanvasRef} className="hidden" />

            {/* Offline / Idle Placeholder */}
            {!isStreaming && (
              <div className="text-center p-6 space-y-4 z-10">
                <div className="w-16 h-16 rounded-full bg-guardian-panel border border-guardian-border flex items-center justify-center mx-auto text-slate-500">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                    Camera Feed Standby
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 mx-auto">
                    Click "Start Live Camera" to connect your computer's webcam, or upload a test video file to analyze.
                  </p>
                </div>

                {cameraError && (
                  <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-300 text-xs text-left max-w-md mx-auto">
                    <strong>Notice:</strong> {cameraError}
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold tracking-wider uppercase transition-all shadow-md"
                  >
                    Start Live Camera
                  </button>
                  <label className="px-4 py-2 bg-guardian-panel hover:bg-slate-700 text-slate-200 border border-guardian-border rounded-lg text-xs font-bold tracking-wider uppercase cursor-pointer transition-all">
                    <span>Upload Test Video</span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Corner HUD Badges */}
            <div className="absolute top-3 left-3 z-20 flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/70 backdrop-blur border border-white/10 text-emerald-400">
                ● LIVE FEED
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/70 backdrop-blur border border-white/10 text-slate-300">
                {sourceType === 'webcam' ? 'WEBCAM 0' : 'VIDEO FILE'}
              </span>
            </div>

            <div className="absolute top-3 right-3 z-20">
              {mode === 'DEMO' ? (
                <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-amber-950/80 border border-amber-600 text-amber-300 shadow">
                  DEMO MODE (Simulated)
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-sky-950/80 border border-sky-600 text-sky-300 shadow">
                  REAL MODE (YOLOv8n)
                </span>
              )}
            </div>

            {/* Vertex edit helper tooltip */}
            <div className="absolute bottom-3 left-3 z-20 text-[10px] text-slate-400 bg-black/60 px-2 py-1 rounded border border-white/5 font-mono">
              💡 Tip: Click and drag white polygon vertices to resize restricted zone.
            </div>
          </div>

          {/* Primary Camera Controls Bar */}
          <div className="bg-guardian-card border border-guardian-border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              {isStreaming ? (
                <button
                  onClick={stopCamera}
                  className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/40 rounded-lg text-xs font-bold tracking-wider uppercase flex items-center space-x-1.5 transition-all"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Camera</span>
                </button>
              ) : (
                <button
                  onClick={startCamera}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold tracking-wider uppercase flex items-center space-x-1.5 transition-all shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Camera</span>
                </button>
              )}

              <label className="px-3.5 py-2 bg-guardian-panel hover:bg-slate-700 text-slate-300 border border-guardian-border rounded-lg text-xs font-bold tracking-wider uppercase cursor-pointer flex items-center space-x-1.5 transition-all">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Video</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex items-center space-x-4 text-xs text-slate-400">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveSnapshots}
                  onChange={(e) => setSaveSnapshots(e.target.checked)}
                  className="rounded bg-guardian-panel border-guardian-border text-sky-500 focus:ring-0"
                />
                <span>Capture snapshots on breach</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Monitoring Settings & Zone Inspector (1 col) */}
        <div className="space-y-4">
          {/* Active Zone Selector */}
          <div className="bg-guardian-card border border-guardian-border rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Zone Selection</span>
            </h3>

            <div className="space-y-1.5">
              {zones.map((z, idx) => (
                <button
                  key={z.id}
                  onClick={() => {
                    setSelectedZoneIndex(idx);
                    setActiveZone(z);
                  }}
                  className={`w-full p-2.5 rounded-lg border text-left text-xs transition-all ${
                    activeZone?.id === z.id
                      ? 'bg-guardian-panel border-sky-500/60 text-slate-100 shadow-sm'
                      : 'border-guardian-border/60 text-slate-400 hover:bg-guardian-panel/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{z.name}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        z.severity === 'CRITICAL'
                          ? 'bg-rose-950 text-rose-300'
                          : 'bg-amber-950 text-amber-300'
                      }`}
                    >
                      {z.severity}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {z.polygon.length} vertices • Buffer: {z.warning_buffer}px
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Real-Time Detection Output HUD */}
          <div className="bg-guardian-card border border-guardian-border rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Active Targets ({latestDetections.length})
            </h3>

            {latestDetections.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                No people detected in frame.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {latestDetections.map((det) => (
                  <div
                    key={det.id}
                    className={`p-2.5 rounded-lg border text-xs font-mono space-y-1 ${
                      det.status === 'INSIDE_RESTRICTED'
                        ? 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                        : det.status === 'WARNING'
                        ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                        : 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                    }`}
                  >
                    <div className="flex justify-between items-center font-bold">
                      <span>Target #{det.id} (Person)</span>
                      <span>{(det.confidence * 100).toFixed(0)}% Conf</span>
                    </div>
                    <div className="text-[11px] flex justify-between opacity-90">
                      <span>Status:</span>
                      <strong className="uppercase">{det.status.replace('_', ' ')}</strong>
                    </div>
                    <div className="text-[10px] opacity-75">
                      Ground Contact: ({det.reference_point[0].toFixed(2)}, {det.reference_point[1].toFixed(2)})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Model & System Telemetry */}
          <div className="bg-guardian-card border border-guardian-border rounded-xl p-4 space-y-2 text-xs">
            <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
              Engine Diagnostics
            </h4>
            <div className="space-y-1 font-mono text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="text-slate-200">Ultralytics YOLOv8n</span>
              </div>
              <div className="flex justify-between">
                <span>Class Filter:</span>
                <span className="text-slate-200">0 (person only)</span>
              </div>
              <div className="flex justify-between">
                <span>Reference Point:</span>
                <span className="text-slate-200">Bottom-Center Midpoint</span>
              </div>
              <div className="flex justify-between">
                <span>Deduplication:</span>
                <span className="text-emerald-400">Enabled (3.0s window)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
