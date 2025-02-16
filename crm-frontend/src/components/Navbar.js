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
      <nav className="navbar navbar-expand-lg navbar-light bg-light">
        <div className="container">
          <Link className="navbar-brand" to="/">
            CRM
          </Link>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ml-auto">
              {isAuthenticated && (
                <>
                  <li className="nav-item">
                    <Link className="nav-link" to="/report">
                      Отчеты
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" to="/certificates">
                      Сертификаты
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" to="/profile">
                      Профиль
                    </Link>
                  </li>
                </>
              )}
              {!isAuthenticated && (
                <li className="nav-item">
                  <Link className="nav-link" to="/auth">
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
