import React, { useMemo } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, ShieldCheck, PieChart as PieIcon } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useGuardian } from '../../context/GuardianContext';

export const AnalyticsView: React.FC = () => {
  const { events } = useGuardian();

  // Zone distribution
  const zoneData = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach(e => {
      map[e.zone] = (map[e.zone] || 0) + 1;
    });
    return Object.keys(map).map(zone => ({
      name: zone,
      violations: map[zone]
    }));
  }, [events]);

  // Severity breakdown
  const severityData = useMemo(() => {
    const map: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };
    events.forEach(e => {
      if (map[e.severity] !== undefined) {
        map[e.severity]++;
      }
    });
    return [
      { name: 'Critical', count: map.CRITICAL, color: '#EF4444' },
      { name: 'High', count: map.HIGH, color: '#F87171' },
      { name: 'Medium', count: map.MEDIUM, color: '#F59E0B' },
      { name: 'Low', count: map.LOW, color: '#64748B' }
    ];
  }, [events]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold uppercase tracking-wider text-slate-100 flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-sky-400" />
          <span>Surveillance Analytics & Risk Intelligence</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Spatial risk patterns, severity distribution, and perimeter breach trends
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Violations by Zone */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Breaches by Restricted Zone
            </h3>
            <span className="text-xs text-slate-400 font-mono">Location Heatmap</span>
          </div>

          <div className="h-64 w-full">
            {zoneData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Insufficient incident data to render chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zoneData} layout="vertical">
                  <XAxis type="number" stroke="#64748B" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#64748B" fontSize={11} width={130} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderColor: '#243049',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="violations" fill="#38BDF8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Incident Severity Breakdown
            </h3>
            <span className="text-xs text-slate-400 font-mono">Threat Classification</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData}>
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#243049',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
