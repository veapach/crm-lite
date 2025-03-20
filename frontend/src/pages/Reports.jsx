import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { renderAsync } from 'docx-preview';
import { Modal } from 'react-bootstrap';
import '../styles/Reports.css';

function Reports() {
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState({});
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showOnlyMine, setShowOnlyMine] = useState(true);
  const viewerRef = useRef(null);
  const [highlightedReportId, setHighlightedReportId] = useState(null);
  const [reportsStats, setReportsStats] = useState({ total: 0, month: 0 });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [isDateFiltered, setIsDateFiltered] = useState(false);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get('/api/users');
      const usersData = {};
      response.data.forEach(user => {
        usersData[user.id] = user;
      });
      setUsers(usersData);
    } catch (error) {
      console.error('Ошибка при загрузке пользователей', error);
    }
  }, []);

  const fetchReportsCount = useCallback(async () => {
    try {
      const response = await axios.get("/api/reportscount");
      setReportsStats(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке статистики отчетов', error);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      let url = `/api/reports?onlyMine=${showOnlyMine}`;
      if (isDateFiltered && dateRange.startDate && dateRange.endDate) {
        url += `&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      }
      const response = await axios.get(url);
      setReports(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке отчетов', error);
    }
  }, [showOnlyMine, isDateFiltered]);

  const getUserFullName = (userId) => {
    if (!users[userId]) return 'Неизвестный пользователь';
    return `${users[userId].lastName || ''} ${users[userId].firstName || ''}`.trim();
  };

  const handlePreviewClick = async (report) => {
    setSelectedReport(report);
    setShowPreview(true);
    try {
      const response = await axios.get(`uploads/reports/${report.filename}`, {
        responseType: 'arraybuffer',
      });
      const arrayBuffer = response.data;
      setTimeout(() => {
        renderAsync(arrayBuffer, viewerRef.current).catch(() => {
          setError('Произошла ошибка при рендеринге документа');
        });
      }, 100);
    } catch (error) {
      setError('Ошибка при загрузке файла');
    }
  };

  const handleDownload = async (filename) => {
    try {
      const response = await axios.get(`uploads/reports/${filename}`, {
        responseType: 'blob',
      });

      const fileName = filename.split('\\').pop().split('/').pop();

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError('Ошибка при скачивании файла');
    }
  };

  const handleDelete = async (filename) => {
    if (window.confirm('Вы уверены, что хотите удалить этот отчет?')) {
      try {
        await axios.delete(`/api/reports/${encodeURIComponent(filename)}`);
        fetchReports();
      } catch (error) {
        setError('Ошибка при удалении отчета');
        console.error('Ошибка при удалении отчета:', error);
      }
    }
  };

  const filteredReports = reports
    .filter(
      (report) => report.address.toLowerCase().includes(searchTerm.toLowerCase()) || report.date.includes(searchTerm)
    )
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  useEffect(() => {
    fetchReports();
    fetchUsers();
    fetchReportsCount();
  }, [fetchReports, fetchUsers, fetchReportsCount]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const highlightId = searchParams.get('highlight');
    if (highlightId) {
      setHighlightedReportId(Number(highlightId));
      setTimeout(() => {
        const element = document.getElementById(`report-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, []);

  return (
    <div className="container mt-5">
      <h1>Отчеты</h1>
      <div className="d-flex gap-4 mb-3">
        <h3>За текущий месяц: {reportsStats.month}</h3>
        <h3>Всего отчетов: {reportsStats.total}</h3>
      </div>
      {error && <p className="text-danger">{error}</p>}

      <div className="row">
        <div className="col-md-6">
          <input
            type="text"
            className="form-control"
            placeholder="Поиск по адресу или дате..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="col-md-3">
          <select className="form-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="desc">Сначала новые</option>
            <option value="asc">Сначала старые</option>
          </select>
        </div>
        <div className="col-md-3">
          {isDateFiltered ? (
            <button 
              className="btn btn-secondary w-100" 
              onClick={() => {
                setIsDateFiltered(false);
                setDateRange({ startDate: '', endDate: '' });
              }}
            >
              Назад
            </button>
          ) : (
            <div className="form-check mt-2">
              <input
                type="checkbox"
                className="form-check-input me-2"
                id="showOnlyMine"
                checked={showOnlyMine}
                onChange={(e) => setShowOnlyMine(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="showOnlyMine">
                Созданные вами отчеты
              </label>
            </div>
          )}
        </div>
        <div className="col-md-12 mt-3">
          {!isDateFiltered && (
            <button 
              className="btn btn-primary" 
              onClick={() => setShowDatePicker(true)}
            >
              Выбрать интервал
            </button>
          )}
        </div>
      </div>

      <hr className="my-4" style={{ backgroundColor: '#dee2e6', height: '2px' }} />

      <div className="row">
        {filteredReports.map((report) => (
          <div 
            key={report.id} 
            id={`report-${report.id}`}
            className={`col-md-4 mb-4 ${report.id === highlightedReportId ? 'highlight-card' : ''}`}
          >
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title">Объект: {report.address}</h5>
                <p className="card-text">Дата: {formatDate(report.date)}</p>
                <p className="card-text" style={{ fontSize: '0.9em', color: 'gray' }}>
                  {getUserFullName(report.userId || report.user_id)}
                </p>
                <div className="d-flex justify-content-between">
                  <button className="btn btn-primary" onClick={() => handlePreviewClick(report)}>
                    Предпросмотр
                  </button>
                  <button className="btn btn-success" onClick={() => handleDownload(report.filename)}>
                    Скачать
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDelete(report.filename)}>
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal show={showPreview} onHide={() => setShowPreview(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Предпросмотр отчета
            {selectedReport && (
              <button className="btn btn-success ms-3" onClick={() => handleDownload(selectedReport.filename)}>
              Скачать
              </button>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div
            ref={viewerRef}
            style={{
              border: '1px solid #ccc',
              padding: '16px',
              height: '70vh',
              overflow: 'auto',
            }}
          />
        </Modal.Body>
      </Modal>

      <Modal show={showDatePicker} onHide={() => setShowDatePicker(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Выберите интервал дат</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label">От:</label>
            <input
              type="date"
              className="form-control"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">До:</label>
            <input
              type="date"
              className="form-control"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowDatePicker(false)}
          >
            Отмена
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => {
              if (dateRange.startDate && dateRange.endDate) {
                setIsDateFiltered(true);
                setShowDatePicker(false);
                fetchReports();
              }
            }}
          >
            Выгрузить отчеты
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Reports;
