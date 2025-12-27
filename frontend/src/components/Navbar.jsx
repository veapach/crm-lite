import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaBars, FaTimes, FaSun, FaMoon, FaHome, FaCalendarAlt, FaFileAlt, FaClipboardList, FaTicketAlt, FaChartBar, FaFolder, FaBoxes, FaRoute, FaUser, FaCog } from 'react-icons/fa';
import '../styles/Navbar.css';
import { useAuth } from '../context/AuthContext';
import { useNewTickets } from '../context/NewTicketsContext';
import { useTheme } from '../context/ThemeContext';

function Navbar() {
  const { isAuthenticated, user } = useAuth();
  const { hasNewTickets } = useNewTickets() || { hasNewTickets: false };
  const { theme, toggleTheme, isDark } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const isAdmin = user && user.department === 'Админ';
  const isViewOnly = user?.phone === 'viewonlyuser';

  // Закрытие меню при изменении маршрута
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Блокировка скролла при открытом меню
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const NavLinks = ({ mobile = false }) => {
    if (!isAuthenticated) {
      return (
        <li className="nav-item">
          <Link
            className={`nav-link ${location.pathname === '/auth' ? 'active' : ''}`}
            to="/auth"
            onClick={mobile ? toggleMenu : undefined}
          >
            {mobile && <FaUser className="nav-icon" />}
            <span>Вход</span>
          </Link>
        </li>
      );
    }

    if (isViewOnly) {
      return (
        <>
          <li className="nav-item">
            <Link
              className={`nav-link ${location.pathname === '/reports' ? 'active' : ''}`}
              to="/reports"
              onClick={mobile ? toggleMenu : undefined}
            >
              {mobile && <FaClipboardList className="nav-icon" />}
              <span>Отчеты</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link
              className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
              to="/profile"
              onClick={mobile ? toggleMenu : undefined}
            >
              {mobile && <FaUser className="nav-icon" />}
              <span>Профиль</span>
            </Link>
          </li>
        </>
      );
    }

    return (
      <>
        {!mobile && (
          <li className="nav-item">
            <Link
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
              to="/"
            >
              <span>Главная</span>
            </Link>
          </li>
        )}
        {mobile && (
          <li className="nav-item">
            <Link
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
              to="/"
              onClick={toggleMenu}
            >
              <FaHome className="nav-icon" />
              <span>Главная</span>
            </Link>
          </li>
        )}
        <li className="nav-item">
          <Link
            className={`nav-link ${location.pathname === '/schedule' ? 'active' : ''}`}
            to="/schedule"
            onClick={mobile ? toggleMenu : undefined}
          >
            {mobile && <FaCalendarAlt className="nav-icon" />}
            <span>График</span>
          </Link>
        </li>
        <li className="nav-item">
          <Link
            className={`nav-link ${location.pathname === '/new-report' ? 'active' : ''}`}
            to="/new-report"
            onClick={mobile ? toggleMenu : undefined}
          >
            {mobile && <FaFileAlt className="nav-icon" />}
            <span>Новый отчет</span>
          </Link>
        </li>
        <li className="nav-item">
          <Link
            className={`nav-link ${location.pathname === '/reports' ? 'active' : ''}`}
            to="/reports"
            onClick={mobile ? toggleMenu : undefined}
          >
            {mobile && <FaClipboardList className="nav-icon" />}
            <span>Отчеты</span>
          </Link>
        </li>
        <li className="nav-item">
          <Link
            className={`nav-link ${location.pathname === '/inner-tickets' ? 'active' : ''}`}
            to="/inner-tickets"
            onClick={mobile ? toggleMenu : undefined}
          >
            {mobile && <FaTicketAlt className="nav-icon" />}
            <span>Заявки</span>
            {hasNewTickets && <span className="vv-badge-pulse" />}
          </Link>
        </li>
        <li className="nav-item">
          <Link
            className={`nav-link ${location.pathname === '/statistics' ? 'active' : ''}`}
            to="/statistics"
            onClick={mobile ? toggleMenu : undefined}
          >
            {mobile && <FaChartBar className="nav-icon" />}
            <span>Статистика</span>
          </Link>
        </li>
        <li className="nav-item">
          <Link
            className={`nav-link ${location.pathname === '/files' ? 'active' : ''}`}
            to="/files"
            onClick={mobile ? toggleMenu : undefined}
          >
            {mobile && <FaFolder className="nav-icon" />}
            <span>Файлы</span>
          </Link>
        </li>
        <li className="nav-item">
          <Link
            className={`nav-link ${location.pathname === '/inventory' ? 'active' : ''}`}
            to="/inventory"
            onClick={mobile ? toggleMenu : undefined}
          >
            {mobile && <FaBoxes className="nav-icon" />}
            <span>ЗИП</span>
          </Link>
        </li>
        <li className="nav-item">
          <Link
            className={`nav-link ${location.pathname === '/travel-sheet' ? 'active' : ''}`}
            to="/travel-sheet"
            onClick={mobile ? toggleMenu : undefined}
          >
            {mobile && <FaRoute className="nav-icon" />}
            <span>Путевой лист</span>
          </Link>
        </li>
        <li className="nav-item">
          <Link
            className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
            to="/profile"
            onClick={mobile ? toggleMenu : undefined}
          >
            {mobile && <FaUser className="nav-icon" />}
            <span>Профиль</span>
          </Link>
        </li>
        {isAdmin && (
          <li className="nav-item">
            <Link
              className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}
              to="/admin"
              onClick={mobile ? toggleMenu : undefined}
            >
              {mobile && <FaCog className="nav-icon" />}
              <span>Админ</span>
            </Link>
          </li>
        )}
      </>
    );
  };

  // Кнопка переключения темы
  const ThemeToggle = ({ className = '' }) => (
    <button
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={isDark ? 'Включить светлую тему' : 'Включить темную тему'}
    >
      <div className="theme-toggle-track">
        <FaSun className="theme-icon sun" />
        <FaMoon className="theme-icon moon" />
        <div className={`theme-toggle-thumb ${isDark ? 'dark' : ''}`} />
      </div>
    </button>
  );

  return (
    <>
      {/* Десктопный Navbar */}
      <nav className="navbar-desktop">
        <div className="navbar-container">
          <Link className="navbar-brand" to="/">
            <span className="brand-text">CRM</span>
          </Link>

          <ul className="navbar-nav-desktop">
            <NavLinks />
          </ul>

          <div className="navbar-actions">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Мобильный Navbar */}
      <div className="navbar-mobile">
        {/* Оверлей */}
        <div
          className={`sidebar-overlay ${isMenuOpen ? 'active' : ''}`}
          onClick={() => setIsMenuOpen(false)}
        />

        {/* Боковое меню */}
        <aside
          className={`sidebar ${isMenuOpen ? 'open' : ''}`}
          ref={menuRef}
        >
          <div className="sidebar-header">
            <Link className="sidebar-brand" to="/" onClick={toggleMenu}>
              <span className="brand-text">CRM</span>
            </Link>
            <button
              className="sidebar-close"
              onClick={toggleMenu}
              aria-label="Закрыть меню"
            >
              <FaTimes />
            </button>
          </div>

          <nav className="sidebar-nav">
            <ul className="sidebar-menu">
              <NavLinks mobile />
            </ul>
          </nav>

          <div className="sidebar-footer">
            <div className="theme-switch-container">
              <span className="theme-label">
                {isDark ? 'Темная тема' : 'Светлая тема'}
              </span>
              <ThemeToggle />
            </div>
            {user && (
              <div className="user-info">
                <FaUser className="user-avatar" />
                <span className="user-name">{user.name || user.phone}</span>
              </div>
            )}
          </div>
        </aside>

        {/* Кнопка меню */}
        <button
          className={`menu-fab ${isMenuOpen ? 'hidden' : ''}`}
          onClick={toggleMenu}
          ref={buttonRef}
          aria-label="Открыть меню"
        >
          <FaBars />
        </button>
      </div>
    </>
  );
}

export default Navbar;
