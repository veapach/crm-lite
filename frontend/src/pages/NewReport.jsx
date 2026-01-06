import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaChevronDown } from 'react-icons/fa';

function NewReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Prefill from query params if present
  const getInitialFormData = () => {
    const params = new URLSearchParams(window.location.search);
    const date = params.get('date') || '';
    const address = params.get('address') || '';
    const classification = params.get('classification') || 'не выбрано';
    const customClass = params.get('customClass') || '';
    return {
      date,
      address,
      equipmentItems: [{ name: '', number: '', quantity: 1 }],
      inventory_number: '',
      classification,
      customClass,
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
        { task: 'Проверка отсутствия механических повреждений проводов', done: false },
        { task: 'Проверка работы программных устройств', done: false },
        { task: 'Проверка нагревательных элементов', done: false },
        { task: 'Проверка соленоидных клапанов', done: false },
        {
          task: 'Проверка состояния электроаппаратуры, при необходимости затяжка электроконтактных соединений, замена сгоревших плавких вставок',
          done: false,
        },
        { task: 'Проверка магнетрона', done: false },
        { task: 'Проверка вентилятора', done: false },
        { task: 'Проверка катализатора', done: false },
        { task: 'Проверка настройки микропроцессоров', done: false },
        { task: 'Контроль силы тока в каждой из фаз и межфазных напряжений', done: false },
        { task: 'Контрольная проверка агрегата в рабочем режиме', done: false },
        
      ],
    };
  };

  const [formData, setFormData] = useState(getInitialFormData());
  // Список пользователей и выбранный исполнитель
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  // Загрузка пользователей
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get('/api/users');
        setUsers(response.data);
        // По умолчанию выбран текущий пользователь
        if (user && user.id) {
          setSelectedUserId(user.id);
        } else if (response.data.length > 0) {
          setSelectedUserId(response.data[0].id);
        }
      } catch (err) {
        setUsers([]);
      }
    };
    fetchUsers();
  }, [user]);

  const [previewImages, setPreviewImages] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [addresses, setAddresses] = useState([]);
  const [filteredAddresses, setFilteredAddresses] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);

  // Equipment dropdown states
  const [equipmentList, setEquipmentList] = useState([]); // [{id, equipment}]
  const [filteredEquipment, setFilteredEquipment] = useState([]); // array of strings
  const [showEquipmentSuggestions, setShowEquipmentSuggestions] = useState(false);

  const fileInputRef = useRef(null);
  const addressInputRef = useRef(null);
  const equipmentInputRef = useRef(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  // Загружаем список оборудования при монтировании компонента
  // Получаем список оборудования с правильным полем (equipment)
  const fetchEquipment = async () => {
    try {
      const response = await axios.get('/api/equipment');
      // Приводим к формату [{id, equipment}]
      setEquipmentList(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Ошибка при загрузке оборудования:', error);
      setEquipmentList([]);
    }
  };

  const fetchEquipmentMemory = async (address, classification) => {
    try {
      const response = await axios.get(`/api/equipment/memory?address=${encodeURIComponent(address)}&classification=${encodeURIComponent(classification)}`);
      setFormData(prev => ({
        ...prev,
        equipmentItems: [{ 
          name: response.data.machineName || '', 
          number: response.data.machineNumber || '',
          quantity: response.data.count || 1
        }]
      }));
    } catch (error) {
      if (error.response?.status === 404) {
        setFormData(prev => ({
          ...prev,
          equipmentItems: [{ name: '', number: '', quantity: 1 }]
        }));
      } else {
        console.error('Ошибка при загрузке запомненного оборудования:', error);
      }
    }
  };

  // Загружаем список адресов при монтировании компонента
  const fetchAddresses = async () => {
    try {
      const response = await axios.get('/api/addresses');
      setAddresses(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке адресов:', error);
    }
  };

  // Используем эту функцию при монтировании компонента
  useEffect(() => {
    fetchAddresses();
    fetchEquipment();
  }, []);
  // Выпадающий список для оборудования

  // Индекс активного поля оборудования для выпадающего списка
  const [activeEquipmentIndex, setActiveEquipmentIndex] = useState(null);

  // Открыть/закрыть выпадающий список оборудования
  const toggleEquipmentList = (index) => {
    if (showEquipmentSuggestions && activeEquipmentIndex === index) {
      setShowEquipmentSuggestions(false);
      setActiveEquipmentIndex(null);
    } else {
      setFilteredEquipment(equipmentList.map(eq => eq.equipment));
      setShowEquipmentSuggestions(true);
      setActiveEquipmentIndex(index);
    }
  };

  // Выбор оборудования из выпадающего списка
  const handleEquipmentSelect = (equipmentName, index) => {
    setFormData(prev => ({
      ...prev,
      equipmentItems: prev.equipmentItems.map((item, i) => 
        i === index ? { ...item, name: equipmentName } : item
      )
    }));
    setShowEquipmentSuggestions(false);
    setActiveEquipmentIndex(null);
  };

  // Добавить новое оборудование
  const handleAddEquipment = () => {
    setFormData(prev => ({
      ...prev,
      equipmentItems: [...prev.equipmentItems, { name: '', number: '', quantity: 1 }]
    }));
  };

  // Удалить оборудование
  const handleRemoveEquipment = (index) => {
    setFormData(prev => ({
      ...prev,
      equipmentItems: prev.equipmentItems.filter((_, i) => i !== index)
    }));
  };

  // Изменить поле оборудования
  const handleEquipmentChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      equipmentItems: prev.equipmentItems.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));

    // Фильтрация при вводе названия оборудования
    if (field === 'name') {
      if (value.trim() === '') {
        setFilteredEquipment([]);
        setShowEquipmentSuggestions(false);
      } else {
        const filtered = equipmentList
          .filter(eq => (eq.equipment || '').toLowerCase().includes(value.toLowerCase()))
          .map(eq => eq.equipment);
        setFilteredEquipment(filtered);
        setShowEquipmentSuggestions(filtered.length > 0);
        setActiveEquipmentIndex(index);
      }
    }
  };

  const toggleAddressList = () => {
    if (showAddressSuggestions) {
      setShowAddressSuggestions(false);
    } else {
      // Если список скрыт, показываем все адреса
      setFilteredAddresses(addresses.map(addr => addr.address));
      setShowAddressSuggestions(true);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Обновляем состояние валидации при изменении поля
    if (name === 'date' || name === 'address') {
      setValidationErrors(prev => ({
        ...prev,
        [name]: value.trim() === ''
      }));
    }

    // Если изменяется поле адреса, фильтруем подсказки
    if (name === 'address') {
      if (value.trim() === '') {
        setFilteredAddresses([]);
        setShowAddressSuggestions(false);
        // Если адрес очищен, очищаем поля оборудования
        setFormData(prev => ({
          ...prev,
          equipmentItems: [{ name: '', number: '', quantity: 1 }]
        }));
      } else {
        const filtered = addresses
          .filter(addr => (addr.address || '').toLowerCase().includes(value.toLowerCase()))
          .map(addr => addr.address);
        setFilteredAddresses(filtered);
        setShowAddressSuggestions(filtered.length > 0);

        // Если есть классификация, загружаем запомненное оборудование для нового адреса
        if (formData.classification) {
          fetchEquipmentMemory(value, formData.classification);
        }
      }
    }

    // Если изменяется классификация и есть адрес, загружаем запомненное оборудование
    if (name === 'classification') {
      if (value === 'не выбрано') {
        // Если выбрано "не выбрано", очищаем поля оборудования
        setFormData(prev => ({
          ...prev,
          equipmentItems: [{ name: '', number: '', quantity: 1 }]
        }));
      } else if (formData.address) {
        fetchEquipmentMemory(formData.address, value);
      } else {
        // Если адреса нет, очищаем поля оборудования
        setFormData(prev => ({
          ...prev,
          equipmentItems: [{ name: '', number: '', quantity: 1 }]
        }));
      }
    }
  };

  const handleAddressSelect = (address) => {
    setFormData(prev => ({ ...prev, address }));
    setShowAddressSuggestions(false);
    setValidationErrors(prev => ({ ...prev, address: false }));
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

    // Проверяем обязательные поля
    const errors = {
      date: !formData.date,
      address: !formData.address
    };

    setValidationErrors(errors);

    if (errors.date || errors.address) {
      setError('Пожалуйста, заполните обязательные поля (дата и объект)');
      return;
    }

    // Если выбрана классификация "Другое", заменяем значение
    let dataToSend = { ...formData };
    // Конвертируем equipmentItems в machine_name и machine_number для совместимости с бэкендом
    const equipmentNames = formData.equipmentItems
      .filter(item => item.name.trim())
      .map(item => item.quantity > 1 ? `${item.name} (${item.quantity} шт.)` : item.name)
      .join(', ');
    const equipmentNumbers = formData.equipmentItems
      .filter(item => item.number.trim())
      .map(item => item.number)
      .join(', ');
    dataToSend.machine_name = equipmentNames;
    dataToSend.machine_number = equipmentNumbers;
    delete dataToSend.equipmentItems;
    // Добавляем выбранного исполнителя
    dataToSend.userId = parseInt(selectedUserId, 10);
    if (dataToSend.classification === 'Другое') {
      dataToSend.classification = dataToSend.customClass;
    } else if (dataToSend.classification === 'Аварийный вызов') {
      dataToSend.classification = 'АВ';
    }

    // Показываем индикатор загрузки и скрываем форму
    setIsLoading(true);

    try {
      const response = await axios.post('/api/report', dataToSend, {
        headers: { 'Content-Type': 'application/json' },
      });
      const newReportId = response.data.id;
      setSuccess('Отчет успешно создан');
      fetchAddresses();

      // Если оборудование не найдено в списке, добавляем его
      for (const item of formData.equipmentItems) {
        const machineName = item.name?.trim();
        if (
          machineName &&
          !equipmentList.some(eq => (eq.equipment || '').toLowerCase() === machineName.toLowerCase())
        ) {
          try {
            await axios.post('/api/equipment', { equipment: machineName });
          } catch (err) {
            // Не критично, просто логируем
            console.error('Ошибка при добавлении оборудования:', err);
          }
        }
      }
      fetchEquipment();

      // Перенаправляем на страницу путевого листа после успешного создания
      setTimeout(() => navigate('/travel-sheet'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при создании отчета');
      setIsLoading(false);
    }
  };


  // Определяем стиль для полей ввода в зависимости от валидации
  const getInputStyle = (fieldName) => {
    if (validationErrors[fieldName] === undefined) return {};
    return {
      borderColor: validationErrors[fieldName] ? '#dc3545' : '#28a745',
      borderWidth: '2px'
    };
  };

  // Если идет загрузка, показываем индикатор вместо формы
  if (isLoading) {
    return (
      <div className="container mt-5 mb-5 text-center">
        <h1>Создание отчета</h1>
        <div className="my-5">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Загрузка...</span>
          </div>
          <h4 className="mt-3">Создаем отчет, пожалуйста подождите...</h4>
          {success && <div className="alert alert-success mt-3">{success}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-5 mb-5">
      <h1>Создание отчета</h1>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="needs-validation">
        <div className="mb-3">
          <label className="form-label fw-bold">Исполнитель</label>
          <select
            className="form-select"
            value={selectedUserId || ''}
            onChange={e => setSelectedUserId(parseInt(e.target.value, 10))}
            required
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.lastName || ''} {u.firstName || ''} {u.patronymic || ''}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label fw-bold mt-3">Дата *</label>
          <input
            type="date"
            className="form-control"
            name="date"
            value={formData.date}
            onChange={handleChange}
            style={getInputStyle('date')}
            required
          />
        </div>

        <div className="mb-3 position-relative">
          <label className="form-label fw-bold">Объект *</label>
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              name="address"
              value={formData.address}
              onChange={handleChange}
              style={getInputStyle('address')}
              ref={addressInputRef}
              required
              autoComplete="off"
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={toggleAddressList}
              title="Показать все адреса"
            >
              <FaChevronDown />
            </button>
          </div>
          {showAddressSuggestions && (
            <div className="position-absolute w-100 mt-1 border rounded shadow-sm dropdown-suggestions" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
              {filteredAddresses.length > 0 ? (
                filteredAddresses.map((address, index) => (
                  <div
                    key={index}
                    className="p-2 border-bottom cursor-pointer dropdown-suggestion-item"
                    onClick={() => handleAddressSelect(address)}
                    style={{ cursor: 'pointer' }}
                  >
                    {address}
                  </div>
                ))
              ) : (
                <div className="p-2 text-muted">Нет подходящих адресов</div>
              )}
            </div>
          )}
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold">Классификация</label>
          <select className="form-select" name="classification" value={formData.classification} onChange={handleChange}>
            <option value="не выбрано">Не выбрано</option>
            <option value="ТО Китчен">ТО Китчен</option>
            <option value="ТО Пекарня">ТО Пекарня</option>
            <option value="ТО Китчен/Пекарня">ТО Китчен/Пекарня</option>
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
          <label className="form-label fw-bold">Оборудование</label>
          {formData.equipmentItems.map((item, index) => (
            <div key={index} className="border rounded p-3 mb-2 position-relative">
              <div className="d-flex gap-2 mb-2 align-items-start">
                <div className="flex-grow-1 position-relative">
                  <label className="form-label small">Название</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Название оборудования"
                      value={item.name}
                      onChange={e => handleEquipmentChange(index, 'name', e.target.value)}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => toggleEquipmentList(index)}
                      title="Показать все оборудование"
                    >
                      <FaChevronDown />
                    </button>
                  </div>
                  {showEquipmentSuggestions && activeEquipmentIndex === index && (
                    <div className="position-absolute w-100 mt-1 border rounded shadow-sm dropdown-suggestions" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                      {filteredEquipment.length > 0 ? (
                        filteredEquipment.map((name, i) => (
                          <div
                            key={i}
                            className="p-2 border-bottom cursor-pointer dropdown-suggestion-item"
                            onClick={() => handleEquipmentSelect(name, index)}
                            style={{ cursor: 'pointer' }}
                          >
                            {name}
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-muted">Нет подходящего оборудования</div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ width: '100px' }}>
                  <label className="form-label small">Кол-во</label>
                  <input
                    type="number"
                    min={1}
                    className="form-control"
                    value={item.quantity}
                    onChange={e => handleEquipmentChange(index, 'quantity', Number(e.target.value) || 1)}
                  />
                </div>
                {formData.equipmentItems.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm mt-4"
                    onClick={() => handleRemoveEquipment(index)}
                    title="Удалить"
                  >
                    ×
                  </button>
                )}
              </div>
              <div>
                <label className="form-label small">Номер оборудования</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Номер оборудования"
                  value={item.number}
                  onChange={e => handleEquipmentChange(index, 'number', e.target.value)}
                />
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddEquipment}>
            + Добавить оборудование
          </button>
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold">Инвентаризационный номер</label>
          <textarea
            className="form-control"
            name="inventory_number"
            value={formData.inventory_number}
            onChange={handleChange}
            rows="1"
          />
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
      </form>
    </div>
  );
}

export default NewReport;
