import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const location = useLocation();
    const isAuthenticated = !!localStorage.getItem('token'); // Проверка авторизации

    // Если пользователь не авторизован, перенаправляем на страницу авторизации
    if (!isAuthenticated) {
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    // Если авторизован, рендерим children
    return children;
};

export default ProtectedRoute;