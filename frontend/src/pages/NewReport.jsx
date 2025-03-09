import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import config from '../config';

function NewReport() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    date: '',
    address: '',
    classification: 'ТО',
    customClass: '',
    material: '',
    recommendations: '',
    defects: '',
    additionalWorks: '',
    comments: '',
    photos: [],
    checklistItems: [
      { task: 'Ежемесячный технический осмотр оборудования на предмет его работоспособности', done: false },
      { task: 'Технический осмотр оборудования на предмет его работоспособности', done: false },
      { task: 'Диагностика неисправного оборудования на предмет проведения его ремонта', done: false },
      { task: 'Диагностика оборудования', done: false },
      { task: 'Проверка крепления термостатов, сигнальной арматуры, дверей и облицовки', done: false },
      { task: 'Проверка надежности крепления заземления и отсутствия механических повреждений проводов', done: false },
      { task: 'Проверка работы программных устройств', done: false },
      { task: 'Проверка нагревательных элементов', done: false },
      { task: 'Проверка соленоидных клапанов', done: false },
      {
        task: 'Проверка состояния электроаппаратуры, при необходимости затяжка электроконтактных соединений, замена сгоревших плавких вставок',
        done: false,
      },
      { task: 'Контроль силы тока в каждой из фаз и межфазных напряжений', done: false },
      { task: 'Проверка настройки микропроцессоров', done: false },
      { task: 'Контрольная проверка агрегата в рабочем режиме', done: false },
    ],
  });

  const [previewImages, setPreviewImages] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fileInputRef = useRef(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.filter(file => !uploadedFiles.some(uploadedFile => uploadedFile.name === file.name));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImages((prev) => [...prev, reader.result]);
        setFormData((prev) => ({
          ...prev,
          photos: [...prev.photos, reader.result],
        }));
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleChecklistChange = (index) => {
    setFormData((prev) => ({
      ...prev,
      checklistItems: prev.checklistItems.map((item, i) => (i === index ? { ...item, done: !item.done } : item)),
    }));
  };

  const handleRemovePhoto = (index) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
    setPreviewImages((prev) => prev.filter((_, i) => i !== index));
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleButtonClick = (e) => {
    e.preventDefault();
    fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
  
    if (!formData.date || !formData.address) {
      setError('Пожалуйста, заполните обязательные поля (дата и адрес)');
      return;
    }
  
    try {
      const response = await axios.post(`http://${config.API_BASE_URL}:8080/api/report`, formData, {
        headers: { 'Content-Type': 'application/json' },
      });
  
      const newReportId = response.data.id; // Предполагается, что API возвращает ID созданного отчета
      setSuccess('Отчет успешно создан');
      
      setTimeout(() => navigate(`/reports?highlight=${newReportId}`), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при создании отчета');
    }
  };
  

  return (
    <div className="container mt-5 mb-5">
      <h1>Создание отчета</h1>

      <form onSubmit={handleSubmit} className="needs-validation">
        <div className="mb-3">
          <label className="form-label fw-bold mt-3">Дата *</label>
          <input
            type="date"
            className="form-control"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold">Объект *</label>
          <input
            type="text"
            className="form-control"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold">Классификация</label>
          <select className="form-select" name="classification" value={formData.classification} onChange={handleChange}>
            <option value="ТО">ТО</option>
            <option value="ПНР">ПНР</option>
            <option value="Аварийный вызов">Аварийный вызов</option>
            <option value="Другое">Другое</option>
          </select>

          {formData.classification === 'Другое' && (
            <input
              type="text"
              className="form-control mt-2"
              name="customClass"
              value={formData.customClass}
              onChange={handleChange}
              placeholder="Укажите свой вариант"
            />
          )}
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold">Фотографии</label>
          <div className="custom-file-input-wrapper mt-2">
            <button className="btn btn-primary ms-3" onClick={handleButtonClick}>Выберите фотографии</button>
            <input
              type="file"
              className="form-control custom-file-input"
              multiple
              accept="image/*"
              onChange={handlePhotoChange}
              ref={fileInputRef}
              style={{ position: 'absolute', left: 0, top: 0, opacity: 0, width: '100%', height: '100%' }}
            />
          </div>
          <div className="mt-2">
            {uploadedFiles.length === 0 ? (
              <span>Не выбран ни один файл</span>
            ) : (
              <span>Выбрано файлов: {uploadedFiles.length}</span>
            )}
          </div>
          <div className="mt-2 d-flex flex-wrap gap-2">
            {previewImages.map((preview, index) => (
              <div key={index} className="position-relative">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm position-absolute top-0 end-0"
                  onClick={() => handleRemovePhoto(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold">Материалы</label>
          <textarea
            className="form-control"
            name="material"
            value={formData.material}
            onChange={handleChange}
            rows="3"
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold">Рекомендации</label>
          <textarea
            className="form-control"
            name="recommendations"
            value={formData.recommendations}
            onChange={handleChange}
            rows="3"
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold">Дефекты</label>
          <textarea className="form-control" name="defects" value={formData.defects} onChange={handleChange} rows="3" />
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold">Чек-лист работ</label>
          {formData.checklistItems.map((item, index) => (
            <div key={index} className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                checked={item.done}
                onChange={() => handleChecklistChange(index)}
                id={`checklist-${index}`}
              />
              <label className="form-check-label" htmlFor={`checklist-${index}`}>
                {item.task}
              </label>
            </div>
          ))}
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold">Дополнительные работы</label>
          <textarea
            className="form-control"
            name="additionalWorks"
            value={formData.additionalWorks}
            onChange={handleChange}
            rows="3"
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold">Комментарии</label>
          <textarea
            className="form-control"
            name="comments"
            value={formData.comments}
            onChange={handleChange}
            rows="3"
          />
        </div>

        <button type="submit" className="btn btn-primary">
          Создать отчет
        </button>

        {error && <div className="alert alert-danger mt-3">{error}</div>}
        {success && <div className="alert alert-success mt-3">{success}</div>}
      </form>
    </div>
  );
}

export default NewReport;
