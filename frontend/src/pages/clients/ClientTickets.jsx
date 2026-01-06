import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useClientAuth } from '../../context/ClientAuthContext';
import styles from './ClientTickets.module.css';

const LOGO_SRC = '/assets/Логотип ВВ/ВкусВилл зеленый/Лого-ВкусВилл-зеленый.png';

// Статусы и их стили
const STATUS_CONFIG = {
  'Не назначено': { color: '#ef4444', bg: '#fef2f2', icon: '⏳' },
  'В работе': { color: '#f59e0b', bg: '#fffbeb', icon: '🔧' },
  'Завершено': { color: '#22c55e', bg: '#f0fdf4', icon: '✓' }
};

export default function ClientTickets() {
  const { client, isAuthenticated, loading: authLoading, logout } = useClientAuth();
  const navigate = useNavigate();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [fileUrls, setFileUrls] = useState({});

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/client/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTickets();
    }
  }, [isAuthenticated]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/client/my-tickets');
      setTickets(response.data.tickets || []);
    } catch (err) {
      setError('Ошибка загрузки заявок');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (ticket) => {
    setSelectedTicket(ticket);
    setShowDetails(true);

    // Загрузка файлов
    if (ticket.files) {
      const files = ticket.files.split(',');
      const urls = {};
      for (const file of files) {
        try {
          const response = await axios.get(`/api/tickets/files/${file}`, {
            responseType: 'blob'
          });
          const blob = new Blob([response.data], { type: response.headers['content-type'] });
          urls[file] = URL.createObjectURL(blob);
        } catch (err) {
          console.error('Ошибка загрузки файла:', file, err);
        }
      }
      setFileUrls(urls);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/tickets');
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filter === 'active') return ticket.status !== 'Завершено';
    if (filter === 'completed') return ticket.status === 'Завершено';
    return true;
  });

  const getStatusStyle = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG['Не назначено'];
    return {
      color: config.color,
      backgroundColor: config.bg
    };
  };

  if (authLoading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner}></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper} data-theme="light">
      {/* Анимированный градиентный фон */}
      <div className={styles.animatedBg}>
        <div className={styles.gradientOrb1}></div>
        <div className={styles.gradientOrb2}></div>
        <div className={styles.gradientOrb3}></div>
      </div>

      {/* Хедер */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <img src={LOGO_SRC} alt="ВкусВилл" className={styles.logo} />
            <div className={styles.headerTitle}>
              <h1>Личный кабинет</h1>
              <p>Управление заявками</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{client?.fullName}</span>
              <span className={styles.userEmail}>{client?.email}</span>
            </div>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className={styles.mainContent}>
        {/* Карточки статистики */}
        <div className={styles.statsCards}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📋</div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{tickets.length}</span>
              <span className={styles.statLabel}>Всего заявок</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>⏳</div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>
                {tickets.filter(t => t.status === 'Не назначено').length}
              </span>
              <span className={styles.statLabel}>Ожидают</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🔧</div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>
                {tickets.filter(t => t.status === 'В работе').length}
              </span>
              <span className={styles.statLabel}>В работе</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>✓</div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>
                {tickets.filter(t => t.status === 'Завершено').length}
              </span>
              <span className={styles.statLabel}>Завершено</span>
            </div>
          </div>
        </div>

        {/* Панель действий */}
        <div className={styles.actionsPanel}>
          <div className={styles.filterTabs}>
            <button 
              className={`${styles.filterTab} ${filter === 'all' ? styles.active : ''}`}
              onClick={() => setFilter('all')}
            >
              Все заявки
            </button>
            <button 
              className={`${styles.filterTab} ${filter === 'active' ? styles.active : ''}`}
              onClick={() => setFilter('active')}
            >
              Активные
            </button>
            <button 
              className={`${styles.filterTab} ${filter === 'completed' ? styles.active : ''}`}
              onClick={() => setFilter('completed')}
            >
              Завершённые
            </button>
          </div>
          <button onClick={() => navigate('/tickets')} className={styles.newTicketBtn}>
            + Новая заявка
          </button>
        </div>

        {/* Список заявок */}
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Загрузка заявок...</p>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <p>{error}</p>
            <button onClick={fetchTickets} className={styles.retryBtn}>
              Попробовать снова
            </button>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <h3>Заявок пока нет</h3>
            <p>Создайте первую заявку, чтобы она появилась здесь</p>
            <button onClick={() => navigate('/tickets')} className={styles.createBtn}>
              Создать заявку
            </button>
          </div>
        ) : (
          <div className={styles.ticketsList}>
            {filteredTickets.map(ticket => (
              <div key={ticket.id} className={styles.ticketCard}>
                <div className={styles.ticketHeader}>
                  <div className={styles.ticketId}>#{ticket.id}</div>
                  <div 
                    className={styles.ticketStatus}
                    style={getStatusStyle(ticket.status)}
                  >
                    {STATUS_CONFIG[ticket.status]?.icon} {ticket.status}
                  </div>
                </div>
                
                <div className={styles.ticketBody}>
                  <h3 className={styles.ticketAddress}>{ticket.address}</h3>
                  <p className={styles.ticketDescription}>
                    {ticket.description.length > 150 
                      ? ticket.description.substring(0, 150) + '...' 
                      : ticket.description}
                  </p>
                </div>

                <div className={styles.ticketMeta}>
                  <div className={styles.ticketDate}>
                    <span className={styles.metaIcon}>📅</span>
                    {ticket.date}
                  </div>
                  {ticket.engineerName && (
                    <div className={styles.ticketEngineer}>
                      <span className={styles.metaIcon}>👷</span>
                      {ticket.engineerName}
                    </div>
                  )}
                </div>

                {/* Привязанные отчёты */}
                {ticket.reports && ticket.reports.length > 0 && (
                  <div className={styles.ticketReports}>
                    <span className={styles.reportsLabel}>
                      📄 Отчёты ({ticket.reports.length}):
                    </span>
                    <div className={styles.reportsList}>
                      {ticket.reports.map(report => (
                        <a 
                          key={report.id}
                          href={`/uploads/reports/${report.filename}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.reportLink}
                        >
                          {report.date} - {report.classification}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.ticketActions}>
                  <button 
                    onClick={() => handleViewDetails(ticket)}
                    className={styles.detailsBtn}
                  >
                    Подробнее
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Модальное окно деталей */}
      {showDetails && selectedTicket && (
        <div className={styles.modalOverlay} onClick={() => setShowDetails(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Заявка #{selectedTicket.id}</h2>
              <button 
                onClick={() => setShowDetails(false)} 
                className={styles.modalClose}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Статус:</span>
                <span 
                  className={styles.detailValue}
                  style={getStatusStyle(selectedTicket.status)}
                >
                  {STATUS_CONFIG[selectedTicket.status]?.icon} {selectedTicket.status}
                </span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Дата:</span>
                <span className={styles.detailValue}>{selectedTicket.date}</span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Адрес:</span>
                <span className={styles.detailValue}>{selectedTicket.address}</span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Описание:</span>
                <span className={styles.detailValue}>{selectedTicket.description}</span>
              </div>

              {selectedTicket.engineerName && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Инженер:</span>
                  <span className={styles.detailValue}>{selectedTicket.engineerName}</span>
                </div>
              )}

              {selectedTicket.completedAt && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Завершено:</span>
                  <span className={styles.detailValue}>{selectedTicket.completedAt}</span>
                </div>
              )}

              {/* Фотографии */}
              {selectedTicket.files && (
                <div className={styles.detailSection}>
                  <h4>Прикреплённые фото:</h4>
                  <div className={styles.photosGrid}>
                    {selectedTicket.files.split(',').map((file, idx) => (
                      <div key={idx} className={styles.photoItem}>
                        {fileUrls[file] ? (
                          <img src={fileUrls[file]} alt={`Фото ${idx + 1}`} />
                        ) : (
                          <div className={styles.photoLoading}>Загрузка...</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Отчёты */}
              {selectedTicket.reports && selectedTicket.reports.length > 0 && (
                <div className={styles.detailSection}>
                  <h4>Отчёты по заявке:</h4>
                  <div className={styles.reportCards}>
                    {selectedTicket.reports.map(report => (
                      <a 
                        key={report.id}
                        href={`/uploads/reports/${report.filename}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.reportCard}
                      >
                        <div className={styles.reportIcon}>📄</div>
                        <div className={styles.reportInfo}>
                          <span className={styles.reportDate}>{report.date}</span>
                          <span className={styles.reportClass}>{report.classification}</span>
                        </div>
                        <span className={styles.downloadIcon}>⬇</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
