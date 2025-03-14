import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        setLoading(true);
        try {
            const response = await axios.get("/api/check-auth");
            setIsAuthenticated(true);
            setUser(response.data.user);
        } catch (error) {
            setIsAuthenticated(false);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = () => {
        checkAuth();
    };

    const logout = async () => {
        try {
            await axios.post("/api/logout");
            // Очищаем состояние
            setIsAuthenticated(false);
            setUser(null);
            // Очищаем localStorage если он используется
            localStorage.removeItem('token');
            // Перенаправляем на страницу авторизации
            window.location.href = '/auth';
        } catch (error) {
            console.error("Ошибка при выходе:", error);
            // Даже в случае ошибки, очищаем состояние и перенаправляем
            setIsAuthenticated(false);
            setUser(null);
            localStorage.removeItem('token');
            window.location.href = '/auth';
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout, user, checkAuth, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};

