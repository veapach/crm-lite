import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Inventory() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [showBought, setShowBought] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [editQtyId, setEditQtyId] = useState(null);
  const [editQtyValue, setEditQtyValue] = useState(1);
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.trim() || newQty < 1) return;
    try {
      await axios.post('/api/inventory', { item: newItem, quantity: newQty });
      setNewItem('');
      setNewQty(1);
      fetchItems();
    } catch (e) {
      setError('Ошибка при добавлении');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этот элемент?')) return;
    try {
      await axios.delete(`/api/inventory/${id}`);
      fetchItems();
    } catch (e) {
      setError('Ошибка при удалении');
    }
  };

  const handleEdit = (id, value, qty) => {
    setEditId(id);
    setEditValue(value);
    setEditQtyId(id);
    setEditQtyValue(qty);
  };

  const handleEditSave = async (id) => {
    if (!editValue.trim() || editQtyValue < 1) return;
    try {
      await axios.put(`/api/inventory/${id}`, { item: editValue, quantity: editQtyValue });
      setEditId(null);
      setEditValue('');
      setEditQtyId(null);
      setEditQtyValue(1);
      fetchItems();
    } catch (e) {
      setError('Ошибка при редактировании');
    }
  };

  const handleBought = async (id) => {
    try {
      await axios.put(`/api/inventory/${id}`, { status: 'Куплено' });
      fetchItems();
    } catch (e) {
      setError('Ошибка при обновлении статуса');
    }
  };

  return (
    <div className="container mt-5 mb-5">
      <h2>Список покупок</h2>
      <form className="d-flex mb-3" onSubmit={handleAdd}>
        <input
          type="text"
          className="form-control me-2"
          placeholder="Добавить покупку..."
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
        />
        <input
          type="number"
          min={1}
          className="form-control me-2"
          style={{ maxWidth: 100 }}
          value={newQty}
          onChange={e => setNewQty(Number(e.target.value))}
        />
        <button className="btn btn-primary" type="submit">Добавить</button>
      </form>
      <div className="form-check mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="showBought"
          checked={showBought}
          onChange={e => setShowBought(e.target.checked)}
        />
        <label className="form-check-label" htmlFor="showBought">
          Показать купленные
        </label>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <table className="table table-bordered align-middle">
          <thead>
            <tr>
              <th>Наименование</th>
              <th>Кол-во</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.filter(item => showBought ? item.status === 'Куплено' : item.status !== 'Куплено').length === 0 && (
              <tr><td colSpan="3" className="text-center text-muted">Список пуст</td></tr>
            )}
            {items.filter(item => showBought ? item.status === 'Куплено' : item.status !== 'Куплено').map(item => (
              <tr key={item.id} className={item.status === 'Куплено' ? 'table-success' : ''}>
                <td>
                  {editId === item.id ? (
                    <input
                      type="text"
                      className="form-control"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditSave(item.id); }}
                      autoFocus
                    />
                  ) : (
                    item.item
                  )}
                </td>
                <td style={{ maxWidth: 90 }}>
                  {editId === item.id ? (
                    <input
                      type="number"
                      min={1}
                      className="form-control"
                      value={editQtyValue}
                      onChange={e => setEditQtyValue(Number(e.target.value))}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditSave(item.id); }}
                    />
                  ) : (
                    item.quantity
                  )}
                </td>
                <td>{item.status}</td>
                <td>
                  {item.status !== 'Куплено' && (
                    <button className="btn btn-success btn-sm me-2" onClick={() => handleBought(item.id)}>Купил</button>
                  )}
                  {editId === item.id ? (
                    <>
                      <button className="btn btn-primary btn-sm me-2" onClick={() => handleEditSave(item.id)}>Сохранить</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>Отмена</button>
                    </>
                  ) : (
                    <button className="btn btn-warning btn-sm me-2" onClick={() => handleEdit(item.id, item.item, item.quantity)}>Редактировать</button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Inventory;
