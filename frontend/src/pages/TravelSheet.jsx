import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FaChevronDown } from 'react-icons/fa';
import '../styles/TravelSheet.css';

function TravelSheet() {
  const [travelRecords, setTravelRecords] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [filteredStartAddresses, setFilteredStartAddresses] = useState([]);
  const [filteredEndAddresses, setFilteredEndAddresses] = useState([]);
  const [showStartAddressSuggestions, setShowStartAddressSuggestions] = useState(false);
  const [showEndAddressSuggestions, setShowEndAddressSuggestions] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dailyStats, setDailyStats] = useState({ total: 0, count: 0 });
  const [monthlyStats, setMonthlyStats] = useState({ total: 0, count: 0 });
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    startPoint: '',
    endPoint: '',
    distance: ''
  });

  const addressInputRef = useRef(null);

  useEffect(() => {
    fetchAddresses();
    fetchTravelRecords();
    fetchStats();
  }, [selectedDate, selectedMonth]);

  const fetchAddresses = async () => {
    try {
      const response = await axios.get('/api/addresses');
      setAddresses(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке адресов:', error);
    }
  };

  const fetchTravelRecords = async () => {
    try {
      const response = await axios.get('/api/travel-sheet');
      setTravelRecords(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке путевого листа:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const [dailyResponse, monthlyResponse] = await Promise.all([
        axios.get(`/api/travel-sheet/stats/daily?date=${selectedDate}`),
        axios.get(`/api/travel-sheet/stats/monthly?month=${selectedMonth}`)
      ]);
      
      setDailyStats(dailyResponse.data);
      setMonthlyStats(monthlyResponse.data);
    } catch (error) {
      console.error('Ошибка при загрузке статистики:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'startPoint') {
      if (value.trim() === '') {
        setFilteredStartAddresses([]);
        setShowStartAddressSuggestions(false);
      } else {
        const filtered = addresses
          .filter(addr => (addr.address || '').toLowerCase().includes(value.toLowerCase()))
          .map(addr => addr.address);
        setFilteredStartAddresses(filtered);
        setShowStartAddressSuggestions(filtered.length > 0);
      }
    }
    
    if (name === 'endPoint') {
      if (value.trim() === '') {
        setFilteredEndAddresses([]);
        setShowEndAddressSuggestions(false);
      } else {
        const filtered = addresses
          .filter(addr => (addr.address || '').toLowerCase().includes(value.toLowerCase()))
          .map(addr => addr.address);
        setFilteredEndAddresses(filtered);
        setShowEndAddressSuggestions(filtered.length > 0);
      }
    }
  };

  const handleAddressSelect = (address, field) => {
    setFormData(prev => ({ ...prev, [field]: address }));
    if (field === 'startPoint') {
      setShowStartAddressSuggestions(false);
    } else {
      setShowEndAddressSuggestions(false);
    }
  };

  const toggleAddressList = (field) => {
    if (field === 'startPoint') {
      if (showStartAddressSuggestions) {
        setShowStartAddressSuggestions(false);
      } else {
        setFilteredStartAddresses(addresses.map(addr => addr.address));
        setShowStartAddressSuggestions(true);
      }
    } else {
      if (showEndAddressSuggestions) {
        setShowEndAddressSuggestions(false);
      } else {
        setFilteredEndAddresses(addresses.map(addr => addr.address));
        setShowEndAddressSuggestions(true);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!formData.date || !formData.startPoint || !formData.endPoint || !formData.distance) {
        setError('Все поля обязательны для заполнения');
        return;
      }

      const distance = parseFloat(formData.distance);
      if (isNaN(distance) || distance <= 0) {
        setError('Километраж должен быть положительным числом');
        return;
      }

      await axios.post('/api/travel-sheet', formData);
      
      setSuccess('Запись успешно добавлена');
      setFormData({
        date: new Date().toISOString().split('T')[0],
        startPoint: '',
        endPoint: '',
        distance: ''
      });
      setShowForm(false);
      
      fetchTravelRecords();
      fetchStats();
    } catch (error) {
      setError(error.response?.data?.error || 'Ошибка при добавлении записи');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить эту запись?')) {
      try {
        await axios.delete(`/api/travel-sheet/${id}`);
        fetchTravelRecords();
        fetchStats();
        setSuccess('Запись успешно удалена');
      } catch (error) {
        setError('Ошибка при удалении записи');
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedRecords = () => {
    const sorted = [...travelRecords].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'startPoint':
          aValue = a.startPoint.toLowerCase();
          bValue = b.startPoint.toLowerCase();
          break;
        case 'endPoint':
          aValue = a.endPoint.toLowerCase();
          bValue = b.endPoint.toLowerCase();
          break;
        case 'distance':
          aValue = parseFloat(a.distance);
          bValue = parseFloat(b.distance);
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="travel-sheet-container">
      <div className="travel-sheet-header">
        <h2>Путевой лист</h2>
        <button 
          className="btn btn-primary add-record-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Отмена' : 'Добавить запись'}
        </button>
      </div>

      <div className="stats-container">
        <div className="stat-item">
          <label>Километраж за день:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="form-control"
          />
          <div className="stat-value">
            {dailyStats.total} км ({dailyStats.count} записей)
          </div>
        </div>
        <div className="stat-item">
          <label>Километраж за месяц:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="form-control"
          />
          <div className="stat-value">
            {monthlyStats.total} км ({monthlyStats.count} записей)
          </div>
        </div>
      </div>

      {showForm && (
        <div className="add-record-form">
          <h3>Добавить новую запись</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Дата:</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>
              <div className="form-group">
                <label>Километраж:</label>
                <input
                  type="number"
                  name="distance"
                  value={formData.distance}
                  onChange={handleChange}
                  className="form-control"
                  placeholder="0.0"
                  step="0.1"
                  min="0"
                  required
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group address-group">
                <label>Начальная точка:</label>
                <div className="address-input-container">
                  <input
                    type="text"
                    name="startPoint"
                    value={formData.startPoint}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="Введите адрес или выберите из списка"
                    required
                  />
                  <button
                    type="button"
                    className="address-dropdown-btn"
                    onClick={() => toggleAddressList('startPoint')}
                  >
                    <FaChevronDown />
                  </button>
                </div>
                {showStartAddressSuggestions && (
                  <div className="address-suggestions">
                    {filteredStartAddresses.map((address, index) => (
                      <div
                        key={index}
                        className="address-suggestion"
                        onClick={() => handleAddressSelect(address, 'startPoint')}
                      >
                        {address}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="form-group address-group">
                <label>Конечная точка:</label>
                <div className="address-input-container">
                  <input
                    type="text"
                    name="endPoint"
                    value={formData.endPoint}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="Введите адрес или выберите из списка"
                    required
                  />
                  <button
                    type="button"
                    className="address-dropdown-btn"
                    onClick={() => toggleAddressList('endPoint')}
                  >
                    <FaChevronDown />
                  </button>
                </div>
                {showEndAddressSuggestions && (
                  <div className="address-suggestions">
                    {filteredEndAddresses.map((address, index) => (
                      <div
                        key={index}
                        className="address-suggestion"
                        onClick={() => handleAddressSelect(address, 'endPoint')}
                      >
                        {address}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-success" disabled={isLoading}>
                {isLoading ? 'Добавление...' : 'Добавить'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="table-container">
        <table className="table table-striped">
          <thead>
            <tr>
              <th 
                className="sortable-header"
                onClick={() => handleSort('date')}
              >
                Дата {getSortIcon('date')}
              </th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('startPoint')}
              >
                Начальная точка {getSortIcon('startPoint')}
              </th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('endPoint')}
              >
                Конечная точка {getSortIcon('endPoint')}
              </th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('distance')}
              >
                Километраж {getSortIcon('distance')}
              </th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {travelRecords.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center">Записей не найдено</td>
              </tr>
            ) : (
              getSortedRecords().map((record) => (
                <tr key={record.id}>
                  <td>{formatDate(record.date)}</td>
                  <td>{record.startPoint}</td>
                  <td>{record.endPoint}</td>
                  <td>{record.distance} км</td>
                  <td>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(record.id)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TravelSheet; 