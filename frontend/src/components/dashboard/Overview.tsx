import React from 'react';
import {
  ShieldAlert,
  Users,
  Activity,
  AlertTriangle,
  Video,
  Cpu,
  CheckCircle,
  Clock,
  ArrowUpRight,
  Play,
  Square,
  Sparkles
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useGuardian } from '../../context/GuardianContext';
import { api } from '../../services/api';

export const Overview: React.FC<{ onNavigateToLive: () => void; onNavigateToEvents: () => void }> = ({
  onNavigateToLive,
  onNavigateToEvents
}) => {
  const {
    health,
    mode,
    riskState,
    latestDetections,
    events,
    isMonitoringActive,
    setIsMonitoringActive,
    isCameraConnected,
    acknowledgeEvent,
    refreshEvents,
    addToast
  } = useGuardian();

  const totalEntries = events.filter(e => e.event_type.includes('ENTRY')).length;
  const unackEvents = events.filter(e => !e.acknowledged);

  // Group events for hourly activity chart
  const chartData = React.useMemo(() => {
    const hoursMap: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600000);
      const hStr = `${d.getHours().toString().padStart(2, '0')}:00`;
      hoursMap[hStr] = 0;
    }
    events.forEach(e => {
      const d = new Date(e.timestamp);
      const hStr = `${d.getHours().toString().padStart(2, '0')}:00`;
      if (hoursMap[hStr] !== undefined) {
        hoursMap[hStr]++;
      }
    });
    return Object.keys(hoursMap).map(h => ({
      hour: h,
      incidents: hoursMap[h]
    }));
  }, [events]);

  const handleToggleMonitoring = async () => {
    try {
      if (isMonitoringActive) {
        await api.stopDetection();
        setIsMonitoringActive(false);
        addToast('Surveillance monitoring paused', 'info');
      } else {
        await api.startDetection();
        setIsMonitoringActive(true);
        addToast('Surveillance monitoring resumed', 'success');
      }
    } catch (e: any) {
      addToast(`Error toggling monitoring: ${e.message}`, 'danger');
    }
  };

  const handleSeedDemo = async () => {
    try {
      await api.seedDemoEvents(4);
      await refreshEvents();
      addToast('Simulated demonstration events seeded', 'success');
    } catch (e: any) {
      addToast(`Error seeding demo events: ${e.message}`, 'danger');
    }
  };

  return (
    <div className="space-y-6">
      {/* Risk Banner if Warning or Breach */}
      {riskState !== 'GREEN' && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            riskState === 'RED'
              ? 'bg-rose-950/40 border-rose-600/60 text-rose-200 pulse-danger'
              : 'bg-amber-950/40 border-amber-600/60 text-amber-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-6 h-6 animate-bounce" />
            <div>
              <div className="font-bold text-sm uppercase tracking-wider">
                {riskState === 'RED'
                  ? 'CRITICAL ALERT: RESTRICTED ZONE BREACH IN PROGRESS'
                  : 'WARNING: PERSON APPROACHING PERIMETER BOUNDARY'}
              </div>
              <div className="text-xs opacity-90">
                {riskState === 'RED'
                  ? 'Ground-contact reference point detected inside virtual security zone.'
                  : 'Target located within buffer perimeter. Visual monitoring recommended.'}
              </div>
            </div>
          </div>
          <button
            onClick={onNavigateToLive}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold tracking-wider uppercase transition-all shadow-md"
          >
            Open Live Feed
          </button>
        </div>
      )}

      {/* 6 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Monitoring Status */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Monitoring</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold font-mono text-slate-100 flex items-center space-x-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isMonitoringActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>{isMonitoringActive ? 'ACTIVE' : 'PAUSED'}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {isMonitoringActive ? 'Continuous CV inspection' : 'Manual standby mode'}
            </div>
          </div>
        </div>

        {/* Card 2: People Currently Detected */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">People Detected</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-100">
              {latestDetections.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {latestDetections.length > 0 ? 'Active visual targets' : 'Zero targets in view'}
            </div>
          </div>
        </div>

        {/* Card 3: Total Restricted-Zone Entries */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Zone Entries</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-100">
              {totalEntries}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Deduplicated breach incidents</div>
          </div>
        </div>

        {/* Card 4: Events Requiring Acknowledgement */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Unacknowledged</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-400">
              {unackEvents.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Pending security sign-off</div>
          </div>
        </div>

        {/* Card 5: Camera Status */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Camera Feed</span>
            <Video className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-base font-bold font-mono text-slate-100 flex items-center space-x-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isCameraConnected ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              />
              <span>{isCameraConnected ? 'CONNECTED' : 'STANDBY'}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {isCameraConnected ? '640x480 Direct Ingestion' : 'Browser webcam waiting'}
            </div>
          </div>
        </div>

        {/* Card 6: AI Inference Engine */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">AI Inference</span>
            <Cpu className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3">
            <div className="text-base font-bold font-mono text-slate-100">
              {health?.model_loaded ? 'YOLOv8n' : 'OFFLINE'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Device: {health?.inference_device || 'CPU'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Detection Activity Chart & Quick Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detection Activity Trend Chart */}
        <div className="lg:col-span-2 bg-guardian-card border border-guardian-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Security Incident Frequency (Past 6 Hours)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Hourly aggregate of restricted-zone entry alerts
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-1 rounded bg-guardian-panel border border-guardian-border text-slate-300">
              Live Telemetry
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="incidentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#243049',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="incidents"
                  stroke="#38BDF8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#incidentGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Operations & System Health Panel */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-1">
              Operations Center
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Direct controls for AI Guardian surveillance state
            </p>

            <div className="space-y-3">
              <button
                onClick={handleToggleMonitoring}
                className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold tracking-wider uppercase flex items-center justify-center space-x-2 transition-all ${
                  isMonitoringActive
                    ? 'bg-amber-600/20 text-amber-300 border border-amber-600/40 hover:bg-amber-600/30'
                    : 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-600/30'
                }`}
              >
                {isMonitoringActive ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Pause Surveillance</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume Surveillance</span>
                  </>
                )}
              </button>

              <button
                onClick={onNavigateToLive}
                className="w-full py-2.5 px-4 rounded-lg text-xs font-bold tracking-wider uppercase bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center space-x-2 transition-all shadow-md shadow-sky-950"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Launch Camera Monitor</span>
              </button>

              <button
                onClick={handleSeedDemo}
                className="w-full py-2 px-3 rounded-lg text-xs font-medium text-slate-300 bg-guardian-panel border border-guardian-border hover:border-slate-500 flex items-center justify-center space-x-2 transition-all"
                title="Generates demonstration records for walkthrough"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Seed Sample Walkthrough Events</span>
              </button>
            </div>
          </div>

          {/* System Uptime / SQLite Diagnostics */}
          <div className="p-3 bg-guardian-panel/70 rounded-lg border border-guardian-border space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Database:</span>
              <span className="text-slate-200">SQLite (Local)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Backend Uptime:</span>
              <span className="text-slate-200">{health?.backend_uptime_seconds || 0}s</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>WebSocket Clients:</span>
              <span className="text-slate-200">{health?.active_ws_connections || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Incidents Table */}
      <div className="bg-guardian-card border border-guardian-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Recent Security Incidents
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live audit trail of zone perimeter crossings
            </p>
          </div>
          <button
            onClick={onNavigateToEvents}
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center space-x-1 font-medium"
          >
            <span>View All Records</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {events.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs">
            No security events logged yet. Monitor live feed or click "Seed Sample Walkthrough Events".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-guardian-border bg-guardian-panel/40">
                <tr>
                  <th className="py-2.5 px-3">Event ID</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Zone</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-guardian-border/50 text-slate-300">
                {events.slice(0, 5).map(evt => (
                  <tr key={evt.event_id} className="hover:bg-guardian-panel/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-200">
                      {evt.event_id}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-200">{evt.zone}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                          evt.severity === 'CRITICAL'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : evt.severity === 'HIGH'
                            ? 'bg-rose-900/60 text-rose-200 border border-rose-700'
                            : evt.severity === 'MEDIUM'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {evt.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {(evt.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3">
                      {evt.is_demo ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800">
                          DEMO
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-sky-950 text-sky-400 border border-sky-800">
                          REAL
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {evt.acknowledged ? (
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
                    <td className="py-2.5 px-3 text-right">
                      {!evt.acknowledged && (
                        <button
                          onClick={() => acknowledgeEvent(evt.event_id)}
                          className="px-2.5 py-1 bg-guardian-panel hover:bg-sky-600 hover:text-white border border-guardian-border rounded text-[11px] font-medium text-slate-300 transition-all"
                        >
                          Acknowledge
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
