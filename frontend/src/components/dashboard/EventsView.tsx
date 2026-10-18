import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Download,
  Trash2,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Eye,
  X,
  Camera,
  ShieldAlert
} from 'lucide-react';
import { useGuardian } from '../../context/GuardianContext';
import { EventItem, Severity } from '../../types';
import { api } from '../../services/api';

export const EventsView: React.FC = () => {
  const { events, refreshEvents, acknowledgeEvent, addToast } = useGuardian();

  // Filters
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedAckStatus, setSelectedAckStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeEvent, setActiveEvent] = useState<EventItem | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (selectedSeverity !== 'ALL' && e.severity !== selectedSeverity) return false;
      if (selectedAckStatus === 'UNACK' && e.acknowledged) return false;
      if (selectedAckStatus === 'ACK' && !e.acknowledged) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          e.event_id.toLowerCase().includes(q) ||
          e.zone.toLowerCase().includes(q) ||
          e.event_type.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [events, selectedSeverity, selectedAckStatus, searchQuery]);

  const handleExportCsv = () => {
    const url = api.getCsvExportUrl(
      selectedSeverity !== 'ALL' ? selectedSeverity : undefined
    );
    window.open(url, '_blank');
    addToast('Security event log exported as CSV', 'info');
  };

  const handleClearHistory = async () => {
    try {
      const res = await api.clearEvents();
      addToast(res.message, 'info');
      setIsConfirmingClear(false);
      setActiveEvent(null);
      await refreshEvents();
    } catch (err: any) {
      addToast(`Error clearing events: ${err.message}`, 'danger');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-100 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>Security Incident Logs</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit history of virtual perimeter violations and restricted-zone entries
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start">
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-guardian-panel hover:bg-slate-700 text-slate-200 border border-guardian-border rounded-lg text-xs font-bold tracking-wider uppercase flex items-center space-x-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsConfirmingClear(true)}
            className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800 rounded-lg text-xs font-bold tracking-wider uppercase flex items-center space-x-1.5 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-guardian-card border border-guardian-border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by ID or Zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-guardian-panel border border-guardian-border rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500 w-48 sm:w-56"
            />
          </div>

          {/* Severity filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-2.5 py-1.5 bg-guardian-panel border border-guardian-border rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Ack filter */}
          <select
            value={selectedAckStatus}
            onChange={(e) => setSelectedAckStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-guardian-panel border border-guardian-border rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNACK">Pending Acknowledgement</option>
            <option value="ACK">Acknowledged</option>
          </select>
        </div>

        <div className="text-slate-400 font-mono">
          Showing <strong>{filteredEvents.length}</strong> of <strong>{events.length}</strong> incidents
        </div>
      </div>

      {/* Event Table */}
      <div className="bg-guardian-card border border-guardian-border rounded-xl overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            No security events found matching the specified criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-guardian-border bg-guardian-panel/50">
                <tr>
                  <th className="py-3 px-3.5">Event ID</th>
                  <th className="py-3 px-3.5">Timestamp</th>
                  <th className="py-3 px-3.5">Zone</th>
                  <th className="py-3 px-3.5">Severity</th>
                  <th className="py-3 px-3.5">Confidence</th>
                  <th className="py-3 px-3.5">Source Mode</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-guardian-border/60 text-slate-300">
                {filteredEvents.map((e) => (
                  <tr
                    key={e.event_id}
                    onClick={() => setActiveEvent(e)}
                    className="hover:bg-guardian-panel/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3.5 font-mono font-medium text-slate-200">
                      {e.event_id}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-400">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-slate-200">{e.zone}</td>
                    <td className="py-2.5 px-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          e.severity === 'CRITICAL'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : e.severity === 'HIGH'
                            ? 'bg-rose-900/60 text-rose-200 border border-rose-700'
                            : e.severity === 'MEDIUM'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {e.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 font-mono">
                      {(e.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3.5">
                      {e.is_demo ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800">
                          DEMO
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-sky-950 text-sky-400 border border-sky-800">
                          REAL
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5">
                      {e.acknowledged ? (
                        <span className="flex items-center space-x-1 text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Acknowledged</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                      {!e.acknowledged && (
                        <button
                          onClick={() => acknowledgeEvent(e.event_id)}
                          className="px-2.5 py-1 bg-guardian-panel hover:bg-sky-600 hover:text-white border border-guardian-border rounded text-[11px] font-medium text-slate-300 transition-all"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => setActiveEvent(e)}
                        className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Event Details Drawer / Modal */}
      {activeEvent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-guardian-card border border-guardian-border rounded-xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-guardian-border">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  Incident Inspection: {activeEvent.event_id}
                </h3>
              </div>
              <button
                onClick={() => setActiveEvent(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Snapshot Preview if available */}
            {activeEvent.snapshot_base64 ? (
              <div className="border border-guardian-border rounded-lg overflow-hidden bg-black max-h-52 flex items-center justify-center">
                <img
                  src={activeEvent.snapshot_base64}
                  alt="Incident snapshot"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="p-4 bg-guardian-panel/50 rounded-lg border border-guardian-border text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                <Camera className="w-4 h-4 text-slate-500" />
                <span>No snapshot captured for this event (snapshot capture disabled or demo)</span>
              </div>
            )}

            {/* Event Metadata Key-Values */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 bg-guardian-panel rounded-lg border border-guardian-border">
                <div className="text-[10px] text-slate-400">EVENT TYPE</div>
                <div className="text-slate-200 font-bold mt-0.5">{activeEvent.event_type}</div>
              </div>
              <div className="p-2.5 bg-guardian-panel rounded-lg border border-guardian-border">
                <div className="text-[10px] text-slate-400">ZONE</div>
                <div className="text-slate-200 font-bold mt-0.5">{activeEvent.zone}</div>
              </div>
              <div className="p-2.5 bg-guardian-panel rounded-lg border border-guardian-border">
                <div className="text-[10px] text-slate-400">SEVERITY</div>
                <div className="text-rose-400 font-bold mt-0.5">{activeEvent.severity}</div>
              </div>
              <div className="p-2.5 bg-guardian-panel rounded-lg border border-guardian-border">
                <div className="text-[10px] text-slate-400">CONFIDENCE</div>
                <div className="text-slate-200 font-bold mt-0.5">
                  {(activeEvent.confidence * 100).toFixed(1)}%
                </div>
              </div>
              <div className="col-span-2 p-2.5 bg-guardian-panel rounded-lg border border-guardian-border">
                <div className="text-[10px] text-slate-400">TIMESTAMP</div>
                <div className="text-slate-200 mt-0.5">{activeEvent.timestamp}</div>
              </div>
            </div>

            {/* Ack actions */}
            <div className="pt-2 flex justify-between items-center">
              <div>
                {activeEvent.acknowledged ? (
                  <span className="text-xs text-emerald-400 flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Acknowledged at {new Date(activeEvent.acknowledged_at || '').toLocaleTimeString()}</span>
                  </span>
                ) : (
                  <span className="text-xs text-amber-400 flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>Awaiting Security Sign-off</span>
                  </span>
                )}
              </div>
              {!activeEvent.acknowledged && (
                <button
                  onClick={() => {
                    acknowledgeEvent(activeEvent.event_id);
                    setActiveEvent({ ...activeEvent, acknowledged: true });
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Acknowledge Incident
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {isConfirmingClear && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-guardian-card border border-guardian-border rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Confirm Audit Trail Purge</span>
            </h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to clear all stored security events? This will permanently delete event records from the local SQLite database.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsConfirmingClear(false)}
                className="px-3 py-1.5 bg-guardian-panel text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider"
              >
                Clear All Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
