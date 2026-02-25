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

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
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
          </div>
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
