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
    <div className="tickets-bg-gradient min-vh-100 d-flex align-items-center justify-content-center">
      <div className="container" style={{maxWidth: 600, background: 'rgba(255,255,255,0.97)', borderRadius: 18, boxShadow: '0 2px 16px 0 rgba(45,190,100,0.10)', position: 'relative'}}>
        <div className="text-center mb-3">
          <img src={LOGO_SRC} alt="ВкусВилл" style={{maxWidth: 180, height: '150px'}} />
        </div>
        <h2 className="mb-4" style={{color:'#2dbe64', fontFamily:'Villula, Euclide Circular B, Arial', fontWeight:600}}>Заявка для клиентов</h2>
        {success && (
          <>
            <div
              style={{
                position: 'fixed',
                left: 0,
                top: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(45,190,100,0.12)',
                backdropFilter: 'blur(4px)',
                zIndex: 999,
              }}
            />
            <div className={styles.successPopup} style={{zIndex: 1000}}>
              <b>Заявка отправлена!</b>
              <div style={{marginTop:8}}>Спасибо, мы свяжемся с вами.</div>
              <button
                className="btn btn-success mt-3"
                style={{background:'#2dbe64', borderColor:'#2dbe64'}}
                onClick={() => setSuccess(false)}
              >
                Новая заявка
              </button>
            </div>
          </>
        )}
        <form className="row g-3" onSubmit={handleSubmit} autoComplete="off" style={success ? {filter: 'blur(2px)', pointerEvents: 'none'} : {}}>
          <div className="col-12 col-md-6">
            <label className="form-label">ФИО *</label>
            <input className="form-control" name="fullName" value={form.fullName} onChange={handleChange} required maxLength={64} placeholder="Введите ФИО" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Должность *</label>
            <input className="form-control" name="position" value={form.position} onChange={handleChange} required maxLength={64} placeholder="Ваша должность" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Контакт (телефон/email, по желанию)</label>
            <input className="form-control" name="contact" value={form.contact} onChange={handleChange} maxLength={64} placeholder="+7... или email" />
          </div>
          <div className="col-12 col-md-6 position-relative">
            <label className="form-label">Номер объекта (адрес) *</label>
            <div className="input-group">
              <input
                className="form-control"
                name="address"
                value={form.address}
                onChange={handleChange}
                required
                placeholder="Введите адрес или выберите из списка"
                ref={addressInputRef}
                autoComplete="off"
                onFocus={() => form.address && setShowAddressList(filteredAddresses.length > 0)}
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                tabIndex={-1}
                style={{borderTopLeftRadius:0, borderBottomLeftRadius:0, borderLeft:'none', fontWeight:600, background:'none', display:'flex', alignItems:'center'}}
                onClick={() => {
                  setFilteredAddresses(addresses.map(a => a.address));
                  setShowAddressList(addresses.length > 0);
                  addressInputRef.current && addressInputRef.current.focus();
                }}
                title="Показать все адреса"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#888" viewBox="0 0 16 16"><path d="M1.646 5.646a.5.5 0 0 1 .708 0L8 11.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>
              </button>
            </div>
            {showAddressList && (
              <div className="position-absolute w-100 mt-1 bg-white border rounded shadow-sm" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                {filteredAddresses.length > 0 ? filteredAddresses.map((a, i) => (
                  <div key={i} className="p-2 border-bottom" style={{cursor:'pointer'}} onClick={() => handleAddressSelect(a)}>{a}</div>
                )) : <div className="p-2 text-muted">Нет совпадений</div>}
              </div>
            )}
          </div>
          <div className="col-12">
            <label className="form-label">Описание поломки *</label>
            <textarea className="form-control" name="description" value={form.description} onChange={handleChange} required rows={3} maxLength={500} placeholder="Опишите проблему" />
          </div>
          <div className="col-12">
            <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} id="file-upload" />
            <label htmlFor="file-upload" className="btn btn-success mb-2" style={{fontWeight:600, background:'#2dbe64', color:'#fff', borderColor:'#2dbe64', margin:0, cursor:'pointer', letterSpacing:'0.02em'}}>Загрузить файлы</label>
            <div style={{height:10}}></div>
            <label className="form-label">Фото (до 5 файлов)</label>
            <div className="d-flex gap-2 flex-wrap">
              {form.files.map((file, idx) => (
                <div key={idx} className={styles.filePreview}>
                  {file.type.startsWith('image') ? (
                    <img src={URL.createObjectURL(file)} alt="preview" />
                  ) : file.type.startsWith('video') ? (
                    <video src={URL.createObjectURL(file)} controls style={{width:'100%',height:'100%'}} />
                  ) : null}
                  <button type="button" className={styles.removeFileBtn} onClick={() => handleRemoveFile(idx)}>&times;</button>
                </div>
              ))}
            </div>
          </div>
          {error && <div className="col-12"><div className="alert alert-danger py-2">{error}</div></div>}
          <div className="col-12 d-grid mt-2">
            <button className="btn btn-success btn-lg" type="submit" disabled={sending}>{sending ? 'Отправка...' : 'Отправить заявку'}</button>
          </div>
        </form>
        {!isAuthenticated && (
          <div className="text-center mt-4">
            <button className="btn btn-danger btn-lg" onClick={()=>navigate('/auth')}>Вход для инженеров</button>
          </div>
        )}
      </div>
    </div>
  );
}
