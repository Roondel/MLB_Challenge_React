import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './components/layout/Toast';
import ErrorBoundary from './components/layout/ErrorBoundary';
import Sidebar from './components/layout/Sidebar';
import BottomNav from './components/layout/BottomNav';
import Header from './components/layout/Header';
import DashboardPage from './pages/DashboardPage';
import MapPage from './pages/MapPage';
import TripPlannerPage from './pages/TripPlannerPage';
import GalleryPage from './pages/GalleryPage';
import ParkDetailPage from './pages/ParkDetailPage';
import { useNearbyNotifier } from './hooks/useNearbyNotifier';
import { isIosSafari, isRunningAsStandalone } from './services/notifications';

const IOS_PROMPT_KEY = 'ballpark_ios_prompt_dismissed';

function IosInstallBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(IOS_PROMPT_KEY) === 'true'
  );

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(IOS_PROMPT_KEY, 'true');
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-50 bg-dark-800 border-t border-dark-700 px-4 py-3 flex items-center gap-3 text-sm">
      <span className="flex-1 text-gray-200">
        Add to Home Screen to enable ballpark proximity notifications.
      </span>
      <button onClick={dismiss} className="text-gray-400 hover:text-white shrink-0">
        Dismiss
      </button>
    </div>
  );
}

function AppShell() {
  useNearbyNotifier();
  const showIosBanner = isIosSafari() && !isRunningAsStandalone();

  return (
    <div className="flex min-h-screen bg-dark-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 pb-16 lg:pb-0">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/trip" element={<TripPlannerPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/parks/:parkId" element={<ParkDetailPage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
      {showIosBanner && <IosInstallBanner />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
