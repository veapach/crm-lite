import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { renderAsync } from 'docx-preview';
import { Modal } from 'react-bootstrap';
import '../styles/Reports.css';
import * as pdfjsLib from 'pdfjs-dist';

// Устанавливаем worker для PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
  const [classificationStats, setClassificationStats] = useState({ to: 0, av: 0, pnr: 0 });
  const [selectedReports, setSelectedReports] = useState([]);

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
      let url = "/api/reportscount";
      if (isDateFiltered && dateRange.startDate && dateRange.endDate) {
        url += `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      }
      const response = await axios.get(url);
      setReportsStats({
        total: response.data.total,
        month: response.data.month,
        filteredTotal: response.data.filteredTotal || 0,
        filteredMonth: response.data.filteredMonth || 0,
      });
      setClassificationStats({
        to: response.data.to,
        av: response.data.av,
        pnr: response.data.pnr,
        filteredTo: response.data.filteredTo || 0,
        filteredAv: response.data.filteredAv || 0,
        filteredPnr: response.data.filteredPnr || 0,
      });
    } catch (error) {
      console.error('Ошибка при загрузке статистики отчетов', error);
    }
  }, [isDateFiltered, dateRange.startDate, dateRange.endDate]);

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
  }, [showOnlyMine, isDateFiltered, dateRange.startDate, dateRange.endDate]);

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
      
      if (report.filename.toLowerCase().endsWith('.pdf')) {
        // Для PDF файлов
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        // Рендерим все страницы PDF вертикально
        const container = viewerRef.current;
        container.innerHTML = ''; // Очищаем контейнер

        // Определяем масштаб в зависимости от устройства
        const isMobile = window.innerWidth <= 768;
        const scale = isMobile ? 1.2 : 1.5; // Увеличиваем масштаб для мобильных с 0.8 до 1.0

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const canvas = document.createElement('canvas');
          container.appendChild(canvas);
          const page = await pdf.getPage(pageNum);
          
          // Определяем правильный масштаб для устройства
          let currentScale = scale;
          if (isMobile) {
            const containerWidth = container.clientWidth - 12; // Уменьшаем отступы с 32 до 20
            const defaultViewport = page.getViewport({ scale });
            const ratio = containerWidth / defaultViewport.width;
            currentScale = scale * ratio;
          }
          
          const viewport = page.getViewport({ scale: currentScale });
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          const context = canvas.getContext('2d');
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;

          // Добавляем отступ между страницами
          if (pageNum < pdf.numPages) {
            const spacer = document.createElement('div');
            spacer.style.height = '20px';
            container.appendChild(spacer);
          }
        }
      } else {
        // Для DOCX файлов используем существующий docx-preview
        setTimeout(() => {
          renderAsync(arrayBuffer, viewerRef.current).catch(() => {
            setError('Произошла ошибка при рендеринге документа');
          });
        }, 100);
      }
    } catch (error) {
      setError('Ошибка при загрузке документа');
      console.error('Ошибка при загрузке документа:', error);
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

  const handleDownloadMonthlyReports = async () => {
    try {
      const response = await axios.get('/api/reports/monthly-zip', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'monthly_reports.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError('Ошибка при скачивании архива отчетов');
      console.error('Ошибка при скачивании архива отчетов', error);
    }
  };

  const handleDownloadReportsByPeriod = async () => {
    try {
      const response = await axios.get(
        `/api/reports/period-zip?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        {
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'reports_by_period.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError('Ошибка при скачивании архива отчетов за период');
      console.error('Ошибка при скачивании архива отчетов за период:', error);
    }
  };

  const toggleReportSelection = (reportId) => {
    setSelectedReports((prev) =>
      prev.includes(reportId)
        ? prev.filter((id) => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleDownloadSelectedReports = async () => {
    if (selectedReports.length === 0) {
      alert('Выберите хотя бы один отчет для скачивания.');
      return;
    }

    try {
      const response = await axios.post('/api/reports/download-selected', {
        reportIds: selectedReports,
      }, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'selected_reports.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка при скачивании выбранных отчетов:', error);
    }
  };

  const filteredReports = reports
    .filter((report) => {
      if (isDateFiltered && dateRange.startDate && dateRange.endDate) {
        const reportDate = new Date(report.date);
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        return reportDate >= startDate && reportDate <= endDate;
      }
      return true;
    })
    .filter(
      (report) =>
        report.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.date.includes(searchTerm)
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
      <div className="d-flex gap-4 mb-3 align-items-center">
        {isDateFiltered ? (
          <h3>Всего за этот период: {reportsStats.filteredTotal}</h3>
        ) : (
          <>
            <h3>За текущий месяц: {reportsStats.month}</h3>
            <h3>Всего отчетов: {reportsStats.total}</h3>
          </>
        )}
        {isDateFiltered ? (
          <button className="btn btn-primary" onClick={handleDownloadReportsByPeriod}>
            Скачать за этот период
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleDownloadMonthlyReports}>
            Скачать за месяц
          </button>
        )}
      </div>
      <div style={{ fontSize: '0.9em', marginBottom: '1rem' }}>
        <span>ТО: {isDateFiltered ? classificationStats.filteredTo || 0 : classificationStats.to || 0} </span>
        <span>АВ: {isDateFiltered ? classificationStats.filteredAv || 0 : classificationStats.av || 0} </span>
        <span>ПНР: {isDateFiltered ? classificationStats.filteredPnr || 0 : classificationStats.pnr || 0}</span>
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
        <div className="col-md-12 mt-3 d-flex align-items-center">
          <button
            className="btn btn-primary me-3"
            onClick={() => setShowDatePicker(true)}
          >
            Выбрать интервал
          </button>
          <button
            className="btn btn-success"
            onClick={handleDownloadSelectedReports}
          >
            Скачать выбранное
          </button>
        </div>
      </div>

      <hr className="my-4" style={{ backgroundColor: '#dee2e6', height: '2px' }} />

      <div className="row">
        {filteredReports.map((report) => (
          <div 
            key={report.id} 
            id={`report-${report.id}`}
            className={`col-md-4 mb-4 ${report.id === highlightedReportId ? 'highlight-card' : ''} ${selectedReports.includes(report.id) ? 'selected' : ''}`}
          >
            <div 
              className={`card shadow-sm ${selectedReports.includes(report.id) ? 'border-primary' : ''}`}
              onClick={(e) => {
                if (!['BUTTON', 'INPUT'].includes(e.target.tagName)) {
                  toggleReportSelection(report.id);
                }
              }}
            >
              <div className="card-body position-relative">
                <input
                  type="checkbox"
                  className="form-check-input position-absolute top-0 end-0 m-2"
                  style={{ transform: 'scale(1.5)' }}
                  checked={selectedReports.includes(report.id)}
                  onChange={() => toggleReportSelection(report.id)}
                />
                <h5 className="card-title">Объект: {report.address}</h5>
                <p className="card-text">Дата: {formatDate(report.date)}</p>
                <p className="card-text" style={{ fontSize: '0.9em', color: 'gray' }}>
                  {getUserFullName(report.userId || report.user_id)}
                </p>
                <div className="d-flex justify-content-between mt-3">
                  <button className="btn btn-primary me-2" onClick={() => handlePreviewClick(report)}>
                    Предпросмотр
                  </button>
                  <button className="btn btn-success me-2" onClick={() => handleDownload(report.filename)}>
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
              maxHeight: '70vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: window.innerWidth <= 768 ? '8px' : '16px 0 16px 0', // Убираем горизонтальные отступы на ПК
              margin: '0',
              textAlign: 'left',
              width: '100%'
            }}
          >
            {/* Содержимое будет добавлено динамически */}
          </div>
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
