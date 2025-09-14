import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Files.css';
import '../styles/Schedule.css';
import { Modal } from 'react-bootstrap';

function Files() {
  const [files, setFiles] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [newNames, setNewNames] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [user, setUser] = useState(null);
  
  const [showImageModal, setShowImageModal] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState('');

  useEffect(() => {
    fetchCertificates();
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data } = await axios.get('/api/check-auth');
      setUser(data.user);
    } catch (error) {
      console.error('Ошибка при получении данных пользователя', error);
    }
  };

  const fetchCertificates = async () => {
    try {
      const response = await axios.get('/api/files');
      setCertificates(response.data || []);
    } catch (error) {
      console.error('Ошибка при загрузке сертификатов', error);
      setCertificates([]);
    }
  };

  const handleFileChange = (e) => {
    setFiles(e.target.files);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('file', file, file.name));

    try {
      await axios.post('/api/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchCertificates();
    } catch (error) {
      console.error('Ошибка при загрузке файлов', error);
    }
  };

  const handleDownload = (filename) => {
    const encodedFilename = encodeURIComponent(filename);

    axios({
      url: `/api/files/download/${encodedFilename}`,
      method: 'GET',
      responseType: 'blob',
    })
      .then((response) => {
        const decodedFilename = decodeURIComponent(encodedFilename);
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', decodedFilename);
        document.body.appendChild(link);
        link.click();
      })
      .catch((error) => console.error('Ошибка при скачивании файла', error));
  };

  const handleRename = async (oldName) => {
    const newName = newNames[oldName];
    if (!newName || !newName.trim()) return;

    try {
      await axios.put('/api/files/rename', { oldName, newName });
      setNewNames((prev) => ({ ...prev, [oldName]: '' }));
      fetchCertificates();
    } catch (error) {
      console.error('Ошибка при переименовании файла', error);
    }
  };

  const handleDelete = async (filename) => {
    try {
      await axios.delete(`/api/files/delete/${filename}`);
      fetchCertificates();
    } catch (error) {
      console.error('Ошибка при удалении файла', error);
    }
  };

  const handleImageClick = (certificate) => {
    setEnlargedImage(`${axios.defaults.baseURL}/api/files/preview/${encodeURIComponent(certificate)}`);
    setShowImageModal(true);
  };

  const handleCloseModal = () => {
    setShowImageModal(false);
    setEnlargedImage('');
  };

  const filteredCertificates = certificates.filter((certificate) => {
    const matchesSearch = certificate.toLowerCase().includes(searchQuery.toLowerCase());
    if (!showOnlyMine) return matchesSearch;
    
    return matchesSearch && user && (
      certificate.toLowerCase().includes(user.firstName.toLowerCase()) ||
      certificate.toLowerCase().includes(user.lastName.toLowerCase())
    );
  });

  return (
    <div className="container mt-3">
      <h1>Хранилище файлов</h1>

      <form onSubmit={handleUpload} className="mb-4">
        <div className="mb-3">
          <label htmlFor="files" className="form-label">
            Выберите файлы
          </label>
          <input type="file" className="form-control" id="files" multiple onChange={handleFileChange} />
        </div>
        <button type="submit" className="btn btn-primary">
          Загрузить
        </button>
      </form>

      <div className="row mb-3">
        <div className="col-md-8">
          <input
            type="text"
            className="form-control"
            placeholder="Поиск по имени"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <div className="form-check mt-2">
            <input
              type="checkbox"
              className="form-check-input"
              id="showOnlyMine"
              checked={showOnlyMine}
              onChange={(e) => setShowOnlyMine(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="showOnlyMine">
              Мои сертификаты
            </label>
          </div>
        </div>
      </div>

      <h3>Загруженные файлы</h3>
      <div className="schedule-table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Предпросмотр</th>
              <th>Название</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredCertificates.length > 0 ? (
              filteredCertificates.map((certificate, index) => (
                <tr key={index}>
                  <td>
                    <img
                      src={`${axios.defaults.baseURL}/api/files/preview/${encodeURIComponent(certificate)}`}
                      alt="Preview"
                      width="50"
                      height="50"
                      style={{ objectFit: 'contain', cursor: 'pointer' }}
                      onClick={() => handleImageClick(certificate)}
                      title="Нажмите для увеличения"
                    />
                  </td>
                  <td>{certificate}</td>
                  <td>
                    <input
                      type="text"
                      placeholder="Новое имя"
                      value={newNames[certificate] || ''}
                      onChange={(e) => setNewNames((prev) => ({ ...prev, [certificate]: e.target.value }))}
                      className="form-control d-inline-block w-auto"
                    />
                    <button className="btn btn-warning btn-sm mx-2" onClick={() => handleRename(certificate)}>
                      Переименовать
                    </button>
                    <button className="btn btn-success btn-sm" onClick={() => handleDownload(certificate)}>
                      Скачать
                    </button>
                    <button className="btn btn-danger btn-sm ms-2" onClick={() => handleDelete(certificate)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3">Нет загруженных файлов</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal 
        show={showImageModal} 
        onHide={handleCloseModal}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
        </Modal.Header>
        <Modal.Body className="text-center p-0">
          {enlargedImage && (
            <img
              src={enlargedImage}
              alt="Enlarged preview"
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 150px)',
                objectFit: 'contain'
              }}
            />
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default Files;