import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Navbar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
                  <li className="nav-item">
                    <Link className="nav-link" style={{ color: '#e3e3e3' }} to="/new-report">
                      Новый отчет
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" style={{ color: '#e3e3e3' }} to="/reports">
                      Отчеты
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" style={{ color: '#e3e3e3' }} to="/certificates">
                      Сертификаты
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" style={{ color: '#e3e3e3' }} to="/profile">
                      Профиль
                    </Link>
                  </li>
                </>
              )}
              {!isAuthenticated && (
                <li className="nav-item">
                  <Link className="nav-link" style={{ color: '#e3e3e3' }} to="/auth">
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
