import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Tabs, Tab, Fade, Form } from 'react-bootstrap';
import TicketsMap from '../components/TicketsMap';
import '../styles/Schedule.css';
import '../styles/InnerTickets.css';

function InnerTickets() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showLinkReportModal, setShowLinkReportModal] = useState(false);
  const [showCompletedTickets, setShowCompletedTickets] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  const [ticketReports, setTicketReports] = useState([]);
  const [availableReports, setAvailableReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const navigate = useNavigate();
  
  // Состояние для предпросмотра PDF
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfViewerRef = useRef(null);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await axios.get('/api/client-tickets');
        const data = response.data.tickets;
        setTickets(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Ошибка при загрузке заявок:', error);
        setTickets([]);
      }
    };

    const fetchCurrentUser = async () => {
      try {
        const response = await axios.get('/api/check-auth');
        const user = response.data.user;
        setCurrentUser(user);
      } catch (error) {
        console.error('Ошибка при загрузке текущего пользователя:', error);
      }
    };

    fetchTickets();
    fetchCurrentUser();
  }, []);

  // Загрузка привязанных отчётов для заявки
  const fetchTicketReports = async (ticketId) => {
    try {
      const response = await axios.get(`/api/tickets/${ticketId}/reports`);
      setTicketReports(response.data.reports || []);
    } catch (error) {
      console.error('Ошибка загрузки отчётов:', error);
      setTicketReports([]);
    }
  };

  // Загрузка доступных отчётов для привязки
  const fetchAvailableReports = async (address) => {
    try {
      const response = await axios.get('/api/reports', {
        params: { search: address, limit: 50 }
      });
      setAvailableReports(response.data.reports || []);
    } catch (error) {
      console.error('Ошибка загрузки отчётов:', error);
      setAvailableReports([]);
    }
  };

  // Привязка отчёта к заявке
  const handleLinkReport = async () => {
    if (!selectedReportId || !selectedTicket) return;
    try {
      await axios.post('/api/tickets/link-report', {
        ticketId: selectedTicket.id,
        reportId: parseInt(selectedReportId)
      });
      await fetchTicketReports(selectedTicket.id);
      setSelectedReportId('');
      setShowLinkReportModal(false);
    } catch (error) {
      console.error('Ошибка привязки отчёта:', error);
      alert(error.response?.data?.error || 'Ошибка привязки отчёта');
    }
  };

  // Отвязка отчёта от заявки
  const handleUnlinkReport = async (reportId) => {
    if (!selectedTicket) return;
    try {
      await axios.delete(`/api/tickets/${selectedTicket.id}/reports/${reportId}`);
      await fetchTicketReports(selectedTicket.id);
    } catch (error) {
      console.error('Ошибка отвязки отчёта:', error);
    }
  };

  // Получение имени превью PNG из имени PDF файла
  const getPreviewName = (filename) => {
    return filename.replace(/\.pdf$/i, '.png');
  };

  // Предпросмотр отчёта (загружаем готовое PNG превью)
  const handlePreviewReport = async (report) => {
    setShowPdfPreview(true);
    setPdfLoading(true);
    
    try {
      const previewName = getPreviewName(report.filename);
      const response = await axios.get(`/reports/preview-image/${encodeURIComponent(previewName)}`, {
        responseType: 'blob',
        withCredentials: true,
      });
      
      const container = pdfViewerRef.current;
      if (!container) {
        setPdfLoading(false);
        return;
      }
      container.innerHTML = '';
      
      // Создаём URL для изображения и показываем его
      const imageUrl = URL.createObjectURL(response.data);
      const img = document.createElement('img');
      img.src = imageUrl;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = '0 auto';
      img.onload = () => setPdfLoading(false);
      img.onerror = () => {
        container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Ошибка загрузки превью</p>';
        setPdfLoading(false);
      };
      container.appendChild(img);
    } catch (err) {
      console.error('Ошибка загрузки превью:', err);
      if (pdfViewerRef.current) {
        pdfViewerRef.current.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Ошибка загрузки документа</p>';
      }
      setPdfLoading(false);
    }
  };

  // Закрытие предпросмотра PDF
  const closePdfPreview = () => {
    setShowPdfPreview(false);
    if (pdfViewerRef.current) {
      pdfViewerRef.current.innerHTML = '';
    }
  };

  const handleTakeInWork = async (ticketId) => {
    try {
      const engineerName = `${currentUser.firstName} ${currentUser.lastName}`;
      await axios.put(`/api/client-tickets/${ticketId}`, { status: 'В работе', engineerName });
      setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, status: 'В работе', engineerName } : ticket)));
    } catch (error) {
      console.error('Ошибка при взятии заявки в работу:', error);
    }
  };

  const handleChangeStatus = async (ticketId, newStatus) => {
    try {
      const currentTicket = tickets.find(ticket => ticket.id === ticketId);
      const engineerName = newStatus === 'Не назначено' ? null : currentTicket.engineerName;
      await axios.put(`/api/client-tickets/${ticketId}`, { status: newStatus, engineerName });
      setTickets((prev) => prev.map((ticket) =>
        ticket.id === ticketId
          ? {
            ...ticket,
            status: newStatus,
            engineerName: newStatus === 'Не назначено' ? null : ticket.engineerName
          }
          : ticket
      ));
    } catch (error) {
      console.error('Ошибка при изменении статуса заявки:', error);
    }
  };

  const handleDelete = async (ticketId) => {
    if (!window.confirm('Вы действительно хотите удалить эту заявку?')) return;
    try {
      await axios.delete(`/api/client-tickets/${ticketId}`);
      setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketId));
    } catch (error) {
      console.error('Ошибка при удалении заявки:', error);
    }
  };

  const handleCreateReport = (ticket) => {
    setSelectedTicket(ticket);
    setShowReportModal(true);
  };

  const handleConfirmReport = async (shouldComplete) => {
    const ticket = selectedTicket;
    const currentEngineer = ticket.engineerName || `${currentUser.firstName} ${currentUser.lastName}`;

    try {
      await axios.put(`/api/client-tickets/${ticket.id}`, {
        status: shouldComplete ? 'Завершено' : 'В работе',
        engineerName: currentEngineer
      });
      setTickets((prev) => prev.map((t) =>
        t.id === ticket.id
          ? { ...t, status: shouldComplete ? 'Завершено' : 'В работе', engineerName: currentEngineer }
          : t
      ));
    } catch (error) {
      console.error('Ошибка при изменении статуса заявки:', error);
    }

    setShowReportModal(false);
    navigate(`/new-report?date=${ticket.date}&address=${ticket.address}&classification=${ticket.description}`);
  };

  const [fileUrls, setFileUrls] = useState({});

  const handleViewDetails = async (ticket) => {
    setSelectedTicket(ticket);
    setShowDetailsModal(true);
    setTicketReports([]);

    // Загружаем привязанные отчёты
    await fetchTicketReports(ticket.id);

    if (ticket.files) {
      const files = ticket.files.split(',');
      const urls = {};

      for (const file of files) {
        try {
          const response = await axios.get(`/api/tickets/files/${file}`, {
            responseType: 'blob'
          });
          const blob = new Blob([response.data], { type: response.headers['content-type'] });
          urls[file] = URL.createObjectURL(blob);
        } catch (error) {
          console.error('Ошибка при загрузке файла:', file, error);
        }
      }

      setFileUrls(urls);
    }
  };

  // Открыть модалку привязки отчёта
  const handleOpenLinkReportModal = async (ticket) => {
    setSelectedTicket(ticket);
    setSelectedReportId('');
    await fetchAvailableReports(ticket.address);
    setShowLinkReportModal(true);
  };

  return (
    <div className="inner-tickets container mt-4">
      <h1 className="text-center mb-4">Заявки</h1>

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-3 tickets-tabs"
        transition={Fade}
      >
        <Tab eventKey="list" title="Список">
          <div className="mb-3">
            <Button
              variant={showCompletedTickets ? "secondary" : "primary"}
              onClick={() => setShowCompletedTickets(!showCompletedTickets)}
            >
              {showCompletedTickets ? "Показать активные" : "Показать завершенные"}
            </Button>
          </div>
          <div className="scroll-indicator">
            ← Прокрутите таблицу для просмотра всех столбцов и действий →
          </div>
          <div className="schedule-table-wrapper">
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Дата</th>
                  <th>ФИО</th>
                  <th>Должность</th>
                  <th>Контакт</th>
                  <th>Адрес</th>
                  <th>Описание</th>
                  <th>Статус</th>
                  <th>Инженер</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {tickets
                  .filter(ticket => showCompletedTickets ?
                    ticket.status === 'Завершено' :
                    ['Не назначено', 'В работе'].includes(ticket.status))
                  .map((ticket) => {
                    const isCurrentEngineer = currentUser && ticket.engineerName === `${currentUser.firstName} ${currentUser.lastName}`;

                    return (
                      <tr key={ticket.id}>
                        <td>{ticket.id}</td>
                        <td>{ticket.date}</td>
                        <td>{ticket.fullName}</td>
                        <td>{ticket.position}</td>
                        <td>{ticket.contact}</td>
                        <td>{ticket.address}</td>
                        <td>{ticket.description.length > 50 ? `${ticket.description.substring(0, 50)}...` : ticket.description}</td>
                        <td style={{ backgroundColor: ticket.status === 'Не назначено' ? '#ff9999' : 'transparent' }}>
                          {ticket.status}
                        </td>
                        <td style={{ backgroundColor: isCurrentEngineer ? '#d0e7ff' : undefined }}>
                          {ticket.engineerName || 'Не назначен'}
                        </td>
                        <td>
                          {ticket.status !== 'В работе' && (
                            <Button variant="success" size="sm" onClick={() => handleTakeInWork(ticket.id)}>Взять в работу</Button>
                          )}{' '}
                          {ticket.status === 'В работе' && (
                            <>
                              <Button variant="warning" size="sm" onClick={() => handleChangeStatus(ticket.id, 'Не назначено')}>Сбросить статус</Button>{' '}
                              <Button variant="success" size="sm" onClick={() => handleChangeStatus(ticket.id, 'Завершено')}>Завершить заявку</Button>
                            </>
                          )}{' '}
                          <Button variant="danger" size="sm" onClick={() => handleDelete(ticket.id)}>Удалить</Button>{' '}
                          <Button variant="primary" size="sm" onClick={() => handleCreateReport(ticket)}>Создать отчет</Button>{' '}
                          <Button variant="outline-secondary" size="sm" onClick={() => handleOpenLinkReportModal(ticket)}>📎 Отчёт</Button>{' '}
                          <Button variant="info" size="sm" onClick={() => handleViewDetails(ticket)}>Подробнее</Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>

            </Table>
          </div>
        </Tab>

        <Tab eventKey="map" title="Карта">
          <div className="mb-3">
            <Button
              variant={showCompletedTickets ? "secondary" : "primary"}
              onClick={() => setShowCompletedTickets(!showCompletedTickets)}
            >
              {showCompletedTickets ? "Показать активные" : "Показать завершенные"}
            </Button>
          </div>
          <TicketsMap
            tickets={tickets.filter(ticket => showCompletedTickets ?
              ticket.status === 'Завершено' :
              ['Не назначено', 'В работе'].includes(ticket.status))}
          />
        </Tab>
      </Tabs>

      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Детали заявки</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTicket && (
            <div>
              <p><strong>ФИО:</strong> {selectedTicket.fullName}</p>
              <p><strong>Должность:</strong> {selectedTicket.position}</p>
              <p><strong>Контакт:</strong> {selectedTicket.contact}</p>
              <p><strong>Адрес:</strong> {selectedTicket.address}</p>
              <p><strong>Описание:</strong> {selectedTicket.description}</p>
              <p><strong>Статус:</strong> {selectedTicket.status}</p>
              <p><strong>Инженер:</strong> {selectedTicket.engineerName || 'Не назначен'}</p>
              <p><strong>Файлы:</strong></p>
              <div>
                {selectedTicket.files && selectedTicket.files.split(',').map((file, index) => (
                  <div key={index}>
                    {fileUrls[file] ? (
                      <img
                        src={fileUrls[file]}
                        alt={file}
                        style={{ maxWidth: '100%', marginBottom: '10px' }}
                      />
                    ) : (
                      <div>Загрузка {file}...</div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Привязанные отчёты */}
              <div className="mt-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong>Привязанные отчёты:</strong>
                  <Button 
                    variant="outline-success" 
                    size="sm"
                    onClick={() => handleOpenLinkReportModal(selectedTicket)}
                  >
                    + Привязать отчёт
                  </Button>
                </div>
                {ticketReports.length === 0 ? (
                  <p className="text-muted">Нет привязанных отчётов</p>
                ) : (
                  <div className="list-group">
                    {ticketReports.map(report => (
                      <div key={report.id} className="list-group-item d-flex justify-content-between align-items-center">
                        <div style={{ flex: 1 }}>
                          <button 
                            onClick={() => handlePreviewReport(report)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#0d6efd',
                              cursor: 'pointer',
                              padding: 0,
                              textAlign: 'left',
                              textDecoration: 'underline'
                            }}
                          >
                            📄 {report.date} - {report.classification}
                          </button>
                          <small className="d-block text-muted">{report.address}</small>
                        </div>
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          onClick={() => handleUnlinkReport(report.id)}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>Закрыть</Button>
        </Modal.Footer>
      </Modal>

      {/* Модальное окно привязки отчёта */}
      <Modal show={showLinkReportModal} onHide={() => setShowLinkReportModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Привязать отчёт к заявке</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Выберите отчёт для привязки</Form.Label>
            <Form.Select 
              value={selectedReportId} 
              onChange={(e) => setSelectedReportId(e.target.value)}
            >
              <option value="">-- Выберите отчёт --</option>
              {availableReports.map(report => (
                <option key={report.id} value={report.id}>
                  {report.date} - {report.classification} ({report.address.substring(0, 30)}...)
                </option>
              ))}
            </Form.Select>
            <Form.Text className="text-muted">
              Показаны отчёты по адресу: {selectedTicket?.address}
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLinkReportModal(false)}>
            Отмена
          </Button>
          <Button 
            variant="success" 
            onClick={handleLinkReport}
            disabled={!selectedReportId}
          >
            Привязать
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showReportModal} onHide={() => setShowReportModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Создание отчета</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Желаете завершить заявку после создания отчета?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => handleConfirmReport(false)}>
            Оставить в работе
          </Button>
          <Button variant="primary" onClick={() => handleConfirmReport(true)}>
            Завершить заявку
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Модальное окно предпросмотра PDF */}
      <Modal show={showPdfPreview} onHide={closePdfPreview} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Просмотр отчёта</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflow: 'auto', background: '#f5f5f5' }}>
          {pdfLoading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Загрузка...</span>
              </div>
              <p className="mt-2">Загрузка документа...</p>
            </div>
          )}
          <div ref={pdfViewerRef}></div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closePdfPreview}>
            Закрыть
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default InnerTickets;
