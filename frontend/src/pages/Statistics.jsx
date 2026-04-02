import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { Modal } from 'react-bootstrap';
import { renderAsync } from 'docx-preview';
import * as pdfjsLib from 'pdfjs-dist';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import '../styles/Statistics.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const SHORT_MONTH_NAMES = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
];

const CHART_COLORS = {
  av: '#ff6b6b',
  toKitchen: '#4ecdc4',
  toBakery: '#45b7d1',
  toKitchenBakery: '#96ceb4',
  to: '#feca57',
  pnr: '#a29bfe',
  other: '#636e72'
};

const PIE_COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#a29bfe', '#636e72'];

const CLASSIFICATIONS = [
  { key: 'filteredAv', label: 'АВ', apiClass: 'АВ', trendKey: 'av' },
  { key: 'filteredToKitchen', label: 'ТО Китчен', apiClass: 'ТО Китчен', trendKey: 'toKitchen' },
  { key: 'filteredToBakery', label: 'ТО Пекарня', apiClass: 'ТО Пекарня', trendKey: 'toBakery' },
  { key: 'filteredToKitchenBakery', label: 'ТО К/П', apiClass: 'ТО Китчен/Пекарня', trendKey: 'toKitchenBakery' },
  { key: 'filteredTo', label: 'ТО', apiClass: 'ТО', trendKey: 'to' },
  { key: 'filteredPnr', label: 'ПНР', apiClass: 'ПНР', trendKey: 'pnr' },
  { key: 'filteredOther', label: 'Другие', apiClass: 'Другие', trendKey: 'other' },
];

const getMonthRange = (year, month) => {
  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  return { start, end };
};

const Statistics = () => {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [activeClass, setActiveClass] = useState('');
  const [reportsLoading, setReportsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const viewerRef = useRef(null);

  const now = new Date();
  const [filterMode, setFilterMode] = useState('month');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getDateRange = useCallback(() => {
    if (filterMode === 'month') {
      return getMonthRange(selectedYear, selectedMonth);
    }
    return { start: customStart, end: customEnd };
  }, [filterMode, selectedYear, selectedMonth, customStart, customEnd]);

  const getPeriodLabel = () => {
    if (filterMode === 'month') {
      return `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    }
    if (customStart && customEnd) {
      return `${new Date(customStart).toLocaleDateString('ru-RU')} — ${new Date(customEnd).toLocaleDateString('ru-RU')}`;
    }
    return 'Выберите период';
  };

  const fetchStats = useCallback(async () => {
    const { start, end } = getDateRange();
    if (!start || !end) return;

    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`/api/reportscount?startDate=${start}&endDate=${end}`);
      setStats(response.data);
    } catch (err) {
      setError('Ошибка при загрузке статистики');
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  const fetchTrends = useCallback(async () => {
    try {
      const response = await axios.get('/api/reports/trends?months=6');
      setTrends(response.data || []);
    } catch (err) {
      console.error('Ошибка при загрузке трендов:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  useEffect(() => {
    setActiveClass('');
    setFilteredReports([]);
  }, [filterMode, selectedYear, selectedMonth, customStart, customEnd]);

  const navigateMonth = (direction) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

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
    } catch (err) {
      setError('Ошибка при загрузке документа');
      console.error('Ошибка при загрузке документа:', err);
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
    } catch (err) {
      setError('Ошибка при скачивании файла');
    }
  };

  const handleClassClick = async (classification) => {
    if (activeClass === classification) {
      setActiveClass('');
      setFilteredReports([]);
      return;
    }
    setActiveClass(classification);
    setReportsLoading(true);
    setFilteredReports([]);
    setError('');
    try {
      const { start, end } = getDateRange();
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

      let result = allReports;
      if (["ТО Китчен", "ТО Пекарня", "ТО Китчен/Пекарня", "ТО", "АВ", "ПНР"].includes(classification)) {
        result = allReports.filter(r => (r.classification || '').toLowerCase() === classification.toLowerCase());
      } else if (classification === 'Другие') {
        result = allReports.filter(r => {
          const c = (r.classification || '').toLowerCase();
          return c !== 'то китчен' && c !== 'то пекарня' && c !== 'то китчен/пекарня' && c !== 'то' && c !== 'ав' && c !== 'пнр';
        });
      }
      setFilteredReports(result);
    } catch (err) {
      setError('Ошибка при загрузке актов');
    } finally {
      setReportsLoading(false);
    }
  };

  const getPieData = () => {
    if (!stats) return [];
    return CLASSIFICATIONS
      .map(c => ({ name: c.label, value: stats[c.key] || 0 }))
      .filter(d => d.value > 0);
  };

  const getTrendsChartData = () => {
    return trends.map(item => {
      const [, month] = item.month.split('-');
      const monthIdx = parseInt(month, 10) - 1;
      return {
        ...item,
        label: `${SHORT_MONTH_NAMES[monthIdx]} ${item.month.slice(2, 4)}`
      };
    });
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ margin: 0, fontSize: 13, color: entry.color }}>
            {entry.name}: <b>{entry.value}</b>
          </p>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload[0]) return null;
    const { name, value } = payload[0];
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{name}: <b>{value}</b></p>
      </div>
    );
  };

  const renderPieLabel = ({ name, percent }) => {
    if (percent < 0.05) return null;
    return `${name} ${(percent * 100).toFixed(0)}%`;
  };

  return (
    <div className="statistics-container statistics-page">
      <div className="statistics-header">
        <h2>Статистика отчётов</h2>
      </div>

      <div className="date-filter-section">
        <div className="date-filter-tabs">
          <button
            className={`date-filter-tab${filterMode === 'month' ? ' active' : ''}`}
            onClick={() => setFilterMode('month')}
          >
            По месяцу
          </button>
          <button
            className={`date-filter-tab${filterMode === 'range' ? ' active' : ''}`}
            onClick={() => setFilterMode('range')}
          >
            Произвольный период
          </button>
        </div>

        <div className="date-filter-controls">
          {filterMode === 'month' ? (
            <div className="month-navigator">
              <button className="month-nav-btn" onClick={() => navigateMonth(-1)}>
                <FaChevronLeft />
              </button>
              <span className="month-label">{getPeriodLabel()}</span>
              <button className="month-nav-btn" onClick={() => navigateMonth(1)}>
                <FaChevronRight />
              </button>
            </div>
          ) : (
            <div className="date-range-inputs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span className="date-range-separator">—</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">Загрузка...</div>
      ) : error && !stats ? (
        <div className="empty-state" style={{ color: 'var(--accent-danger)' }}>{error}</div>
      ) : stats && (
        <>
          <div className="stats-cards-grid">
            <div
              className={`stat-card stat-card-total${!activeClass ? ' active' : ''}`}
              onClick={() => setActiveClass(null)}
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-card-value">{stats.filteredTotal || 0}</div>
              <div className="stat-card-label">Всего за период</div>
            </div>
            {CLASSIFICATIONS.map(c => (
              <div
                key={c.key}
                className={`stat-card${activeClass === c.apiClass ? ' active' : ''}`}
                onClick={() => handleClassClick(c.apiClass)}
              >
                <div className="stat-card-value">{stats[c.key] || 0}</div>
                <div className="stat-card-label">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="stat-total-row">
            <span className="stat-total-label">Всего актов за всё время: {stats.total || 0}</span>
          </div>

          <div className="charts-section">
            <div className="chart-card">
              <div className="chart-card-title">Распределение за {getPeriodLabel()}</div>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getPieData()}
                      cx="50%"
                      cy="50%"
                      outerRadius="75%"
                      innerRadius="40%"
                      dataKey="value"
                      label={renderPieLabel}
                      labelLine={false}
                      stroke="var(--bg-card)"
                      strokeWidth={2}
                    >
                      {getPieData().map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card-title">Динамика по месяцам</div>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getTrendsChartData()} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="av" name="АВ" fill={CHART_COLORS.av} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="toKitchen" name="ТО Китчен" fill={CHART_COLORS.toKitchen} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="toBakery" name="ТО Пекарня" fill={CHART_COLORS.toBakery} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="to" name="ТО" fill={CHART_COLORS.to} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="pnr" name="ПНР" fill={CHART_COLORS.pnr} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {activeClass && (
            <div className="reports-list-section">
              <div className="reports-list-title">
                Акты по категории: {activeClass}
              </div>
              {reportsLoading ? (
                <div className="loading-spinner">Загрузка...</div>
              ) : filteredReports.length === 0 ? (
                <div className="empty-state">Нет актов</div>
              ) : (
                <ul className="reports-list">
                  {filteredReports.map(r => (
                    <li key={r.id} className="report-list-item">
                      <div className="report-info">
                        <span className="report-date">{formatDate(r.date)}</span>
                        <span className="report-address">— {r.address}</span>
                        <span className="report-class-badge">({r.classification})</span>
                      </div>
                      <div className="report-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => handlePreviewClick(r)}>
                          Просмотр
                        </button>
                        <button className="btn btn-success btn-sm" onClick={() => handleDownload(r.filename)}>
                          Скачать
                        </button>
                      </div>
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
            Предпросмотр отчёта
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
          />
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Statistics;
