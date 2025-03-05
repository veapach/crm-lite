import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Certificates.css'; // Подключаем CSS файл

function Certificates() {
  const [files, setFiles] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [newNames, setNewNames] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchCertificates();
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const { data } = await axios.get('http://localhost:8080/api/check-auth', {
        headers: {
          Authorization: token,
        },
      });
      setUser(data.user);
    } catch (error) {
      console.error('Ошибка при получении данных пользователя', error);
    }
  };

  const fetchCertificates = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/certificates');
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
      await axios.post('http://localhost:8080/api/certificates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchCertificates();
    } catch (error) {
      console.error('Ошибка при загрузке файлов', error);
    }
  };

  const handleDownload = (filename) => {
    axios({
      url: `http://localhost:8080/api/certificates/download/${filename}`,
      method: 'GET',
      responseType: 'blob',
    })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
      })
      .catch((error) => console.error('Ошибка при скачивании файла', error));
  };

  const handleRename = async (oldName) => {
    const newName = newNames[oldName];
    if (!newName || !newName.trim()) return;

    try {
      await axios.put('http://localhost:8080/api/certificates/rename', { oldName, newName });
      setNewNames((prev) => ({ ...prev, [oldName]: '' }));
      fetchCertificates();
    } catch (error) {
      console.error('Ошибка при переименовании файла', error);
    }
  };

  const handleDelete = async (filename) => {
    try {
      await axios.delete(`http://localhost:8080/api/certificates/delete/${filename}`);
      fetchCertificates();
    } catch (error) {
      console.error('Ошибка при удалении файла', error);
    }
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
      <h1>Хранилище сертификатов</h1>

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

      <h3>Загруженные сертификаты</h3>
      <div className="table-responsive">
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
                      src={`http://localhost:8080/api/certificates/download/${certificate}`}
                      alt="Preview"
                      width="50"
                      height="50"
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
                <td colSpan="3">Нет загруженных сертификатов</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Certificates;