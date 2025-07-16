import React, { useEffect, useState } from 'react';
import axios from 'axios';

function InnerTickets() {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(false);

  // Получить заявки и пользователей
  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      try {
        const params = {
          status: showCompleted ? undefined : 'not-completed',
          filterStatus,
          filterMonth,
          search,
          sort: sortOrder,
        };
        const res = await axios.get('/api/client-tickets', { params });
        setTickets(res.data || []);
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

    fetchTickets();
    fetchUsers();
  }, [showCompleted, filterStatus, filterMonth, search, sortOrder]);

  const handleAssign = async (ticketId, userId) => {
    await axios.put(`/api/client-tickets/${ticketId}`, { engineerId: userId, status: 'В работе' });
    // fetchTickets is now inline, so trigger reload by updating a filter state
    setSearch(s => s); // triggers useEffect
  };

  const handleStatusChange = async (ticketId, status) => {
    await axios.put(`/api/client-tickets/${ticketId}`, { status });
    setSearch(s => s);
  };

  const handleDelete = async (ticketId) => {
    if (window.confirm('Удалить заявку?')) {
      await axios.delete(`/api/client-tickets/${ticketId}`);
      setSearch(s => s);
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

  return (
    <div className="container mt-5 mb-5">
      <h2>Входящие заявки от клиентов</h2>
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