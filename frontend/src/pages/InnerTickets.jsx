import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // Импортируем хук авторизации

//TODO: не отображаются фото, исправить кнопку посмотреть фото.

function InnerTickets() {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const { user } = useAuth(); // Получаем текущего пользователя из контекста

  // Получить заявки и пользователей
  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      try {
        const params = {
          // status: showCompleted ? undefined : 'not-completed', // Удалить эту строку!
          filterStatus: filterStatus || undefined,
          filterMonth: filterMonth || undefined,
          search: search || undefined,
          sort: sortOrder,
        };
        // Если выбран "Показать выполненные", добавляем статус
        if (showCompleted) {
          params.status = "Выполнено";
        } else if (filterStatus) {
          params.status = filterStatus;
        }
        const res = await axios.get('/api/client-tickets', { params });
        setTickets(Array.isArray(res.data.tickets) ? res.data.tickets : []);
      } catch {
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };

    const fetchUsers = async () => {
      try {
        const res = await axios.get('/api/users');
        setUsers(res.data || []);
      } catch {
        setUsers([]);
      }
    };

    // Получить текущего пользователя
    const fetchCurrentUser = async () => {
      try {
        const res = await axios.get('/api/me');
        setCurrentUserId(res.data?.id || null);
      } catch {
        setCurrentUserId(null);
      }
    };

    fetchTickets();
    fetchUsers();
    fetchCurrentUser();
  }, [showCompleted, filterStatus, filterMonth, search, sortOrder]);

  // Исправленный handleAssign: теперь можно снять исполнителя (назначить "Не назначено")
  const handleAssign = async (ticketId, userId) => {
    try {
      await axios.put(`/api/client-tickets/${ticketId}`, {
        engineerId: userId === '' ? null : Number(userId),
        status: 'В работе'
      });
      window.location.reload();
    } catch (e) {
      alert('Ошибка назначения исполнителя');
    }
  };

  // Кнопка "Посмотреть фото" (открывает модальное окно с фото)
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoFiles, setPhotoFiles] = useState([]);

  const handleShowPhotos = (ticket) => {
    // Гарантируем что photoFiles всегда массив
    let files = ticket.files;
    if (!Array.isArray(files)) {
      if (files && typeof files === 'object') files = [files];
      else files = [];
    }
    setPhotoFiles(files);
    setShowPhotoModal(true);
  };

  const handleClosePhotoModal = () => {
    setShowPhotoModal(false);
    setPhotoFiles([]);
  };

  const handleStatusChange = async (ticketId, status) => {
    try {
      await axios.put(`/api/client-tickets/${ticketId}`, { status });
      window.location.reload();
    } catch (e) {
      alert('Ошибка изменения статуса');
    }
  };

  const handleDelete = async (ticketId) => {
    if (window.confirm('Удалить заявку?')) {
      await axios.delete(`/api/client-tickets/${ticketId}`);
      // Обновить таблицу после удаления
      setSearch(s => s + ' ');
    }
  };

  const handleCreateReport = (ticket) => {
    const params = new URLSearchParams({
      date: ticket.date || '',
      address: ticket.address || '',
      customClass: ticket.description || '',
    });
    axios.put(`/api/client-tickets/${ticket.id}`, { status: 'Выполнено' }).then(() => setSearch(s => s));
    window.location.href = `/new-report?${params.toString()}`;
  };

  const filteredTickets = tickets.filter(t =>
    showCompleted ? t.status === 'Выполнено' : t.status !== 'Выполнено'
  );
  const workingTickets = tickets.filter(t => t.status === 'В работе');

  // Функция для сокращения описания
  const getShortDescription = (desc, maxLen = 60) => {
    if (!desc) return '';
    if (desc.length <= maxLen) return desc;
    return desc.slice(0, maxLen) + '...';
  };

  const [expandedDescId, setExpandedDescId] = useState(null);

  return (
    <div className="container mt-5 mb-5">
      <h2>Входящие заявки от клиентов</h2>

      {/* Модальное окно для просмотра фото */}
      {showPhotoModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Фото заявки</h5>
                <button type="button" className="btn-close" onClick={handleClosePhotoModal}></button>
              </div>
              <div className="modal-body">
                {Array.isArray(photoFiles) && photoFiles.length === 0 ? (
                  <div className="text-muted">Нет фото</div>
                ) : (
                  <div className="d-flex flex-wrap gap-3">
                    {Array.isArray(photoFiles) && photoFiles.map((file, idx) => (
                      <img
                        key={idx}
                        src={`/api/files/preview/${encodeURIComponent(file.filename || file)}`}
                        alt="Фото заявки"
                        style={{ maxWidth: 320, maxHeight: 220, borderRadius: 8, border: '2px solid #0d6efd' }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={handleClosePhotoModal}>Закрыть</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Таблица "В работе" */}
      {workingTickets.length > 0 && (
        <div className="mb-4 p-2" style={{ border: '2px solid #0d6efd22', borderRadius: '12px', background: '#f8faff' }}>
          <h5 className="mb-2" style={{ fontWeight: 'bold', color: '#0d6efd' }}>Заявки в работе</h5>
          <div className="table-responsive">
            <table className="table table-bordered table-striped align-middle mb-0">
              <thead className="table-primary">
                <tr>
                  <th>Дата</th>
                  <th>Адрес</th>
                  <th>ФИО</th>
                  <th>Должность</th>
                  <th>Контакт</th>
                  <th>Описание</th>
                  <th>Статус</th>
                  <th>Исполнитель</th>
                  <th>Фото</th>
                  <th style={{ width: 220 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {workingTickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td>{ticket.date ? new Date(ticket.date).toLocaleDateString('ru-RU') : ''}</td>
                    <td>{ticket.address}</td>
                    <td>{ticket.fullName}</td>
                    <td>{ticket.position}</td>
                    <td>{ticket.contact}</td>
                    <td>
                      {expandedDescId === ticket.id ? (
                        <>
                          {ticket.description}
                          <button
                            className="btn btn-link btn-sm p-0 ms-2"
                            onClick={() => setExpandedDescId(null)}
                            style={{ fontSize: 13 }}
                          >
                            Свернуть
                          </button>
                        </>
                      ) : (
                        <>
                          {getShortDescription(ticket.description)}
                          {ticket.description && ticket.description.length > 60 && (
                            <button
                              className="btn btn-link btn-sm p-0 ms-2"
                              onClick={() => setExpandedDescId(ticket.id)}
                              style={{ fontSize: 13 }}
                            >
                              Подробнее
                            </button>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ minWidth: 130, maxWidth: 180 }}
                        value={ticket.engineerId === null ? '' : ticket.status}
                        onChange={e => handleStatusChange(ticket.id, e.target.value)}
                        disabled={ticket.status === 'Выполнено'}
                      >
                        <option value="Не назначено">Не назначено</option>
                        <option value="В работе">В работе</option>
                        <option value="Выполнено">Выполнено</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{
                          minWidth: 150,
                          maxWidth: 220,
                          border: ticket.engineerId === user?.id ? '2px solid #0d6efd' : undefined,
                          background: ticket.engineerId === user?.id ? '#eaf4ff' : undefined,
                          fontWeight: ticket.engineerId === user?.id ? 'bold' : undefined
                        }}
                        value={ticket.engineerId === null ? '' : ticket.engineerId}
                        onChange={e => handleAssign(ticket.id, e.target.value)}
                        disabled={ticket.status === 'Выполнено'}
                      >
                        <option value="">Не назначено</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.lastName} {u.firstName}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className="btn btn-warning btn-sm fw-bold"
                        style={{ border: '2px solid #0d6efd', color: '#0d6efd', background: '#fffbe6' }}
                        onClick={() => handleShowPhotos(ticket)}
                      >
                        Посмотреть фото
                      </button>
                    </td>
                    <td>
                      <button className="btn btn-primary btn-sm me-2" onClick={() => handleCreateReport(ticket)} disabled={ticket.status === 'Выполнено'}>
                        Создать отчет
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ticket.id)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div
        className="d-flex flex-wrap align-items-center justify-content-start gap-3 mb-3"
        style={{ background: "#ededed", borderRadius: 10, padding: "18px 18px 12px 18px" }}
      >
        <input
          type="text"
          className="form-control"
          placeholder="Поиск по адресу или ФИО"
          style={{ maxWidth: 220, minWidth: 180 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="form-select"
          style={{ maxWidth: 170, minWidth: 140 }}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="Не назначено">Не назначено</option>
          <option value="В работе">В работе</option>
          <option value="Выполнено">Выполнено</option>
        </select>
        <input
          type="month"
          className="form-control"
          style={{ maxWidth: 170, minWidth: 120 }}
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
        />
        <select
          className="form-select"
          style={{ maxWidth: 180, minWidth: 150 }}
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value)}
        >
          <option value="desc">Сначала новые</option>
          <option value="asc">Сначала старые</option>
        </select>
        <div className="form-check ms-2" style={{ minWidth: 180 }}>
          <input
            className="form-check-input"
            type="checkbox"
            id="showCompleted"
            checked={showCompleted}
            onChange={e => setShowCompleted(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="showCompleted">
            Показать выполненные
          </label>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-bordered table-striped align-middle">
          <thead className="table-light">
            <tr>
              <th>Дата</th>
              <th>Адрес</th>
              <th>ФИО</th>
              <th>Должность</th>
              <th>Контакт</th>
              <th>Описание</th>
              <th>Статус</th>
              <th>Исполнитель</th>
              <th style={{ width: 220 }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="text-center">Загрузка...</td></tr>
            ) : filteredTickets.length === 0 ? (
              <tr><td colSpan="9" className="text-center text-muted">Список пуст</td></tr>
            ) : filteredTickets.map(ticket => (
              <tr key={ticket.id} className={ticket.status === 'Выполнено' ? 'table-success' : ''}>
                <td>{ticket.date ? new Date(ticket.date).toLocaleDateString('ru-RU') : ''}</td>
                <td>{ticket.address}</td>
                <td>{ticket.fullName}</td>
                <td>{ticket.position}</td>
                <td>{ticket.contact}</td>
                <td>{ticket.description}</td>
                <td>
                  <select
                    className="form-select"
                    style={{ minWidth: 130, maxWidth: 180 }} // увеличено
                    value={ticket.status}
                    onChange={e => handleStatusChange(ticket.id, e.target.value)}
                    disabled={ticket.status === 'Выполнено'}
                  >
                    <option value="Не назначено">Не назначено</option>
                    <option value="В работе">В работе</option>
                    <option value="Выполнено">Выполнено</option>
                  </select>
                </td>
                <td>
                  <select
                    className="form-select"
                    style={{
                      minWidth: 150,
                      maxWidth: 220,
                      border: ticket.engineerId === currentUserId ? '2px solid #0d6efd' : undefined,
                      background: ticket.engineerId === currentUserId ? '#eaf4ff' : undefined,
                      fontWeight: ticket.engineerId === currentUserId ? 'bold' : undefined
                    }}
                    value={ticket.engineerId || ''}
                    onChange={e => handleAssign(ticket.id, e.target.value)}
                    disabled={ticket.status === 'Выполнено'}
                  >
                    <option value="">Не назначено</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.lastName} {u.firstName}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button className="btn btn-primary btn-sm me-2" onClick={() => handleCreateReport(ticket)} disabled={ticket.status === 'Выполнено'}>
                    Создать отчет
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ticket.id)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default InnerTickets;