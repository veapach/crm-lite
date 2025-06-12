import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../styles/Admin.css';

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('addresses');
  
  // Состояния для раздела адресов
  const [addresses, setAddresses] = useState([]);
  const [newAddress, setNewAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Состояния для раздела пользователей
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newPhone, setNewPhone] = useState('');
  const [allowedPhones, setAllowedPhones] = useState([]);
  
  // Состояния для раздела оборудования
  const [equipment, setEquipment] = useState([]);
  const [newEquipment, setNewEquipment] = useState('');
  const [equipmentSearchQuery, setEquipmentSearchQuery] = useState('');

  // Состояния для раздела загрузки отчетов
  const [reportFile, setReportFile] = useState(null);
  const [reportDate, setReportDate] = useState('');
  const [reportAddress, setReportAddress] = useState('');
  const [reportUser, setReportUser] = useState('');
  // Функции для работы с оборудованием
  const fetchEquipment = useCallback(async () => {
    try {
      const response = await axios.get('/api/equipment', {
        params: { query: equipmentSearchQuery }
      });
      setEquipment(response.data);
    } catch (error) {
      toast.error('Ошибка при загрузке оборудования');
    }
  }, [equipmentSearchQuery]);

  const addEquipment = async () => {
    if (!newEquipment.trim()) {
      toast.warning('Введите название оборудования');
      return;
    }
    try {
      await axios.post('/api/equipment', { name: newEquipment });
      toast.success('Оборудование успешно добавлено');
      setNewEquipment('');
      fetchEquipment();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка при добавлении оборудования');
    }
  };

  const deleteEquipment = async (id) => {
    try {
      await axios.delete(`/api/equipment/${id}`);
      toast.success('Оборудование успешно удалено');
      fetchEquipment();
    } catch (error) {
      toast.error('Ошибка при удалении оборудования');
    }
  };
  
  // Функции для работы с адресами
  const fetchAddresses = useCallback(async () => {
    try {
      const response = await axios.get('/api/addresses', {
        params: { query: searchQuery }
      });
      setAddresses(response.data);
    } catch (error) {
      toast.error('Ошибка при загрузке адресов');
    }
  }, [searchQuery]);
  
  // Функции для работы с пользователями
  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      toast.error('Ошибка при загрузке пользователей');
    }
  }, []);
  
  const fetchAllowedPhones = useCallback(async () => {
    try {
      const response = await axios.get('/api/allowed-phones');
      setAllowedPhones(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке разрешенных телефонов:', error);
    }
  }, []);
  
  useEffect(() => {
    // Проверка прав доступа
    if (user && user.department !== 'Админ') {
      toast.error('У вас нет прав доступа к этой странице');
      navigate('/');
      return;
    }
    // Загрузка данных при монтировании компонента
    fetchAddresses();
    fetchUsers();
    fetchAllowedPhones();
    fetchEquipment();
  }, [user, navigate, fetchAddresses, fetchUsers, fetchAllowedPhones, fetchEquipment]);
  
  const addAddress = async () => {
    if (!newAddress.trim()) {
      toast.warning('Введите адрес');
      return;
    }
    
    try {
      await axios.post('/api/addresses', { address: newAddress });
      toast.success('Адрес успешно добавлен');
      setNewAddress('');
      fetchAddresses();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка при добавлении адреса');
    }
  };
  
  const deleteAddress = async (id) => {
    try {
      await axios.delete(`/api/addresses/${id}`);
      toast.success('Адрес успешно удален');
      fetchAddresses();
    } catch (error) {
      toast.error('Ошибка при удалении адреса');
    }
  };
  
  const updateUser = async (userId, userData) => {
    try {
      await axios.put(`/api/users/${userId}`, userData);
      toast.success('Пользователь успешно обновлен');
      fetchUsers();
      setEditingUser(null);
    } catch (error) {
      toast.error('Ошибка при обновлении пользователя');
    }
  };
  
  const deleteUser = async (userId) => {
    if (window.confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      try {
        await axios.delete(`/api/users/${userId}`);
        toast.success('Пользователь успешно удален');
        fetchUsers();
      } catch (error) {
        toast.error('Ошибка при удалении пользователя');
      }
    }
  };
  
  const addAllowedPhone = async () => {
    if (!newPhone.trim()) {
      toast.warning('Введите номер телефона');
      return;
    }
    
    try {
      await axios.post('/api/allowed-phones', { phone: newPhone });
      toast.success('Телефон успешно добавлен в список разрешенных');
      setNewPhone('');
      fetchAllowedPhones();
    } catch (error) {
      toast.error('Ошибка при добавлении телефона');
    }
  };
  
  const removeAllowedPhone = async (phone) => {
    try {
      await axios.delete(`/api/allowed-phones/${phone}`);
      toast.success('Телефон успешно удален из списка разрешенных');
      fetchAllowedPhones();
    } catch (error) {
      toast.error('Ошибка при удалении телефона');
    }
  };
  
  // Функции для работы с загрузкой отчетов
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setReportFile(file);
    
    if (file) {
      // Пытаемся извлечь дату и адрес из имени файла
      // Формат: "Акт выполненных работ ГГГГ-ММ-ДД АДРЕС.docx"
      const fileName = file.name;
      const match = fileName.match(/Акт выполненных работ (\d{4}-\d{2}-\d{2}) (.+)\./i);
      
      if (match && match.length >= 3) {
        const extractedDate = match[1];
        const extractedAddress = match[2];
        
        setReportDate(extractedDate);
        setReportAddress(extractedAddress);
      }
    }
  };
  
  const uploadReport = async (e) => {
    e.preventDefault();
    
    if (!reportFile || !reportDate || !reportAddress || !reportUser) {
      toast.warning('Заполните все поля');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', reportFile);
    formData.append('date', reportDate);
    formData.append('address', reportAddress);
    formData.append('userId', reportUser);
    
    try {
      await axios.post('/api/reports/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Отчет успешно загружен');
      setReportFile(null);
      setReportDate('');
      setReportAddress('');
      setReportUser('');
      // Сбросить input file
      document.getElementById('report-file').value = '';
    } catch (error) {
      toast.error('Ошибка при загрузке отчета: ' + (error.response?.data?.error || error.message));
    }
  };
  
  // Если пользователь не авторизован или не админ, не рендерим страницу
  if (!user || user.department !== 'Админ') {
    return null;
  }
  
  return (
    <div className="admin-container">
      <h1>Панель администратора</h1>
      
      <div className="admin-tabs">
        <button 
          className={activeTab === 'addresses' ? 'active' : ''} 
          onClick={() => setActiveTab('addresses')}
        >
          Адреса
        </button>
        <button 
          className={activeTab === 'equipment' ? 'active' : ''} 
          onClick={() => setActiveTab('equipment')}
        >
          Оборудование
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''} 
          onClick={() => setActiveTab('users')}
        >
          Пользователи
        </button>
        <button 
          className={activeTab === 'reports' ? 'active' : ''} 
          onClick={() => setActiveTab('reports')}
        >
          Загрузка отчетов
        </button>
      </div>
        {/* Раздел управления оборудованием */}
        {activeTab === 'equipment' && (
          <div className="equipment-section">
            <h2>Управление оборудованием</h2>
            <div className="equipment-controls">
              <div className="equipment-add">
                <input
                  type="text"
                  value={newEquipment}
                  onChange={e => setNewEquipment(e.target.value)}
                  placeholder="Новое оборудование"
                />
                <button onClick={addEquipment}>Добавить</button>
              </div>
              <div className="equipment-search">
                <input
                  type="text"
                  value={equipmentSearchQuery}
                  onChange={e => setEquipmentSearchQuery(e.target.value)}
                  placeholder="Поиск оборудования"
                />
                <button onClick={fetchEquipment}>Найти</button>
              </div>
            </div>
            <div className="equipment-list">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Название</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map(eq => (
                    <tr key={eq.id}>
                      <td>{eq.id}</td>
                      <td>{eq.name}</td>
                      <td>
                        <button
                          className="delete-btn"
                          onClick={() => deleteEquipment(eq.id)}
                        >
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
      
      <div className="admin-content">
        {/* Раздел управления адресами */}
        {activeTab === 'addresses' && (
          <div className="addresses-section">
            <h2>Управление адресами</h2>
            
            <div className="address-controls">
              <div className="address-add">
                <input 
                  type="text" 
                  value={newAddress} 
                  onChange={(e) => setNewAddress(e.target.value)} 
                  placeholder="Новый адрес" 
                />
                <button onClick={addAddress}>Добавить</button>
              </div>
              
              <div className="address-search">
                <input 
                  type="text" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  placeholder="Поиск адресов" 
                />
                <button onClick={fetchAddresses}>Найти</button>
              </div>
            </div>
            
            <div className="addresses-list">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Адрес</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {addresses.map(address => (
                    <tr key={address.id}>
                      <td>{address.id}</td>
                      <td>{address.address}</td>
                      <td>
                        <button 
                          className="delete-btn" 
                          onClick={() => deleteAddress(address.id)}
                        >
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
        
        {/* Раздел управления пользователями */}
        {activeTab === 'users' && (
          <div className="users-section">
            <h2>Управление пользователями</h2>
            
            <div className="allowed-phones">
              <h3>Разрешенные телефоны</h3>
              <div className="phone-add">
                <input 
                  type="text" 
                  value={newPhone} 
                  onChange={(e) => setNewPhone(e.target.value)} 
                  placeholder="Новый телефон" 
                />
                <button onClick={addAllowedPhone}>Добавить</button>
              </div>
              
              <div className="phones-list">
                <ul>
                  {allowedPhones.map(phone => (
                    <li key={phone}>
                      {phone}
                      <button 
                        className="delete-btn" 
                        onClick={() => removeAllowedPhone(phone)}
                      >
                        Удалить
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="users-list">
              <h3>Список пользователей</h3>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Имя</th>
                    <th>Фамилия</th>
                    <th>Отдел</th>
                    <th>Телефон</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>
                        {editingUser === user.id ? (
                          <input 
                            type="text" 
                            defaultValue={user.firstName} 
                            id={`firstName-${user.id}`} 
                          />
                        ) : (
                          user.firstName
                        )}
                      </td>
                      <td>
                        {editingUser === user.id ? (
                          <input 
                            type="text" 
                            defaultValue={user.lastName} 
                            id={`lastName-${user.id}`} 
                          />
                        ) : (
                          user.lastName
                        )}
                      </td>
                      <td>
                        {editingUser === user.id ? (
                          <input 
                            type="text" 
                            defaultValue={user.department} 
                            id={`department-${user.id}`} 
                          />
                        ) : (
                          user.department
                        )}
                      </td>
                      <td>{user.phone}</td>
                      <td>
                        {editingUser === user.id ? (
                          <>
                            <button 
                              className="save-btn" 
                              onClick={() => updateUser(user.id, {
                                firstName: document.getElementById(`firstName-${user.id}`).value,
                                lastName: document.getElementById(`lastName-${user.id}`).value,
                                department: document.getElementById(`department-${user.id}`).value
                              })}
                            >
                              Сохранить
                            </button>
                            <button 
                              className="cancel-btn" 
                              onClick={() => setEditingUser(null)}
                            >
                              Отмена
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              className="edit-btn" 
                              onClick={() => setEditingUser(user.id)}
                            >
                              Редактировать
                            </button>
                            <button 
                              className="delete-btn" 
                              onClick={() => deleteUser(user.id)}
                            >
                              Удалить
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Раздел загрузки отчетов */}
        {activeTab === 'reports' && (
          <div className="reports-section">
            <h2>Загрузка готовых отчетов</h2>
            
            <form onSubmit={uploadReport} className="report-upload-form">
              <div className="form-group">
                <label htmlFor="report-file">Файл отчета:</label>
                <input 
                  type="file" 
                  id="report-file" 
                  onChange={handleFileChange} 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="report-date">Дата:</label>
                <input 
                  type="date" 
                  id="report-date" 
                  value={reportDate} 
                  onChange={(e) => setReportDate(e.target.value)} 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="report-address">Адрес:</label>
                <div className="address-input-container">
                  <input
                    type="text"
                    id="report-address"
                    value={reportAddress}
                    onChange={(e) => setReportAddress(e.target.value)}
                    placeholder="Введите адрес или выберите из списка"
                    required
                  />
                  <select
                    onChange={(e) => {
                      if (e.target.value) setReportAddress(e.target.value);
                    }}
                    value=""
                  >
                    <option value="">-- Выберите из списка --</option>
                    {addresses.map(address => (
                      <option key={address.id} value={address.address}>
                        {address.address}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="report-user">Пользователь:</label>
                <select 
                  id="report-user" 
                  value={reportUser} 
                  onChange={(e) => setReportUser(e.target.value)} 
                  required
                >
                  <option value="">Выберите пользователя</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.lastName} {user.firstName}
                    </option>
                  ))}
                </select>
              </div>
              
              <button type="submit" className="upload-btn">Загрузить отчет</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin; 