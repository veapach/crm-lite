import React, { useState } from 'react';
import axios from 'axios';

function Report() {
  const [formData, setFormData] = useState({
    date: '',
    address: '',
    classification: '',
    works: '',
    materials: '',
    additionalWorks: '',
    recommendations: '',
    defects: '',
    fullName: '',
  });
  const [photos, setPhotos] = useState([]);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    setPhotos(e.target.files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      data.append(key, formData[key]);
    });
    Array.from(photos).forEach((photo) => {
      data.append('photos', photo);
    });

    try {
      const response = await axios.post('http://localhost:8080/api/generateReport', data);
      setMessage('Ваш отчет готов, нажмите чтобы скачать');
    } catch (error) {
      console.error('Ошибка при создании отчета', error);
    }
  };

  return (
    <div className="container mt-5">
      <h1>Создание отчета</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="date" className="form-label">
            Дата
          </label>
          <input type="date" className="form-control" id="date" name="date" required onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label htmlFor="address" className="form-label">
            Адрес
          </label>
          <input type="text" className="form-control" id="address" name="address" required onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label htmlFor="classification" className="form-label">
            Классификация
          </label>
          <input
            type="text"
            className="form-control"
            id="classification"
            name="classification"
            onChange={handleChange}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="works" className="form-label">
            Работы
          </label>
          <input type="text" className="form-control" id="works" name="works" onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label htmlFor="materials" className="form-label">
            Материалы
          </label>
          <input type="text" className="form-control" id="materials" name="materials" onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label htmlFor="additionalWorks" className="form-label">
            Дополнительные работы
          </label>
          <input
            type="text"
            className="form-control"
            id="additionalWorks"
            name="additionalWorks"
            onChange={handleChange}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="recommendations" className="form-label">
            Рекомендации
          </label>
          <input
            type="text"
            className="form-control"
            id="recommendations"
            name="recommendations"
            onChange={handleChange}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="defects" className="form-label">
            Дефекты
          </label>
          <input type="text" className="form-control" id="defects" name="defects" onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label htmlFor="fullName" className="form-label">
            ФИО
          </label>
          <input type="text" className="form-control" id="fullName" name="fullName" onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label htmlFor="photos" className="form-label">
            Фотографии
          </label>
          <input type="file" className="form-control" id="photos" multiple onChange={handleFileChange} />
        </div>
        <button type="submit" className="btn btn-primary">
          Создать отчет
        </button>
      </form>
      {message && (
        <div className="mt-3">
          <p>{message}</p>
          <a href="http://localhost:8080/api/downloadReport" className="btn btn-success">
            Скачать
          </a>
        </div>
      )}
    </div>
  );
}

export default Report;
