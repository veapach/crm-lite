import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Modal } from 'react-bootstrap';

function InnerTickets() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await axios.get('/api/client-tickets');
        const data = response.data.tickets; // Ensure we access the 'tickets' field from the response
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
      await axios.put(`/api/client-tickets/${ticketId}`, { status: newStatus });
      setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, status: newStatus, engineerName: newStatus === 'Не назначено' ? null : ticket.engineerName } : ticket)));
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
    navigate(`/new-report?date=${ticket.date}&address=${ticket.address}&classification=${ticket.description}`);
  };

  const [fileUrls, setFileUrls] = useState({});

  const handleViewDetails = async (ticket) => {
    setSelectedTicket(ticket);
    setShowDetailsModal(true);
    
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

  return (
    <div className="inner-tickets container mt-4">
      <h1 className="text-center mb-4">Заявки</h1>
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
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>{ticket.id}</td>
              <td>{ticket.date}</td>
              <td>{ticket.fullName}</td>
              <td>{ticket.position}</td>
              <td>{ticket.contact}</td>
              <td>{ticket.address}</td>
              <td>{ticket.description.length > 50 ? `${ticket.description.substring(0, 50)}...` : ticket.description}</td>
              <td>{ticket.status}</td>
              <td>{ticket.engineerName || 'Не назначен'}</td>
              <td>
                {ticket.status !== 'В работе' && (
                  <Button variant="primary" size="sm" onClick={() => handleTakeInWork(ticket.id)}>Взять в работу</Button>
                )}{' '}
                {ticket.status === 'В работе' && (
                  <Button variant="warning" size="sm" onClick={() => handleChangeStatus(ticket.id, 'Не назначено')}>Сбросить статус</Button>
                )}{' '}
                <Button variant="danger" size="sm" onClick={() => handleDelete(ticket.id)}>Удалить</Button>{' '}
                <Button variant="success" size="sm" onClick={() => handleCreateReport(ticket)}>Создать отчет</Button>{' '}
                <Button variant="info" size="sm" onClick={() => handleViewDetails(ticket)}>Подробнее</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

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
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>Закрыть</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default InnerTickets;
