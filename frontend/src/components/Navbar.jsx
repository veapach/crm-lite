import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navbar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      setIsAuthenticated(!!token);
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  return (
    <div>
      <nav className="navbar navbar-expand-lg" style={{ backgroundColor: '#333333', color: '#e3e3e3' }}>
        <div className="container">
          <Link className="navbar-brand" style={{ fontFamily: 'Villula', color: '#e3e3e3' }} to="/">
            CRM
          </Link>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ml-auto">
              {isAuthenticated && (
                <>
                  <li className="nav-item mx-1">
                    <Link 
                      className="nav-link rounded-pill" 
                      style={{ 
                        color: location.pathname === '/new-report' ? '#2e2e2e' : '#e3e3e3',
                        backgroundColor: location.pathname === '/new-report' ? '#e4e7e5' : '#262626',
                        padding: '8px 16px'
                      }} 
                      to="/new-report"
                    >
                      Новый отчет
                    </Link>
                  </li>
                  <li className="nav-item mx-1">
                    <Link 
                      className="nav-link rounded-pill" 
                      style={{ 
                        color: location.pathname === '/reports' ? '#2e2e2e' : '#e3e3e3',
                        backgroundColor: location.pathname === '/reports' ? '#e4e7e5' : '#262626',
                        padding: '8px 16px'
                      }} 
                      to="/reports"
                    >
                      Отчеты
                    </Link>
                  </li>
                  <li className="nav-item mx-1">
                    <Link 
                      className="nav-link rounded-pill" 
                      style={{ 
                        color: location.pathname === '/certificates' ? '#2e2e2e' : '#e3e3e3',
                        backgroundColor: location.pathname === '/certificates' ? '#e4e7e5' : '#262626',
                        padding: '8px 16px'
                      }} 
                      to="/certificates"
                    >
                      Сертификаты
                    </Link>
                  </li>
                  <li className="nav-item mx-1">
                    <Link 
                      className="nav-link rounded-pill" 
                      style={{ 
                        color: location.pathname === '/profile' ? '#2e2e2e' : '#e3e3e3',
                        backgroundColor: location.pathname === '/profile' ? '#e4e7e5' : '#262626',
                        padding: '8px 16px'
                      }} 
                      to="/profile"
                    >
                      Профиль
                    </Link>
                  </li>
                </>
              )}
              {!isAuthenticated && (
                <li className="nav-item mx-1">
                  <Link 
                    className="nav-link rounded-pill" 
                    style={{ 
                      color: location.pathname === '/auth' ? '#2e2e2e' : '#e3e3e3',
                      backgroundColor: location.pathname === '/auth' ? '#e4e7e5' : '#262626',
                      padding: '8px 16px'
                    }} 
                    to="/auth"
                  >
                    Вход/Регистрация
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default Navbar;
