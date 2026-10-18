import React from 'react';
import {
  LayoutDashboard,
  Camera,
  Layers,
  AlertTriangle,
  BarChart3,
  Settings,
  CircleDot
} from 'lucide-react';
import { useGuardian } from '../../context/GuardianContext';

export type NavTab = 'overview' | 'live' | 'zones' | 'events' | 'analytics' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { events, riskState, mode } = useGuardian();

  const unackCount = events.filter(e => !e.acknowledged).length;

  const navItems = [
    {
      id: 'overview' as NavTab,
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'live' as NavTab,
      label: 'Live Monitoring',
      icon: Camera,
      badge: riskState === 'RED' ? 'BREACH' : riskState === 'YELLOW' ? 'WARN' : null,
      badgeColor: riskState === 'RED' ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-500 text-slate-950',
    },
    {
      id: 'zones' as NavTab,
      label: 'Restricted Zones',
      icon: Layers,
      badge: null,
    },
    {
      id: 'events' as NavTab,
      label: 'Security Events',
      icon: AlertTriangle,
      badge: unackCount > 0 ? unackCount.toString() : null,
      badgeColor: 'bg-rose-600 text-white',
    },
    {
      id: 'analytics' as NavTab,
      label: 'Analytics',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 border-r border-guardian-border bg-guardian-card flex flex-col justify-between select-none">
      <div className="p-4 space-y-6">
        {/* Navigation list */}
        <nav className="space-y-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-guardian-panel text-sky-400 border border-guardian-border shadow-sm shadow-sky-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-guardian-panel/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      item.badgeColor || 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mode Status Footer Callout */}
      <div className="p-4 border-t border-guardian-border/80 bg-guardian-panel/30">
        <div className="flex items-center space-x-2.5">
          <CircleDot
            className={`w-3.5 h-3.5 ${
              mode === 'REAL' ? 'text-sky-400 animate-pulse' : 'text-amber-400'
            }`}
          />
          <div>
            <div className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
              {mode === 'REAL' ? 'Active Real AI Mode' : 'Demo Simulation Mode'}
            </div>
            <div className="text-[10px] text-slate-400">
              {mode === 'REAL' ? 'Real OpenCV + YOLOv8 inference' : 'Scripted operational scenarios'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
