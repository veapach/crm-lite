import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';
import '../styles/Navbar.css';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { isAuthenticated } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false); // Состояние для анимации закрытия
  const location = useLocation();
  const menuRef = useRef(null); // Ref для меню
  const buttonRef = useRef(null); // Ref для кнопки меню

  // Закрытие меню при клике за его пределами
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Если клик произошел вне меню и не по кнопке меню
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        closeMenu(); // Закрываем меню с анимацией
      }
    };

    // Добавляем обработчик события
    document.addEventListener('mousedown', handleClickOutside);

    // Убираем обработчик при размонтировании
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Функция для закрытия меню с анимацией
  const closeMenu = () => {
    setIsClosing(true); // Запускаем анимацию закрытия
    setTimeout(() => {
      setIsMenuOpen(false); // Закрываем меню после завершения анимации
      setIsClosing(false); // Сбрасываем состояние анимации
    }, 300); // Время анимации (должно совпадать с CSS)
  };

  // Обработчик для кнопки меню
  const handleMenuButtonClick = () => {
    if (isMenuOpen) {
      closeMenu(); // Закрываем меню с анимацией
    } else {
      setIsMenuOpen(true); // Открываем меню
    }
  };

  return (
    <div>
      {/* Классический Navbar для ПК */}
      <nav className="navbar navbar-expand-lg d-none d-md-block" style={{ backgroundColor: '#333', color: '#e3e3e3' }}>
        <div className="container">
          <Link className="navbar-brand" style={{ fontFamily: 'Villula', color: '#e3e3e3' }} to="/">
            CRM
          </Link>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ml-auto">
              {isAuthenticated ? (
                <>
                  {/* <li className="nav-item mx-1">
                    <Link className={`nav-link rounded-pill ${location.pathname === '/requests' ? 'active' : ''}`} to="/requests">Заявки</Link>
                  </li> */}
                  <li className="nav-item mx-1">
                    <Link className={`nav-link rounded-pill ${location.pathname === '/new-report' ? 'active' : ''}`} to="/new-report">Новый отчет</Link>
                  </li>
                  <li className="nav-item mx-1">
                    <Link className={`nav-link rounded-pill ${location.pathname === '/reports' ? 'active' : ''}`} to="/reports">Отчеты</Link>
                  </li>
                  <li className="nav-item mx-1">
                    <Link className={`nav-link rounded-pill ${location.pathname === '/files' ? 'active' : ''}`} to="/files">Файлы</Link>
                  </li>
                  <li className="nav-item mx-1">
                    <Link className={`nav-link rounded-pill ${location.pathname === '/profile' ? 'active' : ''}`} to="/profile">Профиль</Link>
                  </li>
                </>
              ) : (
                <li className="nav-item mx-1">
                  <Link className={`nav-link rounded-pill ${location.pathname === '/auth' ? 'active' : ''}`} to="/auth">Вход/Регистрация</Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </nav>

      {/* Мобильный Navbar */}
      <div className="d-md-none mobile-navbar">
        <button className={`menu-button ${isMenuOpen ? 'open' : ''}`} onClick={handleMenuButtonClick} ref={buttonRef}>
          <FaBars />
        </button>
        <div className={`navbar-menu ${isMenuOpen ? 'open' : ''} ${isClosing ? 'closing' : ''}`} ref={menuRef}>
          <ul className="navbar-nav">
            {isAuthenticated ? (
              <>
                {/* <li><Link to="/requests" onClick={closeMenu}>Заявки</Link></li> */}
                <li><Link to="/new-report" onClick={closeMenu}>Новый отчет</Link></li>
                <li><Link to="/reports" onClick={closeMenu}>Отчеты</Link></li>
                <li><Link to="/files" onClick={closeMenu}>Файлы</Link></li>
                <li><Link to="/profile" onClick={closeMenu}>Профиль</Link></li>
              </>
            ) : (
              <li><Link to="/auth" onClick={closeMenu}>Вход/Регистрация</Link></li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Navbar;