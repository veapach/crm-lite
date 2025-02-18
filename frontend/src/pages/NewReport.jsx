import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImages((prev) => [...prev, reader.result]);
        setFormData((prev) => ({
          ...prev,
          photos: [...prev.photos, reader.result], // Сохраняем base64 строку
        }));
      };
      reader.readAsDataURL(file);
    });
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
      const reportData = {
        ...formData,
        photos: formData.photos || [],
      };

      await axios.post('http://localhost:8080/api/report', reportData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      setSuccess('Отчет успешно создан');
      setTimeout(() => navigate('/reports'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при создании отчета');
    }
  };

  return (
    <div className="container mt-5 mb-5">
      <h1>Создание отчета</h1>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="needs-validation">
        <div className="mb-3">
          <label className="form-label">Дата *</label>
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
          <label className="form-label">Объект *</label>
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
          <label className="form-label">Классификация</label>
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
          <label className="form-label">Фотографии</label>
          <input type="file" className="form-control" multiple accept="image/*" onChange={handlePhotoChange} />
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
          <label className="form-label">Материалы</label>
          <textarea
            className="form-control"
            name="material"
            value={formData.material}
            onChange={handleChange}
            rows="3"
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Рекомендации</label>
          <textarea
            className="form-control"
            name="recommendations"
            value={formData.recommendations}
            onChange={handleChange}
            rows="3"
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Дефекты</label>
          <textarea className="form-control" name="defects" value={formData.defects} onChange={handleChange} rows="3" />
        </div>

        <div className="mb-3">
          <label className="form-label">Чек-лист работ</label>
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
          <label className="form-label">Дополнительные работы</label>
          <textarea
            className="form-control"
            name="additionalWorks"
            value={formData.additionalWorks}
            onChange={handleChange}
            rows="3"
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Комментарии</label>
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
      </form>
    </div>
  );
}

export default NewReport;
