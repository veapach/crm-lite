import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        axios.get("/api/check-auth")
            .then(() => setIsAuthenticated(true))
            .catch(() => setIsAuthenticated(false));
    }, []);

    const login = () => setIsAuthenticated(true);
    const logout = () => {
        axios.post("/api/logout").then(() => setIsAuthenticated(false));
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};

