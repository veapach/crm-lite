import React, {useEffect, useState} from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const ProtectedRoute = ({ children }) => {
    const location = useLocation();
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                await axios.get("/api/check-auth");
                setIsAuthenticated(true);
                setError(null);
            } catch (err) {
                setIsAuthenticated(false);
                if (err.response?.status === 401) {
                    setError("Время сессии истекло, авторизуйтесь снова!");
                }
            }
        };

        checkAuth();
    }, []);

    if (isAuthenticated === null) {
        return null; // Показываем загрузку
    }

    if (!isAuthenticated) {
        // Сохраняем сообщение об ошибке в localStorage, чтобы показать его на странице авторизации
        if (error) {
            localStorage.setItem('authError', error);
        }
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;