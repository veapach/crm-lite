import React from 'react';
import {BrowserRouter as Router, Navigate, Route, Routes} from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import NewReport from './pages/NewReport';
import Reports from './pages/Reports';
import Files from './pages/Files';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import Requests from './pages/Requests';
import ProtectedRoute from "./components/ProtectedRoute";
import axios from "axios";
import config from "./config";
import { AuthProvider } from './context/AuthContext';

axios.defaults.withCredentials = true;
axios.defaults.baseURL = `http://${config.API_BASE_URL}:8080`;

// Добавляем перехватчик запросов для добавления токена
axios.interceptors.request.use((config) => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='));
    if (token) {
        config.headers.Authorization = `Bearer ${token.split('=')[1]}`;
    }
    return config;
});

// Перехватчик ответов
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const currentPath = window.location.pathname;
            if (currentPath !== '/auth') {
                localStorage.setItem('authError', 'Время сессии истекло, авторизуйтесь снова!');
                window.location.href = `/auth?redirect=${encodeURIComponent(currentPath)}`;
            }
        }
        return Promise.reject(error);
    }
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <div className="container">
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/new-report" element={<ProtectedRoute><NewReport /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/files" element={<ProtectedRoute><Files /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
