import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const ClientAuthContext = createContext(null);

export const ClientAuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        setLoading(true);
        try {
            const response = await axios.get("/api/client/check-auth");
            setIsAuthenticated(true);
            setClient(response.data.client);
        } catch (error) {
            setIsAuthenticated(false);
            setClient(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const response = await axios.post("/api/client/login", { email, password });
            setIsAuthenticated(true);
            setClient(response.data.client);
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error || "Ошибка авторизации" 
            };
        }
    };

    const register = async (data) => {
        try {
            const response = await axios.post("/api/client/register", data);
            setIsAuthenticated(true);
            setClient(response.data.client);
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error || "Ошибка регистрации" 
            };
        }
    };

    const logout = async () => {
        try {
            await axios.post("/api/client/logout");
        } catch (error) {
            console.error("Ошибка при выходе:", error);
        } finally {
            setIsAuthenticated(false);
            setClient(null);
        }
    };

    const updateProfile = async (data) => {
        try {
            await axios.put("/api/client/profile", data);
            setClient(prev => ({ ...prev, ...data }));
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error || "Ошибка обновления профиля" 
            };
        }
    };

    return (
        <ClientAuthContext.Provider value={{ 
            isAuthenticated, 
            client, 
            loading,
            login, 
            register,
            logout, 
            checkAuth,
            updateProfile
        }}>
            {children}
        </ClientAuthContext.Provider>
    );
};

export const useClientAuth = () => {
    return useContext(ClientAuthContext);
};
