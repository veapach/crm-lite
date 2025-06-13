import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import NewReport from './pages/NewReport';
import Reports from './pages/Reports';
import Files from './pages/Files';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import Requests from './pages/Requests';
import Admin from './pages/Admin';
import MaintenancePage from './pages/MaintenancePage';
import Statistics from './pages/Statistics';
import Schedule from './pages/Schedule';
import Inventory from './pages/Inventory';
import axios from "axios";
import config from "./config";
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

axios.defaults.withCredentials = true;
axios.defaults.baseURL = `${config.API_BASE_URL}`;

function App() {
  const [serverAvailable, setServerAvailable] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const { isAuthenticated, user, loading } = useAuth();

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

  // Проверка, является ли пользователь администратором
  const isAdmin = user && user.department === 'Админ';

  return (
    <Router>
      <Navbar />
      <div className="container content-wrapper">
        <Routes>
          <Route path="/auth" element={isAuthenticated ? <Navigate to="/" replace /> : <Auth />} />
          <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/auth" replace />} />
          <Route path="/schedule" element={isAuthenticated ? <Schedule /> : <Navigate to="/auth" replace />} />
          <Route path="/new-report" element={isAuthenticated ? <NewReport /> : <Navigate to="/auth" replace />} />
          <Route path="/reports" element={isAuthenticated ? <Reports /> : <Navigate to="/auth" replace />} />
          <Route path="/files" element={isAuthenticated ? <Files /> : <Navigate to="/auth" replace />} />
          <Route path="/inventory" element={isAuthenticated ? <Inventory /> : <Navigate to="/auth" replace />} />
          <Route path="/profile" element={isAuthenticated ? <Profile /> : <Navigate to="/auth" replace />} />
          <Route path="/requests" element={isAuthenticated ? <Requests /> : <Navigate to="/auth" replace />} />
          <Route path="/statistics" element={isAuthenticated ? <Statistics /> : <Navigate to="/auth" replace />} />
          <Route path="/admin" element={isAuthenticated && isAdmin ? <Admin /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </Router>
  );
}

export default function WrappedApp() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

