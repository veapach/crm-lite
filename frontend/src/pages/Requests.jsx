import React, { useState, useEffect } from 'react';
import { Table, Button, Badge, Modal, Form } from 'react-bootstrap';
import axios from 'axios';

function Requests() {
  const [requests, setRequests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [formData, setFormData] = useState({
    date: '',
    address: '',
    type: '',
    description: '',
    engineerId: '',
    status: 'В работе'
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await axios.get('/api/requests');
      setRequests(response.data);
    } catch (error) {
      console.error('Ошибка при получении заявок:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/requests', formData);
      setShowModal(false);
      fetchRequests();
      setFormData({
        date: '',
        address: '',
        type: '',
        description: '',
        engineerId: '',
        status: 'В работе'
      });
    } catch (error) {
      console.error('Ошибка при создании заявки:', error);
    }
  };

  const handleStatusChange = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/requests/${selectedRequest.id}`,
        { ...selectedRequest, status: e.target.status.value }
      );
      setShowStatusModal(false);
      fetchRequests();
    } catch (error) {
      console.error('Ошибка при обновлении статуса:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/api/requests/${selectedRequest.id}`);
      setShowDeleteModal(false);
      fetchRequests();
    } catch (error) {
      console.error('Ошибка при удалении заявки:', error);
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'В работе':
        return 'warning';
      case 'Завершено':
        return 'success';
      case 'Отменено':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Заявки</h2>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          Создать заявку
        </Button>
      </div>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Дата</th>
            <th>Адрес</th>
            <th>Тип</th>
            <th>Описание</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td>{request.date}</td>
              <td>{request.address}</td>
              <td>{request.type}</td>
              <td>{request.description}</td>
              <td>
                <Badge bg={getStatusBadgeVariant(request.status)}>
                  {request.status}
                </Badge>
              </td>
              <td>
                <Button 
                  variant="info" 
                  size="sm" 
                  className="me-2"
                  onClick={() => {
                    setSelectedRequest(request);
                    setShowDetailsModal(true);
                  }}
                >
                  Подробнее
                </Button>
                <Button 
                  variant="success" 
                  size="sm" 
                  className="me-2"
                  onClick={() => {
                    setSelectedRequest(request);
                    setShowStatusModal(true);
                  }}
                >
                  Изменить статус
                </Button>
                <Button 
                  variant="danger" 
                  size="sm"
                  onClick={() => {
                    setSelectedRequest(request);
                    setShowDeleteModal(true);
                  }}
                >
                  Удалить
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Модальное окно создания заявки */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Создать заявку</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Дата</Form.Label>
              <Form.Control
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Адрес</Form.Label>
              <Form.Control
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Тип заявки</Form.Label>
              <Form.Control
                type="text"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Описание</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </Form.Group>
            <Button variant="primary" type="submit">
              Создать
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Модальное окно подробностей */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Подробности заявки</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRequest && (
            <div>
              <p><strong>Дата:</strong> {selectedRequest.date}</p>
              <p><strong>Адрес:</strong> {selectedRequest.address}</p>
              <p><strong>Тип заявки:</strong> {selectedRequest.type}</p>
              <p><strong>Описание:</strong> {selectedRequest.description}</p>
              <p><strong>Статус:</strong> {selectedRequest.status}</p>
              {selectedRequest.Report && (
                <p><strong>Прикрепленный отчет:</strong> {selectedRequest.Report.filename}</p>
              )}
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Модальное окно изменения статуса */}
      <Modal show={showStatusModal} onHide={() => setShowStatusModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Изменить статус заявки</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleStatusChange}>
            <Form.Group className="mb-3">
              <Form.Label>Статус</Form.Label>
              <Form.Select name="status" defaultValue={selectedRequest?.status}>
                <option value="В работе">В работе</option>
                <option value="Завершено">Завершено</option>
                <option value="Отменено">Отменено</option>
              </Form.Select>
            </Form.Group>
            <Button variant="primary" type="submit">
              Сохранить
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Модальное окно удаления */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Удаление заявки</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Вы уверены, что хотите удалить эту заявку?</p>
          <div className="d-flex justify-content-end gap-2">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Отмена
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Удалить
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default Requests;