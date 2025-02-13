import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Certificates() {
  const [files, setFiles] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [newNames, setNewNames] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCertificates();
  }, []);

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

      setTimeout(fetchCertificates, 500); // Небольшая задержка
    } catch (error) {
      console.error('Ошибка при загрузке файлов', error);
    }
  };

  const handleDownload = (filename) => {
    axios({
      url: `http://localhost:8080/api/download/${filename}`,
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
      await axios.put('http://localhost:8080/api/rename', { oldName, newName });
      setNewNames((prev) => ({ ...prev, [oldName]: '' }));
      fetchCertificates();
    } catch (error) {
      console.error('Ошибка при переименовании файла', error);
    }
  };

  const handleDelete = async (filename) => {
    try {
      await axios.delete(`http://localhost:8080/api/delete/${filename}`);
      fetchCertificates();
    } catch (error) {
      console.error('Ошибка при удалении файла', error);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      try {
        const response = await axios.get(`http://localhost:8080/api/search?query=${searchQuery}`);
        setCertificates(response.data || []);
      } catch (error) {
        console.error('Ошибка при поиске сертификатов', error);
      }
    }
  };

  const handleResetSearch = async () => {
    setSearchQuery('');
    fetchCertificates();
  };

  return (
    <div className="container mt-5">
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

      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Поиск по имени"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="btn btn-primary mt-2" onClick={handleSearch}>
          Поиск
        </button>
        <button className="btn btn-secondary mt-2 ms-2" onClick={handleResetSearch}>
          Сброс
        </button>
      </div>

      <h3>Загруженные сертификаты</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Предпросмотр</th>
            <th>Название</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {certificates.length > 0 ? (
            certificates.map((certificate, index) => (
              <tr key={index}>
                <td>
                  <img src={`http://localhost:8080/api/download/${certificate}`} alt="Preview" width="50" height="50" />
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
  );
}

export default Certificates;
