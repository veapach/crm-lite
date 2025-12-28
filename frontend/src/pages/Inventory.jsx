import React, { useState, useEffect, useRef } from 'react';
import '../styles/Schedule.css';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Inventory() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [showInstalled, setShowInstalled] = useState(false);
  const [newObjectNumber, setNewObjectNumber] = useState('');
  const [newZipName, setNewZipName] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [editId, setEditId] = useState(null);
  const [editObjectNumber, setEditObjectNumber] = useState('');
  const [editZipName, setEditZipName] = useState('');
  const [editQty, setEditQty] = useState(1);
  const [editStatus, setEditStatus] = useState('заказан');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- Address autocomplete states ---
  const [addresses, setAddresses] = useState([]);
  const [filteredAddresses, setFilteredAddresses] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressInputRef = useRef(null);

  // Fetch addresses for autocomplete
  useEffect(() => {
    fetchItems();
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const response = await axios.get('/api/addresses');
      setAddresses(response.data);
    } catch (error) {
      // ignore
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/inventory');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError('Ошибка при загрузке списка');
    } finally {
      setLoading(false);
    }
  };

  // --- Address autocomplete handlers ---
  const handleObjectNumberChange = (e) => {
    const value = e.target.value;
    setNewObjectNumber(value);
    if (value.trim() === '') {
      setFilteredAddresses([]);
      setShowAddressSuggestions(false);
    } else {
      const filtered = addresses
        .filter(addr => (addr.address || '').toLowerCase().includes(value.toLowerCase()))
        .map(addr => addr.address);
      setFilteredAddresses(filtered);
      setShowAddressSuggestions(filtered.length > 0);
    }
  };

  const handleAddressSelect = (address) => {
    setNewObjectNumber(address);
    setShowAddressSuggestions(false);
    if (addressInputRef.current) addressInputRef.current.blur();
  };

  const toggleAddressList = () => {
    if (showAddressSuggestions) {
      setShowAddressSuggestions(false);
    } else {
      setFilteredAddresses(addresses.map(addr => addr.address));
      setShowAddressSuggestions(true);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newObjectNumber.trim() || !newZipName.trim() || newQty < 1) return;
    try {
      await axios.post('/api/inventory', {
        objectNumber: newObjectNumber,
        zipName: newZipName,
        quantity: newQty,
        status: 'не куплено'
      });
      setNewObjectNumber('');
      setNewZipName('');
      setNewQty(1);
      fetchItems();
    } catch (e) {
      setError('Ошибка при добавлении');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этот ЗИП?')) return;
    try {
      await axios.delete(`/api/inventory/${id}`);
      fetchItems();
    } catch (e) {
      setError('Ошибка при удалении');
    }
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    setEditObjectNumber(item.objectNumber);
    setEditZipName(item.zipName);
    setEditQty(item.quantity);
    setEditStatus(item.status);
  };

  const handleEditSave = async (id) => {
    if (!editObjectNumber.trim() || !editZipName.trim() || editQty < 1) return;
    try {
      await axios.put(`/api/inventory/${id}`, {
        objectNumber: editObjectNumber,
        zipName: editZipName,
        quantity: editQty,
        status: editStatus
      });
      setEditId(null);
      setEditObjectNumber('');
      setEditZipName('');
      setEditQty(1);
      setEditStatus('заказан');
      fetchItems();
    } catch (e) {
      setError('Ошибка при редактировании');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await axios.put(`/api/inventory/${id}`, { status });
      fetchItems();
    } catch (e) {
      setError('Ошибка при обновлении статуса');
    }
  };

  return (
    <div className="container mt-5 mb-5">
      <h2>Список ЗИП</h2>
      <form className="d-flex mb-3 flex-wrap gap-2 position-relative" onSubmit={handleAdd} style={{ zIndex: 2 }}>
        <div style={{ position: 'relative', maxWidth: 320, flex: '1 1 320px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Номер объекта (адрес)"
            value={newObjectNumber}
            onChange={handleObjectNumberChange}
            style={{ maxWidth: 320, paddingRight: 34 }}
            ref={addressInputRef}
            autoComplete="off"
          />
          <button
            type="button"
            className="btn btn-outline-secondary"
            style={{
              position: 'absolute',
              top: '50%',
              right: 6,
              transform: 'translateY(-50%)',
              height: 28,
              width: 28,
              minWidth: 0,
              padding: 0,
              borderRadius: 4,
              fontSize: 16,
              zIndex: 2,
              lineHeight: 1
            }}
            tabIndex={-1}
            onClick={toggleAddressList}
            title="Показать все адреса"
          >
            ▼
          </button>
          {showAddressSuggestions && (
            <div className="position-absolute w-100 mt-1 border rounded shadow-sm dropdown-suggestions" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
              {filteredAddresses.length > 0 ? (
                filteredAddresses.map((address, index) => (
                  <div
                    key={index}
                    className="p-2 border-bottom cursor-pointer dropdown-suggestion-item"
                    onClick={() => handleAddressSelect(address)}
                    style={{ cursor: 'pointer' }}
                  >
                    {address}
                  </div>
                ))
              ) : (
                <div className="p-2 text-muted">Нет подходящих адресов</div>
              )}
            </div>
          )}
        </div>
        <input
          type="text"
          className="form-control"
          placeholder="Наименование ЗИП"
          value={newZipName}
          onChange={e => setNewZipName(e.target.value)}
          style={{ maxWidth: 220, flex: '1 1 220px' }}
        />
        <input
          type="number"
          min={1}
          className="form-control"
          style={{ maxWidth: 100, flex: '1 1 100px' }}
          value={newQty}
          onChange={e => setNewQty(Number(e.target.value))}
        />
        <button className="btn btn-primary" type="submit" style={{ minWidth: 110, fontWeight: 500, fontSize: 16 }}>Добавить</button>
      </form>
      <div className="form-check mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="showInstalled"
          checked={showInstalled}
          onChange={(e) => setShowInstalled(e.target.checked)}
        />
        <label className="form-check-label" htmlFor="showInstalled">
          Показать установленные ЗИП
        </label>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="schedule-table-wrapper">
        <table className="table table-bordered table-striped">
          <thead className="table-light">
            <tr>
              <th>Номер объекта (адрес)</th>
              <th>Наименование ЗИП</th>
              <th>Количество</th>
              <th>Статус</th>
              <th style={{ width: 100 }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.filter(item => showInstalled ? item.status === 'установлен' : item.status !== 'установлен').length === 0 && (
              <tr><td colSpan="5" className="text-center text-muted">Список пуст</td></tr>
            )}
            {items.filter(item => showInstalled ? item.status === 'установлен' : item.status !== 'установлен').map(item => (
              <tr key={item.id} className={item.status === 'установлен' ? 'table-success' : ''}>
                <td>
                  {editId === item.id ? (
                    <input
                      type="text"
                      className="form-control"
                      value={editObjectNumber}
                      onChange={e => setEditObjectNumber(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    item.objectNumber
                  )}
                </td>
                <td>
                  {editId === item.id ? (
                    <input
                      type="text"
                      className="form-control"
                      value={editZipName}
                      onChange={e => setEditZipName(e.target.value)}
                    />
                  ) : (
                    item.zipName
                  )}
                </td>
                <td style={{ maxWidth: 90 }}>
                  {editId === item.id ? (
                    <input
                      type="number"
                      min={1}
                      className="form-control"
                      value={editQty}
                      onChange={e => setEditQty(Number(e.target.value))}
                    />
                  ) : (
                    item.quantity
                  )}
                </td>
                <td>
                  {editId === item.id ? (
                    <select className="form-select" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                      <option value="не куплено">не куплено</option>
                      <option value="заказан">заказан</option>
                      <option value="установлен">установлен</option>
                    </select>
                  ) : (
                    item.status
                  )}
                </td>
                <td>
                  {editId === item.id ? (
                    <>
                      <button className="btn btn-primary btn-sm me-2" style={{ minWidth: 110, fontWeight: 500, fontSize: 15 }} onClick={() => handleEditSave(item.id)}>Сохранить</button>
                      <button className="btn btn-secondary btn-sm" style={{ minWidth: 110, fontWeight: 500, fontSize: 15 }} onClick={() => setEditId(null)}>Отмена</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-warning btn-sm me-2" style={{ minWidth: 110, fontWeight: 500, fontSize: 15 }} onClick={() => handleEdit(item)}>Редактировать</button>
                      <button className="btn btn-danger btn-sm" style={{ minWidth: 110, fontWeight: 500, fontSize: 15 }} onClick={() => handleDelete(item.id)}>Удалить</button>
                      {item.status === 'не куплено' && (
                        <button className="btn btn-primary btn-sm ms-2" style={{ minWidth: 110, fontWeight: 500, fontSize: 15 }} onClick={() => handleStatusChange(item.id, 'заказан')}>Купил</button>
                      )}
                      {item.status === 'заказан' && (
                        <button className="btn btn-success btn-sm ms-2" style={{ minWidth: 110, fontWeight: 500, fontSize: 15 }} onClick={() => handleStatusChange(item.id, 'установлен')}>Установлен</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editId !== null && (
        <div className="position-fixed top-0 start-50 translate-middle-x border rounded shadow-lg p-4 edit-modal-popup" style={{ zIndex: 1050, maxWidth: 400, width: '100%' }}>
          <h5 className="mb-3">Редактировать ЗИП</h5>
          <div className="mb-3">
            <label className="form-label">Номер объекта (адрес)</label>
            <input
              type="text"
              className="form-control"
              value={editObjectNumber}
              onChange={(e) => setEditObjectNumber(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Наименование ЗИП</label>
            <input
              type="text"
              className="form-control"
              value={editZipName}
              onChange={(e) => setEditZipName(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Количество</label>
            <input
              type="number"
              className="form-control"
              value={editQty}
              onChange={(e) => setEditQty(Math.max(1, e.target.value))}
              min="1"
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Статус</label>
            <select
              className="form-select"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            >
              <option value="заказан">Заказан</option>
              <option value="установлен">Установлен</option>
              <option value="не куплено">Не куплено</option>
            </select>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button className="btn btn-secondary" onClick={() => setEditId(null)}>
              Отмена
            </button>
            <button className="btn btn-primary" onClick={() => handleEditSave(editId)} disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventory;
