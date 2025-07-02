import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaChevronDown } from 'react-icons/fa';

function Schedule() {
  const { user } = useAuth();
  // Фильтр "мои вызовы"
  const [onlyMine, setOnlyMine] = useState(true);
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [users, setUsers] = useState([]);
  // Сортировка: сегодня — по времени, остальные — по дате
  const [sortConfig, setSortConfig] = useState({
    key: 'departTime',
    direction: 'asc',
    context: 'today', // today | other
  });
  // Чекбокс для завершенных
  const [showFinished, setShowFinished] = useState(false);
  const [filteredAddresses, setFilteredAddresses] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressInputRef = useRef(null);


  // Modal form state
  const [form, setForm] = useState({
    date: '',
    departTime: '', // добавить это поле
    address: '',
    classification: '', // по умолчанию не выбрано
    customClass: '',
    userId: '',
  });
  const [validation, setValidation] = useState({});

  // Удалить выезд
  const handleDelete = async (row) => {
    if (!window.confirm('Вы действительно хотите удалить этот выезд?')) return;
    try {
      await axios.delete(`/api/requests/${row.id}`);
      await fetchSchedules();
    } catch (e) {
      alert('Ошибка при удалении выезда');
    }
  };

  // Fetch addresses, users, and schedule (requests)

useEffect(() => {
  axios.get('/api/addresses').then(r => setAddresses(r.data || []));
  axios.get('/api/users').then(r => setUsers(r.data || []));
  // fetchSchedules(); // убираем отсюда
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// После загрузки пользователей, обновить график
useEffect(() => {
  if (users.length > 0) {
    fetchSchedules();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [users]);

  // Получить график (requests)
  const fetchSchedules = async () => {
    try {
      const res = await axios.get('/api/requests');
      // Если сервер вернул message, значит пусто
      if (Array.isArray(res.data)) {
        setSchedules(res.data.map(r => ({
          ...r,
          user: r.Engineer || users.find(u => u.id === r.engineerId) || null,
        })));
      } else {
        setSchedules([]);
      }
    } catch (e) {
      setSchedules([]);
    }
  };

  // Modal open/close
  const openModal = () => { setShowModal(true); };
  const closeModal = () => { setShowModal(false); setForm({ date: '', departTime: '', address: '', classification: '', customClass: '', userId: '' }); setValidation({}); setFilteredAddresses([]); setShowAddressSuggestions(false); };

  // Address autocomplete logic
  const handleAddressChange = (e) => {
    const value = e.target.value;
    setForm(f => ({ ...f, address: value }));
    if (value.trim() === '') {
      setFilteredAddresses([]);
      setShowAddressSuggestions(false);
    } else {
      const filtered = addresses.filter(a => a.address.toLowerCase().includes(value.toLowerCase())).map(a => a.address);
      setFilteredAddresses(filtered);
      setShowAddressSuggestions(filtered.length > 0);
    }
  };
  const handleAddressSelect = (address) => {
    setForm(f => ({ ...f, address }));
    setShowAddressSuggestions(false);
  };

  // Classification change
  const handleClassChange = (e) => {
    setForm(f => ({ ...f, classification: e.target.value, customClass: '' }));
  };


  // Modal form submit (create or edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {
      date: !form.date,
      address: !form.address,
      userId: !form.userId,
      classification: !form.classification || (form.classification === 'Другое' && !form.customClass),
    };
    setValidation(errors);
    if (Object.values(errors).some(Boolean)) return;
    const payload = {
      date: form.date,
      departTime: form.departTime, // добавить это поле
      address: form.address,
      type: form.classification === 'Другое' ? form.customClass : (form.classification === 'Аварийный вызов' ? 'АВ' : form.classification),
      classification: form.classification === 'Другое' ? form.customClass : form.classification,
      description: '-', // минимальное не пустое значение
      engineerId: Number(form.userId),
      status: 'В работе',
    };
    try {
      if (form.id) {
        // Редактирование существующего
        await axios.put(`/api/requests/${form.id}`, payload);
      } else {
        // Новый выезд
        await axios.post('/api/requests', payload);
      }
      await fetchSchedules();
      closeModal();
    } catch (e) {
      alert('Ошибка при добавлении/редактировании выезда');
    }
  };

  // Sorting
  // Универсальная сортировка, с поддержкой "контекста" (сегодня/остальные)
  const handleSort = (key, context = null) => {
    setSortConfig(cfg => {
      const direction = cfg.key === key && cfg.direction === 'asc' ? 'desc' : 'asc';
      return { key, direction, context: context || cfg.context };
    });
  };

  // Фильтрация по статусу
  const filteredSchedules = onlyMine && user
    ? schedules.filter(r => String(r.engineerId) === String(user.id))
    : schedules;


  // --- Месячный фильтр для завершённых выездов ---
  // Получить список месяцев, в которых есть завершённые выезды
  const finishedSchedules = filteredSchedules.filter(r => r.status === 'Завершено');
  const activeSchedules = filteredSchedules.filter(r => r.status !== 'Завершено');

  // Получить уникальные месяцы (YYYY-MM) из завершённых выездов
  const finishedMonths = Array.from(
    new Set(finishedSchedules.map(r => r.date?.slice(0, 7)).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a)); // по убыванию (сначала новые)

  // Текущий месяц по умолчанию
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Селектор месяца для завершённых выездов
  const [selectedFinishedMonth, setSelectedFinishedMonth] = useState(currentMonth);

  // Если выбран "все выезды", показываем все, иначе только за выбранный месяц
  const filteredFinishedSchedules = selectedFinishedMonth === 'all'
    ? finishedSchedules
    : finishedSchedules.filter(r => r.date && r.date.startsWith(selectedFinishedMonth));

  // Разделение на сегодняшние и остальные (только для активных)
  const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const todaySchedules = activeSchedules.filter(r => r.date === todayStr);
  const otherSchedules = activeSchedules.filter(r => r.date !== todayStr);

  // Сортировка для "сегодняшних" — по времени, для остальных — по дате
  const sortedTodaySchedules = [...todaySchedules].sort((a, b) => {
    let key = sortConfig.context === 'today' ? sortConfig.key : 'departTime';
    let direction = sortConfig.context === 'today' ? sortConfig.direction : 'asc';
    let v1 = a[key], v2 = b[key];
    if (key === 'user') {
      v1 = a.user?.lastName || '';
      v2 = b.user?.lastName || '';
    }
    if (v1 < v2) return direction === 'asc' ? -1 : 1;
    if (v1 > v2) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  const sortedSchedules = [...otherSchedules].sort((a, b) => {
    let key = sortConfig.context === 'other' ? sortConfig.key : 'date';
    let direction = sortConfig.context === 'other' ? sortConfig.direction : 'asc';
    let v1 = a[key], v2 = b[key];
    if (key === 'user') {
      v1 = a.user?.lastName || '';
      v2 = b.user?.lastName || '';
    }
    if (v1 < v2) return direction === 'asc' ? -1 : 1;
    if (v1 > v2) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  // Завершенные
  const sortedFinishedSchedules = [...finishedSchedules].sort((a, b) => {
    let v1 = a[sortConfig.key], v2 = b[sortConfig.key];
    if (sortConfig.key === 'user') {
      v1 = a.user?.lastName || '';
      v2 = b.user?.lastName || '';
    }
    if (v1 < v2) return sortConfig.direction === 'asc' ? -1 : 1;
    if (v1 > v2) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });


  // Завершить выезд (архивировать)
  const handleFinish = async (row) => {
    try {
      await axios.put(`/api/requests/${row.id}`, { ...row, status: 'Завершено' });
      await fetchSchedules();
      // Redirect to new report with prefilled data
      // Передаем все нужные поля через query string
      const params = new URLSearchParams({
        date: row.date || '',
        address: row.address || '',
        classification: row.classification || row.type || '',
        customClass: !['ТО Китчен', 'ТО Пекарня', 'ПНР', 'Аварийный вызов'].includes(row.classification || row.type) ? (row.classification || row.type || '') : ''
      });
      navigate(`/new-report?${params.toString()}`);
    } catch (e) {
      alert('Ошибка при завершении выезда');
    }
  };

  // Вернуть завершённый выезд обратно в "В работе"
  const handleReturn = async (row) => {
    try {
      await axios.put(`/api/requests/${row.id}`, { ...row, status: 'В работе' });
      await fetchSchedules();
    } catch (e) {
      alert('Ошибка при возврате выезда');
    }
  };

  // Render

  return (
    <div className="container mt-5 mb-5">
      <h1 className="mb-4">График</h1>

      <div className="d-flex align-items-center mb-3">
        <button className="btn btn-primary me-3" onClick={openModal} style={{ fontWeight: 'bold' }}>
          добавить выезд
        </button>
        <div className="form-check me-3">
          <input
            className="form-check-input"
            type="checkbox"
            id="onlyMine"
            checked={onlyMine}
            onChange={e => setOnlyMine(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="onlyMine">
            Мои вызовы
          </label>
        </div>
        <div className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            id="showFinished"
            checked={showFinished}
            onChange={e => setShowFinished(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="showFinished">
            Завершённые
          </label>
        </div>
      </div>
      {/* Завершённые выезды */}
      {showFinished && (
        <div className="mb-4 p-2" style={{ border: '2px solid #19875422', borderRadius: '12px', background: '#f8fff8' }}>
          <div className="mb-2 d-flex align-items-center" style={{ fontWeight: 'bold', color: '#198754' }}>
            <span className="me-3">Завершённые выезды</span>
            <div className="d-flex align-items-center">
              <span className="me-2" style={{ fontWeight: 'normal', color: '#333', fontSize: 15 }}>Месяц:</span>
              <select
                className="form-select form-select-sm"
                style={{ width: 180, display: 'inline-block' }}
                value={selectedFinishedMonth}
                onChange={e => setSelectedFinishedMonth(e.target.value)}
              >
                <option value={currentMonth}>Текущий месяц</option>
                {finishedMonths.filter(m => m !== currentMonth).map(m => {
                  const [y, mo] = m.split('-');
                  return (
                    <option key={m} value={m}>
                      {`${mo}.${y}`}
                    </option>
                  );
                })}
                <option value="all">Все выезды</option>
              </select>
            </div>
          </div>
          <table className="table table-bordered align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: 40 }}>№</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('date', 'other')}>дата {sortConfig.key === 'date' && sortConfig.context === 'other' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('departTime', 'other')}>время выезда {sortConfig.key === 'departTime' && sortConfig.context === 'other' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('address', 'other')}>объект {sortConfig.key === 'address' && sortConfig.context === 'other' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('classification', 'other')}>классификация {sortConfig.key === 'classification' && sortConfig.context === 'other' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('user', 'other')}>исполнитель {sortConfig.key === 'user' && sortConfig.context === 'other' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredFinishedSchedules.length === 0 && (
                <tr><td colSpan="7" className="text-center text-muted">Нет завершённых выездов</td></tr>
              )}
              {sortedFinishedSchedules
                .filter(row => filteredFinishedSchedules.includes(row))
                .map((row, idx) => (
                <tr key={row.id} style={{ background: '#f0fff0' }}>
                  <td>{idx + 1}</td>
                  <td>{row.date && row.date.split('-').reverse().join('.')}</td>
                  <td>{row.departTime}</td>
                  <td>{row.address}</td>
                  <td>{row.classification || row.type}</td>
                  <td>{row.user ? `${row.user.lastName} ${row.user.firstName ? row.user.firstName[0] + '.' : ''}` : ''}</td>
                  <td>
                    <button className="btn btn-success btn-sm me-2" onClick={e => { e.stopPropagation(); handleReturn(row); }}>вернуть</button>
                    <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(row); }}>удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{form.id ? 'Редактировать выезд' : 'Добавить выезд'}</h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Дата *</label>
                    <input type="date" className="form-control" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={validation.date ? { borderColor: '#dc3545', borderWidth: 2 } : {}} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Время выезда</label>
                    <input type="time" className="form-control" value={form.departTime} onChange={e => setForm(f => ({ ...f, departTime: e.target.value }))} />
                  </div>
                  <div className="mb-3 position-relative">
                    <label className="form-label">Объект *</label>
                    <div className="input-group">
                      <input type="text" className="form-control" value={form.address} onChange={handleAddressChange} style={validation.address ? { borderColor: '#dc3545', borderWidth: 2 } : {}} ref={addressInputRef} required autoComplete="off" />
                      <button type="button" className="btn btn-outline-secondary" onClick={() => { setFilteredAddresses(addresses.map(a => a.address)); setShowAddressSuggestions(true); }}><FaChevronDown /></button>
                    </div>
                    {showAddressSuggestions && (
                      <div className="position-absolute w-100 mt-1 bg-white border rounded shadow-sm" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                        {filteredAddresses.length > 0 ? filteredAddresses.map((address, idx) => (
                          <div key={idx} className="p-2 border-bottom" style={{ cursor: 'pointer' }} onClick={() => handleAddressSelect(address)} onMouseOver={e => e.target.style.backgroundColor = '#f8f9fa'} onMouseOut={e => e.target.style.backgroundColor = ''}>{address}</div>
                        )) : <div className="p-2 text-muted">Нет подходящих адресов</div>}
                      </div>
                    )}
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Классификация *</label>
                    <select className="form-select" value={form.classification} onChange={handleClassChange} style={validation.classification ? { borderColor: '#dc3545', borderWidth: 2 } : {}} required>
                      <option value="" disabled>Не выбрано</option>
                      <option value="ТО Китчен">ТО Китчен</option>
                      <option value="ТО Пекарня">ТО Пекарня</option>
                      <option value="ПНР">ПНР</option>
                      <option value="Аварийный вызов">Аварийный вызов</option>
                      <option value="Другое">Другое</option>
                    </select>
                    {form.classification === 'Другое' && (
                      <input type="text" className="form-control mt-2" value={form.customClass} onChange={e => setForm(f => ({ ...f, customClass: e.target.value }))} placeholder="Укажите свой вариант" required />
                    )}
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Исполнитель *</label>
                    <select className="form-select" value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} style={validation.userId ? { borderColor: '#dc3545', borderWidth: 2 } : {}} required>
                      <option value="">Выберите исполнителя</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.lastName} {u.firstName ? (u.firstName[0] + '.') : ''}</option>
                      ))}
                    </select>
                  </div>
                  
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>Отмена</button>
                  <button type="submit" className="btn btn-primary">{form.id ? 'Сохранить' : 'Добавить'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Сегодняшние выезды */}
      {sortedTodaySchedules.length > 0 && (
        <div className="mb-4 p-2" style={{ border: '2px solid #0d6efd22', borderRadius: '12px', background: '#f8faff' }}>
          <div className="mb-2" style={{ fontWeight: 'bold', color: '#0d6efd' }}>Сегодняшние выезды</div>
          <table className="table table-bordered align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: 40 }}>№</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('date', 'today')}>дата {sortConfig.key === 'date' && sortConfig.context === 'today' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('departTime', 'today')}>время выезда {sortConfig.key === 'departTime' && sortConfig.context === 'today' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('address', 'today')}>объект {sortConfig.key === 'address' && sortConfig.context === 'today' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('classification', 'today')}>классификация {sortConfig.key === 'classification' && sortConfig.context === 'today' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('user', 'today')}>исполнитель {sortConfig.key === 'user' && sortConfig.context === 'today' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedTodaySchedules.map((row, idx) => (
                <tr key={row.id} style={{ cursor: 'pointer', background: '#eaf4ff' }} onClick={e => {
                  if (e.target.tagName !== 'BUTTON') {
                    setForm({
                      id: row.id,
                      date: row.date,
                      departTime: row.departTime || '',
                      address: row.address,
                      classification: row.classification || row.type || '',
                      customClass: !['ТО Китчен', 'ТО Пекарня', 'ПНР', 'Аварийный вызов'].includes(row.classification || row.type) ? (row.classification || row.type) : '',
                      userId: row.engineerId ? String(row.engineerId) : (users.find(u => u.lastName === row.user?.lastName && u.firstName[0] === row.user?.firstName[0])?.id || ''),
                    });
                    setShowModal(true);
                  }
                }}>
                  <td>{idx + 1}</td>
                  <td>{row.date && row.date.split('-').reverse().join('.')}</td>
                  <td>{row.departTime}</td>
                  <td>{row.address}</td>
                  <td>{row.classification || row.type}</td>
                  <td>{row.user ? `${row.user.lastName} ${row.user.firstName ? row.user.firstName[0] + '.' : ''}` : ''}</td>
                  <td>
                    <button className="btn btn-primary btn-sm me-2" onClick={e => { e.stopPropagation(); handleFinish(row); }}>завершить</button>
                    <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(row); }}>удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Остальные выезды */}
      <table className="table table-bordered align-middle">
        <thead>
          <tr>
            <th style={{ width: 40 }}>№</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('date', 'other')}>дата {sortConfig.key === 'date' && sortConfig.context === 'other' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('departTime', 'other')}>время выезда {sortConfig.key === 'departTime' && sortConfig.context === 'other' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('address', 'other')}>объект {sortConfig.key === 'address' && sortConfig.context === 'other' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('classification', 'other')}>классификация {sortConfig.key === 'classification' && sortConfig.context === 'other' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('user', 'other')}>исполнитель {sortConfig.key === 'user' && sortConfig.context === 'other' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sortedSchedules.map((row, idx) => (
            <tr key={row.id} style={{ cursor: 'pointer' }} onClick={e => {
              if (e.target.tagName !== 'BUTTON') {
                setForm({
                  id: row.id,
                  date: row.date,
                  departTime: row.departTime || '',
                  address: row.address,
                  classification: row.classification || row.type || '',
                  customClass: !['ТО Китчен', 'ТО Пекарня', 'ПНР', 'Аварийный вызов'].includes(row.classification || row.type) ? (row.classification || row.type) : '',
                  userId: row.engineerId ? String(row.engineerId) : (users.find(u => u.lastName === row.user?.lastName && u.firstName[0] === row.user?.firstName[0])?.id || ''),
                });
                setShowModal(true);
              }
            }}>
              <td>{idx + 1}</td>
              <td>{row.date && row.date.split('-').reverse().join('.')}</td>
              <td>{row.departTime}</td>
              <td>{row.address}</td>
              <td>{row.classification || row.type}</td>
              <td>{row.user ? `${row.user.lastName} ${row.user.firstName ? row.user.firstName[0] + '.' : ''}` : ''}</td>
              <td>
                <button className="btn btn-primary btn-sm me-2" onClick={e => { e.stopPropagation(); handleFinish(row); }}>завершить</button>
                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(row); }}>удалить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Schedule;
