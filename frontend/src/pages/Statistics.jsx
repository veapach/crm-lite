import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Modal } from 'react-bootstrap';
import { renderAsync } from 'docx-preview';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const Statistics = () => {
  const [stats, setStats] = useState({ month: 0, toKitchen: 0, toBakery: 0, to: 0, av: 0, pnr: 0, total: 0, filteredToKitchen: 0, filteredToBakery: 0, filteredTo: 0, filteredAv: 0, filteredPnr: 0 });
  const [filteredReports, setFilteredReports] = useState([]);
  const [activeClass, setActiveClass] = useState('');
  const [reportsLoading, setReportsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const viewerRef = useRef(null);
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
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
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const container = viewerRef.current;
        container.innerHTML = '';
        const isMobile = window.innerWidth <= 768;
        const scale = isMobile ? 1.2 : 1.5;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const canvas = document.createElement('canvas');
          container.appendChild(canvas);
          const page = await pdf.getPage(pageNum);
          let currentScale = scale;
          if (isMobile) {
            const containerWidth = container.clientWidth - 12;
            const defaultViewport = page.getViewport({ scale });
            const ratio = containerWidth / defaultViewport.width;
            currentScale = scale * ratio;
          }
          const viewport = page.getViewport({ scale: currentScale });
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const context = canvas.getContext('2d');
          await page.render({ canvasContext: context, viewport: viewport }).promise;
          if (pageNum < pdf.numPages) {
            const spacer = document.createElement('div');
            spacer.style.height = '20px';
            container.appendChild(spacer);
          }
        }
      } else {
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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Получаем статистику за месяц (filtered*)
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const start = new Date(year, month, 1).toISOString().slice(0, 10);
        const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
        const response = await axios.get(`/api/reportscount?startDate=${start}&endDate=${end}`);
        setStats({
          month: response.data.filteredTotal || 0,
          toKitchen: response.data.filteredToKitchen || 0,
          toBakery: response.data.filteredToBakery || 0,
          to: response.data.filteredTo || 0,
          av: response.data.filteredAv || 0,
          pnr: response.data.filteredPnr || 0,
          total: response.data.total || 0,
          filteredToKitchen: response.data.filteredToKitchen || 0,
          filteredToBakery: response.data.filteredToBakery || 0,
          filteredTo: response.data.filteredTo || 0,
          filteredAv: response.data.filteredAv || 0,
          filteredPnr: response.data.filteredPnr || 0,
        });
      } catch (err) {
        setError('Ошибка при загрузке статистики');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Функция для загрузки актов по классификации за текущий месяц
  const handleClassClick = async (classification) => {
    setActiveClass(classification);
    setReportsLoading(true);
    setFilteredReports([]);
    setError('');
    try {
      // Получаем даты начала и конца месяца
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const start = new Date(year, month, 1).toISOString().slice(0, 10);
      const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

      let classValue = classification;
      if (classification === 'АВ') classValue = 'АВ';
      if (classification === 'ТО Китчен') classValue = 'ТО Китчен';
      if (classification === 'ТО Пекарня') classValue = 'ТО Пекарня';
      if (classification === 'ТО') classValue = 'ТО';
      if (classification === 'ПНР') classValue = 'ПНР';

      // Загружаем все страницы отчетов
      let allReports = [];
      let page = 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        const response = await axios.get(`/api/reports?startDate=${start}&endDate=${end}&page=${page}&pageSize=100`);
        const pageData = response.data;
        const reports = Array.isArray(pageData) ? pageData : pageData.reports;

        if (!Array.isArray(reports)) {
          setError('Некорректный формат данных от сервера');
          return;
        }

        if (reports.length === 0) {
          hasMorePages = false;
        } else {
          allReports = allReports.concat(reports);
          page++;
        }
      }

      let filteredReports = allReports;
      
      if (["ТО Китчен", "ТО Пекарня", "ТО", "АВ", "ПНР"].includes(classification)) {
        filteredReports = allReports.filter(r => (r.classification || '').toLowerCase() === classValue.toLowerCase());
      } else if (classification === 'Другие') {
        filteredReports = allReports.filter(r => {
          const c = (r.classification || '').toLowerCase();
          return c !== 'то китчен' && c !== 'то пекарня' && c !== 'то' && c !== 'ав' && c !== 'пнр';
        });
      }
      setFilteredReports(filteredReports);
    } catch (err) {
      setError('Ошибка при загрузке актов');
      console.error('Ошибка при загрузке актов:', err);
    } finally {
      setReportsLoading(false);
    }
  };

  return (
    <div className="container mt-5 statistics-page">
      <h1>Статистика отчетов</h1>
      {loading ? (
        <div style={{ fontSize: '2rem' }}>Загрузка...</div>
      ) : error ? (
        <div className="text-danger" style={{ fontSize: '1.3rem' }}>{error}</div>
      ) : (
        <>
          <div className="statistics-header-count" style={{ fontSize: '3rem', fontWeight: 800, marginBottom: 18 }}>
            {stats.month} актов за месяц
          </div>
          <div className="statistics-class-buttons" style={{ fontSize: '1rem', color: '#333', display: 'flex', gap: 40, marginBottom: 18, flexWrap: 'wrap' }}>
            <button
              className={`btn btn-outline-primary${activeClass === 'АВ' ? ' active' : ''}`}
              style={{ fontWeight: 600, fontSize: '1em', borderWidth: 2, minWidth: 70, marginBottom: 8 }}
              onClick={() => handleClassClick('АВ')}
            >
              АВ: {stats.filteredAv}
            </button>
            <button
              className={`btn btn-outline-primary${activeClass === 'ТО Китчен' ? ' active' : ''}`}
              style={{ fontWeight: 600, fontSize: '1em', borderWidth: 2, minWidth: 110, marginBottom: 8 }}
              onClick={() => handleClassClick('ТО Китчен')}
            >
              ТО Китчен: {stats.filteredToKitchen}
            </button>
            <button
              className={`btn btn-outline-primary${activeClass === 'ТО Пекарня' ? ' active' : ''}`}
              style={{ fontWeight: 600, fontSize: '1em', borderWidth: 2, minWidth: 120, marginBottom: 8 }}
              onClick={() => handleClassClick('ТО Пекарня')}
            >
              ТО Пекарня: {stats.filteredToBakery}
            </button>
            <button
              className={`btn btn-outline-primary${activeClass === 'ТО' ? ' active' : ''}`}
              style={{ fontWeight: 600, fontSize: '1em', borderWidth: 2, minWidth: 70, marginBottom: 8 }}
              onClick={() => handleClassClick('ТО')}
            >
              ТО: {stats.filteredTo}
            </button>
            <button
              className={`btn btn-outline-primary${activeClass === 'ПНР' ? ' active' : ''}`}
              style={{ fontWeight: 600, fontSize: '1em', borderWidth: 2, minWidth: 70, marginBottom: 8 }}
              onClick={() => handleClassClick('ПНР')}
            >
              ПНР: {stats.filteredPnr}
            </button>
            <button
              className={`btn btn-outline-primary${activeClass === 'Другие' ? ' active' : ''}`}
              style={{ fontWeight: 600, fontSize: '1em', borderWidth: 2, minWidth: 90, marginBottom: 8 }}
              onClick={() => handleClassClick('Другие')}
            >
              Другие: {stats.month - stats.filteredAv - stats.filteredToKitchen - stats.filteredToBakery - stats.filteredTo - stats.filteredPnr}
            </button>
          </div>
          <div className="statistics-total-count" style={{ fontSize: '1.1rem', color: '#888', marginBottom: 18 }}>
            Всего актов: {stats.total}
          </div>
          {activeClass && (
            <div style={{ marginTop: 30 }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: 10 }}>
                Акты за месяц по категории: {activeClass}
              </div>
              {reportsLoading ? (
                <div style={{ fontSize: '1.1rem' }}>Загрузка...</div>
              ) : filteredReports.length === 0 ? (
                <div style={{ fontSize: '1.1rem', color: '#888' }}>Нет актов</div>
              ) : (
                <ul style={{ fontSize: '1.1rem', paddingLeft: 0, listStyle: 'none' }}>
                  {filteredReports.map(r => (
                    <li key={r.id} style={{ marginBottom: 10, borderBottom: '1px solid #eee', paddingBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <span style={{ wordBreak: 'break-word', maxWidth: '60vw', fontSize: '1em' }}>
                        <b>{formatDate(r.date)}</b> — {r.address} <span style={{ color: '#888' }}>({r.classification})</span>
                      </span>
                      <span style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <button className="btn btn-primary btn-sm me-2" style={{ fontSize: '0.95em', padding: '4px 8px' }} onClick={() => handlePreviewClick(r)}>
                          Предпросмотр
                        </button>
                        <button className="btn btn-success btn-sm" style={{ fontSize: '0.95em', padding: '4px 8px' }} onClick={() => handleDownload(r.filename)}>
                          Скачать
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
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
              padding: window.innerWidth <= 768 ? '8px' : '16px 0 16px 0',
              margin: '0',
              textAlign: 'left',
              width: '100%'
            }}
          >
            {/* Содержимое будет добавлено динамически */}
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Statistics;
