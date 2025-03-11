import React, { useState, useEffect } from 'react';
import {BrowserRouter as Router, Navigate, Route, Routes} from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import NewReport from './pages/NewReport';
import Reports from './pages/Reports';
import Files from './pages/Files';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import Requests from './pages/Requests';
import MaintenancePage from './pages/MaintenancePage';
import ProtectedRoute from "./components/ProtectedRoute";
import axios from "axios";
import config from "./config";
import { AuthProvider } from './context/AuthContext';
import './App.css';

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
  const [serverAvailable, setServerAvailable] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    // Функция для проверки доступности сервера
    const checkServerAvailability = async () => {
      try {
        // Используем эндпоинт, который должен быстро отвечать
        await axios.get('/api/check-health', { timeout: 5000 });
        setServerAvailable(true);
      } catch (error) {
        console.error('Сервер недоступен:', error);
        setServerAvailable(false);
      } finally {
        if (!initialCheckDone) {
          setInitialCheckDone(true);
        }
      }
    };

    // Проверяем доступность сервера при загрузке
    checkServerAvailability();

    // Удаляем интервал для периодической проверки
    // const intervalId = setInterval(checkServerAvailability, 30000);

    // Очищаем интервал при размонтировании компонента
    // return () => clearInterval(intervalId);
  }, [initialCheckDone]);

  // Показываем загрузку только при первоначальной проверке
  if (!initialCheckDone) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Загрузка...</span>
        </div>
      </div>
    );
  }

  // Если сервер недоступен, показываем страницу обслуживания
  if (!serverAvailable) {
    return <MaintenancePage />;
  }

  // Если сервер доступен, показываем обычное приложение
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
