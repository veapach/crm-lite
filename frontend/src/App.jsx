import React, { useState, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';

import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import NewReport from './pages/NewReport';
import Reports from './pages/Reports';
import Files from './pages/Files';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import Admin from './pages/Admin';
import MaintenancePage from './pages/MaintenancePage';
import Statistics from './pages/Statistics';
import TravelSheet from './pages/TravelSheet';
import Tickets from './pages/clients/Tickets';
import ClientAuth from './pages/clients/ClientAuth';
import ClientTickets from './pages/clients/ClientTickets';
import InnerTickets from './pages/InnerTickets';
import axios from "axios";
import config from "./config";
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClientAuthProvider, useClientAuth } from './context/ClientAuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import { NewTicketsProvider, useNewTickets } from './context/NewTicketsContext';

axios.defaults.withCredentials = true;
axios.defaults.baseURL = `${config.API_BASE_URL}`;

function NewTicketsBanner() {
  const { hasNewTickets } = useNewTickets() || { hasNewTickets: false };
  const location = useLocation();
  const navigate = useNavigate();
  const hideOnTickets = location.pathname === '/inner-tickets';
  if (!hasNewTickets || hideOnTickets) return null;
  return (
    <div className="vv-banner-container">
      <div className="vv-banner-alert" onClick={() => navigate('/inner-tickets')} role="button" aria-label="Перейти к заявкам" tabIndex={0}>
        Новая заявка
      </div>
    </div>
  );
}

function App() {
  const [serverAvailable, setServerAvailable] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  const isClient = user?.department === 'Клиент';
  const isAdmin = user && user.department === 'Админ';
  const isViewOnly = user?.phone === 'viewonlyuser';
  const isTicketsPage = location.pathname === '/tickets';
  const isClientPage = location.pathname.startsWith('/client');
  const hideNavbar = (isTicketsPage && (!isAuthenticated || isClient)) || isClientPage;

  useEffect(() => {
    const checkServerAvailability = async () => {
      try {
        await axios.get('/api/check-health', { timeout: 5000 });
        setServerAvailable(true);
      } catch {
        setServerAvailable(false);
      } finally {
        setInitialCheckDone(true);
      }
    };

    checkServerAvailability();
  }, []);

  // Показываем индикатор загрузки, пока проверяем авторизацию
  if (loading || !initialCheckDone) {
    return <div className="loading-container">Загрузка...</div>;
  }

  if (!serverAvailable) {
    return <MaintenancePage />;
  }

  return (
    <>
      {!hideNavbar && <Navbar />}
      {!hideNavbar && <NewTicketsBanner />}
      <div className={!hideNavbar ? 'content-wrapper' : ''}>
        <Routes>
          <Route path="/auth" element={isAuthenticated ? <Navigate to="/" replace /> : <Auth />} />
          <Route path="/tickets" element={<Tickets />} />
          {/* Клиентский портал */}
          <Route path="/client/auth" element={<ClientAuth />} />
          <Route path="/client/tickets" element={<ClientTickets />} />
          <Route path="/" element={isAuthenticated ? (isViewOnly ? <Navigate to="/reports" replace /> : <Dashboard />) : <Navigate to="/tickets" replace />} />
          <Route path="/new-report" element={isAuthenticated ? (isViewOnly ? <Navigate to="/reports" replace /> : <NewReport />) : <Navigate to="/auth" replace />} />
          <Route path="/reports" element={isAuthenticated ? <Reports /> : <Navigate to="/auth" replace />} />
          <Route path="/inner-tickets" element={isAuthenticated ? (isViewOnly ? <Navigate to="/reports" replace /> : <InnerTickets />) : <Navigate to="/auth" replace />} />
          <Route path="/files" element={isAuthenticated ? (isViewOnly ? <Navigate to="/reports" replace /> : <Files />) : <Navigate to="/auth" replace />} />
          <Route path="/travel-sheet" element={isAuthenticated ? (isViewOnly ? <Navigate to="/reports" replace /> : <TravelSheet />) : <Navigate to="/auth" replace />} />
          <Route path="/profile" element={isAuthenticated ? <Profile /> : <Navigate to="/auth" replace />} />
          <Route path="/statistics" element={isAuthenticated ? (isViewOnly ? <Navigate to="/reports" replace /> : <Statistics />) : <Navigate to="/auth" replace />} />
          <Route path="/admin" element={isAuthenticated && isAdmin ? <Admin /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/tickets" replace />} />
        </Routes>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

export default function WrappedApp() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ClientAuthProvider>
          <BrowserRouter>
            <NewTicketsProvider>
              <App />
            </NewTicketsProvider>
          </BrowserRouter>
        </ClientAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

