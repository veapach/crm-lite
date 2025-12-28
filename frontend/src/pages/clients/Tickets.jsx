import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import styles from './Tickets.module.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LOGO_SRC = '/assets/Логотип ВВ/ВкусВилл зеленый/Лого-ВкусВилл-зеленый.png';

export default function Tickets() {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  // Если инженер — редирект на Dashboard
  useEffect(() => {
    if (!loading && isAuthenticated && user && user.department !== 'Клиент') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, loading, navigate]);

  // Запретить скролл на странице Tickets
  useEffect(() => {
    document.body.classList.add('tickets-no-scroll');
    return () => {
      document.body.classList.remove('tickets-no-scroll');
    };
  }, []);

  // Состояния формы
  const [form, setForm] = useState({
    fullName: '',
    position: '',
    contact: '',
    address: '',
    description: '',
    files: [],
  });
  const [addresses, setAddresses] = useState([]);
  const [filteredAddresses, setFilteredAddresses] = useState([]);
  const [showAddressList, setShowAddressList] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const addressInputRef = useRef(null);

  // Получить адреса для автокомплита
  useEffect(() => {
    axios.get('/api/addresses').then(res => setAddresses(res.data || []));
  }, []);

  // Закрытие выпадающего списка при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowAddressList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Обработка изменения полей
  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
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
  const handleAddressSelect = address => {
    setForm(f => ({ ...f, address }));
    setShowAddressList(false);
    addressInputRef.current && addressInputRef.current.blur();
  };

  // Файлы (до 5)
  const handleFileChange = e => {
    let files = Array.from(e.target.files)
      .filter(f => f.type.startsWith('image')); // Только изображения
    if (form.files.length + files.length > 5) files = files.slice(0, 5 - form.files.length);
    setForm(f => ({ ...f, files: [...f.files, ...files] }));
    e.target.value = '';
  };
  const handleRemoveFile = idx => {
    setForm(f => ({ ...f, files: f.files.filter((_, i) => i !== idx) }));
  };

  // Отправка формы
  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const data = new FormData();
      data.append('fullName', form.fullName);
      data.append('position', form.position);
      if (form.contact) data.append('contact', form.contact);
      data.append('address', form.address);
      data.append('description', form.description);
      form.files.forEach(f => data.append('files', f));
      await axios.post('/api/client-tickets', data);
      setSuccess(true);
      setForm({ fullName: '', position: '', contact: '', address: '', description: '', files: [] });
    } catch (e) {
      setError('Ошибка при отправке. Попробуйте еще раз.');
    } finally {
      setSending(false);
    }
  };

  // Если не клиент — показать только форму или кнопку входа
  if (!loading && isAuthenticated && user && user.department !== 'Клиент') {
    return null;
  }

  return (
    <div className={styles.ticketsPageWrapper} data-theme="light">
      {/* Анимированный градиентный фон */}
      <div className={styles.animatedBg}>
        <div className={styles.gradientOrb1}></div>
        <div className={styles.gradientOrb2}></div>
        <div className={styles.gradientOrb3}></div>
        <div className={styles.gradientOrb4}></div>
      </div>

      <div className={styles.ticketsCard}>
        <div className="text-center mb-3">
          <img src={LOGO_SRC} alt="ВкусВилл" className={styles.logo} />
        </div>
        <h2 className={styles.ticketsTitle}>Заявка для клиентов</h2>
        {success && (
          <>
            <div className={styles.successOverlay} />
            <div className={styles.successPopup}>
              <div className={styles.successIcon}>✓</div>
              <b>Заявка отправлена!</b>
              <div style={{ marginTop: 8, color: '#666' }}>Спасибо, мы свяжемся с вами.</div>
              <button
                className={styles.successBtn}
                onClick={() => setSuccess(false)}
              >
                Новая заявка
              </button>
            </div>
          </>
        )}
        <form className={`row g-3 ${styles.ticketsForm}`} onSubmit={handleSubmit} autoComplete="off" style={success ? { filter: 'blur(2px)', pointerEvents: 'none' } : {}}>
          <div className="col-12 col-md-6">
            <label className={styles.formLabel}>ФИО *</label>
            <input className={styles.formInput} name="fullName" value={form.fullName} onChange={handleChange} required maxLength={64} placeholder="Введите ФИО" />
          </div>
          <div className="col-12 col-md-6">
            <label className={styles.formLabel}>Должность *</label>
            <input className={styles.formInput} name="position" value={form.position} onChange={handleChange} required maxLength={64} placeholder="Ваша должность" />
          </div>
          <div className="col-12 col-md-6">
            <label className={styles.formLabel}>Контакт (телефон/email)</label>
            <input className={styles.formInput} name="contact" value={form.contact} onChange={handleChange} maxLength={64} placeholder="+7... или email" />
          </div>
          <div className="col-12 col-md-6 position-relative" ref={dropdownRef}>
            <label className={styles.formLabel}>Номер объекта (адрес) *</label>
            <div className={styles.inputGroup}>
              <input
                className={styles.formInput}
                name="address"
                value={form.address}
                onChange={handleChange}
                required
                placeholder="Введите адрес"
                ref={addressInputRef}
                autoComplete="off"
                onFocus={() => form.address && setShowAddressList(filteredAddresses.length > 0)}
              />
              <button
                type="button"
                className={styles.dropdownBtn}
                tabIndex={-1}
                onClick={() => {
                  if (showAddressList) {
                    setShowAddressList(false);
                  } else {
                    setFilteredAddresses(addresses.map(a => a.address));
                    setShowAddressList(addresses.length > 0);
                    addressInputRef.current && addressInputRef.current.focus();
                  }
                }}
                title="Показать все адреса"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" style={{ transform: showAddressList ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <path d="M1.646 5.646a.5.5 0 0 1 .708 0L8 11.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z" />
                </svg>
              </button>
            </div>
            {showAddressList && (
              <div className={styles.addressDropdownList}>
                {filteredAddresses.length > 0 ? filteredAddresses.map((a, i) => (
                  <div key={i} className={styles.addressDropdownItem} onClick={() => handleAddressSelect(a)}>{a}</div>
                )) : <div className={styles.addressDropdownEmpty}>Нет совпадений</div>}
              </div>
            )}
          </div>
          <div className="col-12">
            <label className={styles.formLabel}>Описание поломки *</label>
            <textarea className={styles.formTextarea} name="description" value={form.description} onChange={handleChange} required rows={3} maxLength={500} placeholder="Опишите проблему" />
          </div>
          <div className="col-12">
            <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} id="file-upload" />
            <label htmlFor="file-upload" className={styles.uploadBtn}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: 8 }}>
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z" />
              </svg>
              Загрузить фото
            </label>
            <span className={styles.fileHint}>До 5 файлов</span>
            {form.files.length > 0 && (
              <div className={styles.filePreviewList}>
                {form.files.map((file, idx) => (
                  <div key={idx} className={styles.filePreview}>
                    {file.type.startsWith('image') ? (
                      <img src={URL.createObjectURL(file)} alt="preview" />
                    ) : file.type.startsWith('video') ? (
                      <video src={URL.createObjectURL(file)} />
                    ) : null}
                    <button type="button" className={styles.removeFileBtn} onClick={() => handleRemoveFile(idx)}>&times;</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {error && <div className="col-12"><div className={styles.errorAlert}>{error}</div></div>}
          <div className="col-12 mt-2">
            <button className={styles.submitBtn} type="submit" disabled={sending}>
              {sending ? (
                <>
                  <span className={styles.spinner}></span>
                  Отправка...
                </>
              ) : 'Отправить заявку'}
            </button>
          </div>
        </form>
        {!isAuthenticated && (
          <div className="text-center mt-4">
            <button className={styles.engineerBtn} onClick={() => navigate('/auth')}>
              Вход для инженеров
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
