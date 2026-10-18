import React, { useState, useRef, useEffect } from 'react';
import { Layers, Plus, Trash2, Edit3, Check, X, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { useGuardian } from '../../context/GuardianContext';
import { Zone, Severity } from '../../types';
import { api } from '../../services/api';

export const RestrictedZones: React.FC = () => {
  const { zones, refreshZones, addToast } = useGuardian();

  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dragVertexIndex, setDragVertexIndex] = useState<number | null>(null);

  // Set default selection
  useEffect(() => {
    if (zones.length > 0 && !selectedZone && !isCreatingNew) {
      setSelectedZone(zones[0]);
      setEditingZone(zones[0]);
    }
  }, [zones, selectedZone, isCreatingNew]);

  // Preset templates
  const applyPreset = (type: 'center' | 'corridor' | 'gate' | 'triangle') => {
    let poly: [number, number][] = [];
    let name = 'Custom Zone';

    if (type === 'center') {
      name = 'Central Vault Perimeter';
      poly = [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]];
    } else if (type === 'corridor') {
      name = 'Access Hallway Corridor';
      poly = [[0.35, 0.10], [0.65, 0.10], [0.65, 0.90], [0.35, 0.90]];
    } else if (type === 'gate') {
      name = 'Main Entrance Gate';
      poly = [[0.15, 0.50], [0.85, 0.50], [0.85, 0.90], [0.15, 0.90]];
    } else if (type === 'triangle') {
      name = 'Corner Security Perimeter';
      poly = [[0.10, 0.10], [0.85, 0.10], [0.50, 0.85]];
    }

    if (editingZone) {
      setEditingZone({ ...editingZone, name, polygon: poly });
    }
  };

  // Canvas drawing of polygon
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !editingZone) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw background blueprint grid
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const pts = editingZone.polygon.map(([px, py]) => [px * w, py * h]);
    if (pts.length < 2) return;

    // Draw Warning Buffer
    const buffer = editingZone.warning_buffer;
    ctx.save();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    pts.forEach(([x, y], idx) => {
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Draw Restricted Polygon
    ctx.save();
    ctx.beginPath();
    pts.forEach(([x, y], idx) => {
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.fill();
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw Vertices
    pts.forEach(([vx, vy], idx) => {
      ctx.beginPath();
      ctx.arc(vx, vy, 6, 0, Math.PI * 2);
      ctx.fillStyle = dragVertexIndex === idx ? '#38BDF8' : '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Vertex Index label
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px monospace';
      ctx.fillText(`V${idx + 1}`, vx + 8, vy - 6);
    });
    ctx.restore();
  }, [editingZone, dragVertexIndex]);

  // Vertex Dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editingZone || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    for (let i = 0; i < editingZone.polygon.length; i++) {
      const [vx, vy] = editingZone.polygon[i];
      if (Math.hypot(clickX - vx, clickY - vy) < 0.05) {
        setDragVertexIndex(i);
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragVertexIndex === null || !editingZone || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.02, Math.min(0.98, (e.clientY - rect.top) / rect.height));

    const updatedPoly: [number, number][] = [...editingZone.polygon];
    updatedPoly[dragVertexIndex] = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
    setEditingZone({ ...editingZone, polygon: updatedPoly });
  };

  const handleMouseUp = () => {
    setDragVertexIndex(null);
  };

  // Add vertex on double click
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editingZone || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 1000;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 1000;

    setEditingZone({
      ...editingZone,
      polygon: [...editingZone.polygon, [x, y]]
    });
    addToast('Vertex added to polygon', 'info');
  };

  const handleSaveZone = async () => {
    if (!editingZone) return;
    if (editingZone.polygon.length < 3) {
      addToast('A polygon zone requires at least 3 vertices', 'danger');
      return;
    }

    try {
      if (isCreatingNew) {
        await api.createZone(editingZone);
        addToast(`Created restricted zone '${editingZone.name}'`, 'success');
        setIsCreatingNew(false);
      } else {
        await api.updateZone(editingZone.id, editingZone);
        addToast(`Updated zone '${editingZone.name}'`, 'success');
      }
      await refreshZones();
    } catch (err: any) {
      addToast(`Error saving zone: ${err.message}`, 'danger');
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (zones.length <= 1) {
      addToast('At least one security zone must remain configured', 'warning');
      return;
    }
    try {
      await api.deleteZone(id);
      addToast('Restricted zone deleted', 'info');
      await refreshZones();
      setSelectedZone(null);
      setEditingZone(null);
    } catch (err: any) {
      addToast(`Error deleting zone: ${err.message}`, 'danger');
    }
  };

  const startNewZone = () => {
    const newZone: Zone = {
      id: `zone_${Date.now().toString(36)}`,
      name: `New Zone ${zones.length + 1}`,
      polygon: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]],
      severity: 'HIGH',
      warning_buffer: 40,
      enabled: true,
      color: '#EF4444'
    };
    setIsCreatingNew(true);
    setSelectedZone(newZone);
    setEditingZone(newZone);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-100 flex items-center space-x-2">
            <Layers className="w-5 h-5 text-sky-400" />
            <span>Virtual Restricted Zones</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure polygon boundaries, risk severity levels, and buffer proximity alerts
          </p>
        </div>
        <button
          onClick={startNewZone}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold tracking-wider uppercase flex items-center space-x-1.5 transition-all shadow-md self-start"
        >
          <Plus className="w-4 h-4" />
          <span>New Zone</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Zones List (1 col) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Zones ({zones.length})
          </h3>
          <div className="space-y-2">
            {zones.map((z) => (
              <div
                key={z.id}
                onClick={() => {
                  setIsCreatingNew(false);
                  setSelectedZone(z);
                  setEditingZone(z);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedZone?.id === z.id && !isCreatingNew
                    ? 'bg-guardian-panel border-sky-500 text-slate-100 shadow-md'
                    : 'bg-guardian-card border-guardian-border text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs">{z.name}</div>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                      z.severity === 'CRITICAL'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : z.severity === 'HIGH'
                        ? 'bg-rose-900/60 text-rose-200 border border-rose-700'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {z.severity}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                  <span>{z.polygon.length} Vertices</span>
                  <span>Buffer: {z.warning_buffer}px</span>
                  <span className={z.enabled ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                    {z.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Interactive Canvas Editor & Form (2 cols) */}
        <div className="lg:col-span-2 bg-guardian-card border border-guardian-border rounded-xl p-5 space-y-5">
          {editingZone ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-guardian-border">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    {isCreatingNew ? 'Create New Restricted Zone' : `Configure: ${editingZone.name}`}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {!isCreatingNew && (
                    <button
                      onClick={() => handleDeleteZone(editingZone.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-950/40 transition-colors"
                      title="Delete Zone"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={handleSaveZone}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold tracking-wider uppercase flex items-center space-x-1.5 transition-all shadow-md"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>

              {/* Template Presets Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 mr-1">Presets:</span>
                <button
                  onClick={() => applyPreset('center')}
                  className="px-2.5 py-1 rounded bg-guardian-panel border border-guardian-border hover:border-slate-500 text-[11px] text-slate-300"
                >
                  Central Vault
                </button>
                <button
                  onClick={() => applyPreset('corridor')}
                  className="px-2.5 py-1 rounded bg-guardian-panel border border-guardian-border hover:border-slate-500 text-[11px] text-slate-300"
                >
                  Corridor Hallway
                </button>
                <button
                  onClick={() => applyPreset('gate')}
                  className="px-2.5 py-1 rounded bg-guardian-panel border border-guardian-border hover:border-slate-500 text-[11px] text-slate-300"
                >
                  Entrance Gate
                </button>
                <button
                  onClick={() => applyPreset('triangle')}
                  className="px-2.5 py-1 rounded bg-guardian-panel border border-guardian-border hover:border-slate-500 text-[11px] text-slate-300"
                >
                  Corner Wedge
                </button>
              </div>

              {/* Interactive Canvas */}
              <div className="relative border border-guardian-border rounded-xl overflow-hidden bg-slate-950 aspect-[4/3] max-h-[380px]">
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onDoubleClick={handleDoubleClick}
                  className="w-full h-full object-contain cursor-crosshair"
                />
                <div className="absolute bottom-2 left-2 text-[10px] text-slate-400 bg-black/60 px-2 py-1 rounded border border-white/5 font-mono">
                  Drag white nodes to adjust geometry. Double-click to add a new vertex.
                </div>
              </div>

              {/* Zone Configuration Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Zone Name
                  </label>
                  <input
                    type="text"
                    value={editingZone.name}
                    onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })}
                    className="w-full px-3 py-2 bg-guardian-panel border border-guardian-border rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Alert Severity
                  </label>
                  <select
                    value={editingZone.severity}
                    onChange={(e) => setEditingZone({ ...editingZone, severity: e.target.value as Severity })}
                    className="w-full px-3 py-2 bg-guardian-panel border border-guardian-border rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Warning Buffer: {editingZone.warning_buffer}px
                  </label>
                  <input
                    type="range"
                    min="15"
                    max="100"
                    step="5"
                    value={editingZone.warning_buffer}
                    onChange={(e) => setEditingZone({ ...editingZone, warning_buffer: parseInt(e.target.value) })}
                    className="w-full mt-2 accent-sky-400"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-slate-500 text-xs">
              Select a restricted zone to inspect and configure geometry.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
