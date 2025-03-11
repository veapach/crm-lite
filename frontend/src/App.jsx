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
import MaintenancePage from './pages/MaintenancePage';
import axios from "axios";
import config from "./config";
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

axios.defaults.withCredentials = true;
axios.defaults.baseURL = `http://${config.API_BASE_URL}:8080`;

function App() {
  const [serverAvailable, setServerAvailable] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const { isAuthenticated } = useAuth();

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

  if (!initialCheckDone) {
    return <div>Загрузка...</div>;
  }

  if (!serverAvailable) {
    return <MaintenancePage />;
  }

  return (
    <Router>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/auth" replace />} />
          <Route path="/new-report" element={isAuthenticated ? <NewReport /> : <Navigate to="/auth" replace />} />
          <Route path="/reports" element={isAuthenticated ? <Reports /> : <Navigate to="/auth" replace />} />
          <Route path="/files" element={isAuthenticated ? <Files /> : <Navigate to="/auth" replace />} />
          <Route path="/profile" element={isAuthenticated ? <Profile /> : <Navigate to="/auth" replace />} />
          <Route path="/requests" element={isAuthenticated ? <Requests /> : <Navigate to="/auth" replace />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </div>
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

