import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { renderAsync } from 'docx-preview';
import { Modal } from 'react-bootstrap';
import '../styles/Reports.css';

function Reports() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showOnlyMine, setShowOnlyMine] = useState(true);
  const viewerRef = useRef(null);
  const [highlightedReportId, setHighlightedReportId] = useState(null);

  const fetchReports = useCallback(async () => {
    try {
      const response = await axios.get(`http://localhost:8080/api/reports?onlyMine=${showOnlyMine}`);
      setReports(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке отчетов', error);
    }
  }, [showOnlyMine]);

  const handlePreviewClick = async (report) => {
    setSelectedReport(report);
    setShowPreview(true);
    try {
      const response = await axios.get(`http://localhost:8080/${report.filename}`, {
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
      const response = await axios.get(`http://localhost:8080/${filename}`, {
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
  }, [fetchReports]);

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
                <h5 className="card-title">Дата: {report.date}</h5>
                <p className="card-text">Объект: {report.address}</p>
                <div className="d-flex justify-content-between">
                  <button className="btn btn-primary" onClick={() => handlePreviewClick(report)}>
                    Предпросмотр
                  </button>
                  <button className="btn btn-success" onClick={() => handleDownload(report.filename)}>
                    Скачать
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
    </div>
  );
}

export default Reports;
