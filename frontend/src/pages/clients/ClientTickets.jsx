import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import { useClientAuth } from '../../context/ClientAuthContext';
import { useTheme } from '../../context/ThemeContext';
import styles from './ClientTickets.module.css';

// Устанавливаем worker для PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const LOGO_SRC = '/assets/Логотип ВВ/ВкусВилл зеленый/Лого-ВкусВилл-зеленый.png';

// Статусы и их стили
const STATUS_CONFIG = {
  'Не назначено': { color: '#ef4444', bg: '#fef2f2', icon: '⏳' },
  'В работе': { color: '#f59e0b', bg: '#fffbeb', icon: '🔧' },
  'Завершено': { color: '#22c55e', bg: '#f0fdf4', icon: '✅' }
};

export default function ClientTickets() {
  const { client, isAuthenticated, loading: authLoading, logout } = useClientAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [fileUrls, setFileUrls] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    address: '',
    description: '',
    files: []
  });
  const [addresses, setAddresses] = useState([]);
  const [filteredAddresses, setFilteredAddresses] = useState([]);
  const [showAddressList, setShowAddressList] = useState(false);
  const [createSending, setCreateSending] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createError, setCreateError] = useState('');
  
  // Состояние для предпросмотра PDF
  const [previewPdf, setPreviewPdf] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const viewerRef = useRef(null);
  
  // Состояние для меню настроек
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
    phone: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/client/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Закрытие меню настроек при клике вне его
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showSettingsMenu && !e.target.closest(`.${styles.settingsWrapper}`)) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSettingsMenu]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTickets();
      // Загружаем адреса для автокомплита
      axios.get('/api/addresses').then(res => setAddresses(res.data || []));
      
      // Polling для live-обновления заявок каждые 10 секунд
      const pollInterval = setInterval(() => {
        axios.get('/api/client/my-tickets')
          .then(res => {
            setTickets(res.data.tickets || []);
          })
          .catch(err => console.error('Polling error:', err));
      }, 10000);
      
      return () => clearInterval(pollInterval);
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

  // Обработчик предпросмотра PDF
  const handlePreviewPdf = async (url) => {
    setPreviewPdf(url);
    setPdfLoading(true);
    
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        withCredentials: true,
      });
      const arrayBuffer = response.data;
      
      // Ждём пока ref будет доступен
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const container = viewerRef.current;
      if (!container) {
        setPdfLoading(false);
        return;
      }
      container.innerHTML = '';
      
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const isMobile = window.innerWidth <= 768;
      const baseScale = isMobile ? 1.2 : 1.5;
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        let currentScale = baseScale;
        
        if (isMobile) {
          const containerWidth = container.clientWidth - 12;
          const defaultViewport = page.getViewport({ scale: baseScale });
          const ratio = containerWidth / defaultViewport.width;
          currentScale = baseScale * ratio;
        }
        
        const viewport = page.getViewport({ scale: currentScale });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;
        container.appendChild(canvas);
        
        if (pageNum < pdf.numPages) {
          const spacer = document.createElement('div');
          spacer.style.height = '20px';
          container.appendChild(spacer);
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки PDF:', err);
      if (viewerRef.current) {
        viewerRef.current.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Ошибка загрузки документа</p>';
      }
    } finally {
      setPdfLoading(false);
    }
  };

  // Закрытие PDF
  const closePdfPreview = () => {
    setPreviewPdf(null);
    if (viewerRef.current) {
      viewerRef.current.innerHTML = '';
    }
  };

  // Открытие модального окна редактирования профиля
  const openEditProfile = () => {
    setProfileForm({
      fullName: client?.fullName || '',
      email: client?.email || '',
      phone: client?.phone || ''
    });
    setShowSettingsMenu(false);
    setShowEditProfile(true);
    setProfileError('');
    setProfileSuccess(false);
  };

  // Сохранение профиля
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess(false);
    
    try {
      await axios.put('/api/client/profile', {
        fullName: profileForm.fullName,
        email: profileForm.email
      });
      setProfileSuccess(true);
      // Обновляем данные клиента через перезагрузку страницы через 1 секунду
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setProfileError(err.response?.data?.error || 'Ошибка сохранения профиля');
    } finally {
      setProfileSaving(false);
    }
  };

  // Обработчики формы создания заявки
  const handleCreateFormChange = (e) => {
    const { name, value } = e.target;
    setCreateForm(f => ({ ...f, [name]: value }));
    if (name === 'address') {
      if (!value.trim()) {
        setFilteredAddresses([]);
        setShowAddressList(false);
      } else {
        const filtered = addresses.filter(a => (a.address || '').toLowerCase().includes(value.toLowerCase())).map(a => a.address);
        setFilteredAddresses(filtered);
        setShowAddressList(filtered.length > 0);
      }
    }
  };

  const handleAddressSelect = (address) => {
    setCreateForm(f => ({ ...f, address }));
    setShowAddressList(false);
  };

  const handleCreateFileChange = (e) => {
    let files = Array.from(e.target.files).filter(f => f.type.startsWith('image'));
    if (createForm.files.length + files.length > 5) {
      files = files.slice(0, 5 - createForm.files.length);
    }
    setCreateForm(f => ({ ...f, files: [...f.files, ...files] }));
    e.target.value = '';
  };

  const handleRemoveCreateFile = (idx) => {
    setCreateForm(f => ({ ...f, files: f.files.filter((_, i) => i !== idx) }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSending(true);
    try {
      const data = new FormData();
      data.append('fullName', client?.fullName || '');
      data.append('position', client?.position || '');
      data.append('contact', client?.phone || client?.email || '');
      data.append('address', createForm.address);
      data.append('description', createForm.description);
      createForm.files.forEach(f => data.append('files', f));
      await axios.post('/api/client-tickets', data);
      setCreateSuccess(true);
      setCreateForm({ address: '', description: '', files: [] });
      fetchTickets(); // Обновляем список заявок
    } catch (e) {
      setCreateError('Ошибка при отправке. Попробуйте ещё раз.');
    } finally {
      setCreateSending(false);
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreateSuccess(false);
    setCreateError('');
    setCreateForm({ address: '', description: '', files: [] });
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
    <div className={`${styles.pageWrapper} ${isDark ? styles.dark : ''}`} data-theme={theme}>
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
            {/* Кнопка переключения темы */}
            <button 
              onClick={toggleTheme} 
              className={styles.themeToggle}
              title={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{client?.fullName}</span>
              <span className={styles.userEmail}>{client?.email || client?.phone}</span>
            </div>
            {/* Кнопка настроек */}
            <div className={styles.settingsWrapper}>
              <button 
                onClick={() => setShowSettingsMenu(!showSettingsMenu)} 
                className={styles.settingsBtn}
                title="Настройки"
              >
                ⚙️
              </button>
              {showSettingsMenu && (
                <div className={styles.settingsMenu}>
                  <button onClick={openEditProfile} className={styles.settingsMenuItem}>
                    ✏️ Редактировать профиль
                  </button>
                  <button onClick={handleLogout} className={styles.settingsMenuItem}>
                    🚪 Выйти
                  </button>
                </div>
              )}
            </div>
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
            <div className={styles.statIcon}>✅</div>
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
          <button onClick={() => setShowCreateModal(true)} className={styles.newTicketBtn}>
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
            <button onClick={() => setShowCreateModal(true)} className={styles.createBtn}>
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
                        <button 
                          key={report.id}
                          onClick={() => handlePreviewPdf(`/api/reports/preview/${encodeURIComponent(report.filename)}`)}
                          className={styles.reportLink}
                          type="button"
                        >
                          {report.date} - {report.classification}
                        </button>
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
                  className={`${styles.detailStatusBadge} ${styles['status' + selectedTicket.status.replace(/\s+/g, '')]}`}
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
                      <button 
                        key={report.id}
                        onClick={() => setPreviewPdf(`/api/uploads/reports/${report.filename}`)}
                        className={styles.reportCard}
                        type="button"
                      >
                        <div className={styles.reportIcon}>📄</div>
                        <div className={styles.reportInfo}>
                          <span className={styles.reportDate}>{report.date}</span>
                          <span className={styles.reportClass}>{report.classification}</span>
                        </div>
                        <span className={styles.downloadIcon}>👁</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания заявки */}
      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={handleCloseCreateModal}>
          <div className={styles.createModalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Новая заявка</h2>
              <button onClick={handleCloseCreateModal} className={styles.modalClose}>×</button>
            </div>
            
            {createSuccess ? (
              <div className={styles.createSuccess}>
                <div className={styles.successIcon}>✅</div>
                <h3>Заявка отправлена!</h3>
                <p>Спасибо, мы свяжемся с вами.</p>
                <button onClick={handleCloseCreateModal} className={styles.successOkBtn}>
                  OK
                </button>
              </div>
            ) : (
              <form className={styles.createForm} onSubmit={handleCreateSubmit}>
                <div className={styles.createFormGroup}>
                  <label>Номер объекта (адрес) *</label>
                  <div className={styles.createInputWrapper}>
                    <input
                      type="text"
                      name="address"
                      value={createForm.address}
                      onChange={handleCreateFormChange}
                      placeholder="Введите адрес"
                      required
                      autoComplete="off"
                    />
                    {showAddressList && filteredAddresses.length > 0 && (
                      <div className={styles.addressDropdown}>
                        {filteredAddresses.map((a, i) => (
                          <div 
                            key={i} 
                            className={styles.addressItem}
                            onClick={() => handleAddressSelect(a)}
                          >
                            {a}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.createFormGroup}>
                  <label>Описание проблемы *</label>
                  <textarea
                    name="description"
                    value={createForm.description}
                    onChange={handleCreateFormChange}
                    placeholder="Опишите проблему"
                    required
                    rows={4}
                  />
                </div>

                <div className={styles.createFormGroup}>
                  <label>Фото (до 5 файлов)</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={handleCreateFileChange}
                    style={{ display: 'none' }}
                    id="create-file-upload"
                  />
                  <label htmlFor="create-file-upload" className={styles.uploadBtn}>
                    📷 Загрузить фото
                  </label>
                  {createForm.files.length > 0 && (
                    <div className={styles.filePreviewList}>
                      {createForm.files.map((file, idx) => (
                        <div key={idx} className={styles.filePreviewItem}>
                          <img src={URL.createObjectURL(file)} alt="preview" />
                          <button 
                            type="button" 
                            onClick={() => handleRemoveCreateFile(idx)}
                            className={styles.removeFileBtn}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {createError && (
                  <div className={styles.createError}>{createError}</div>
                )}

                <button 
                  type="submit" 
                  className={styles.createSubmitBtn}
                  disabled={createSending}
                >
                  {createSending ? 'Отправка...' : 'Отправить заявку'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно предпросмотра PDF */}
      {previewPdf && (
        <div className={styles.pdfOverlay} onClick={closePdfPreview}>
          <div className={styles.pdfModal} onClick={e => e.stopPropagation()}>
            <div className={styles.pdfHeader}>
              <h3>Просмотр отчёта</h3>
              <div className={styles.pdfActions}>
                <button 
                  onClick={closePdfPreview} 
                  className={styles.pdfCloseBtn}
                >
                  ×
                </button>
              </div>
            </div>
            <div className={styles.pdfContent}>
              {pdfLoading && (
                <div className={styles.pdfLoading}>
                  <div className={styles.spinner}></div>
                  <p>Загрузка документа...</p>
                </div>
              )}
              <div ref={viewerRef} className={styles.pdfViewer}></div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования профиля */}
      {showEditProfile && (
        <div className={styles.modalOverlay} onClick={() => setShowEditProfile(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Редактирование профиля</h2>
              <button 
                onClick={() => setShowEditProfile(false)} 
                className={styles.modalClose}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <form onSubmit={handleSaveProfile} className={styles.profileForm}>
                <div className={styles.formGroup}>
                  <label>ФИО</label>
                  <input
                    type="text"
                    value={profileForm.fullName}
                    onChange={e => setProfileForm({...profileForm, fullName: e.target.value})}
                    placeholder="Иванов Иван Иванович"
                    required
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                    placeholder="email@example.com"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Телефон</label>
                  <input
                    type="text"
                    value={profileForm.phone}
                    disabled
                    className={styles.disabledInput}
                  />
                  <small className={styles.fieldHint}>Телефон изменить нельзя</small>
                </div>

                {profileError && (
                  <div className={styles.createError}>{profileError}</div>
                )}
                
                {profileSuccess && (
                  <div className={styles.createSuccess}>✅ Профиль сохранён!</div>
                )}

                <div className={styles.profileActions}>
                  <button 
                    type="button" 
                    onClick={() => setShowEditProfile(false)}
                    className={styles.cancelBtn}
                  >
                    Отмена
                  </button>
                  <button 
                    type="submit" 
                    className={styles.createSubmitBtn}
                    disabled={profileSaving}
                  >
                    {profileSaving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
