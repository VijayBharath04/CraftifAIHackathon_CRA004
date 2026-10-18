import React, { useState } from 'react';
import { GuardianProvider } from './context/GuardianContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Overview } from './components/dashboard/Overview';
import { LiveMonitoring } from './components/dashboard/LiveMonitoring';
import { RestrictedZones } from './components/dashboard/RestrictedZones';
import { EventsView } from './components/dashboard/EventsView';
import { AnalyticsView } from './components/dashboard/AnalyticsView';
import { SettingsView } from './components/dashboard/SettingsView';
import { ToastContainer } from './components/common/ToastContainer';

function GuardianApp() {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');

  return (
    <div className="min-h-screen bg-guardian-bg text-slate-100 flex flex-col font-sans antialiased">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-guardian-bg">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'overview' && (
              <Overview
                onNavigateToLive={() => setCurrentTab('live')}
                onNavigateToEvents={() => setCurrentTab('events')}
              />
            )}
            {currentTab === 'live' && <LiveMonitoring />}
            {currentTab === 'zones' && <RestrictedZones />}
            {currentTab === 'events' && <EventsView />}
            {currentTab === 'analytics' && <AnalyticsView />}
            {currentTab === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <GuardianProvider>
      <GuardianApp />
    </GuardianProvider>
  );
}
