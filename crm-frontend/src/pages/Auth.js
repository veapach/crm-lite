import React, { useState } from 'react';
import axios from 'axios';

function Auth() {
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
    firstName: '',
    lastName: '',
    department: '',
  });
  const [isLogin, setIsLogin] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = isLogin ? 'http://localhost:8080/api/login' : 'http://localhost:8080/api/register';
    try {
      const response = await axios.post(url, formData);

      if (isLogin) {
        // Сохраняем токен и данные пользователя
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }

      alert('Успешно');
      setErrorMessage('');
      window.location.reload(); // Обновляем страницу после успеха
    } catch (error) {
      if (error.response) {
        setErrorMessage(error.response.data.error || 'Ошибка');
      } else {
        setErrorMessage('Ошибка сети');
      }
    }
  };

  return (
    <div className="container mt-5">
      <h1>{isLogin ? 'Вход' : 'Регистрация'}</h1>
      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <>
            <div className="mb-3">
              <label htmlFor="firstName" className="form-label">
                Имя
              </label>
              <input
                type="text"
                className="form-control"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="lastName" className="form-label">
                Фамилия
              </label>
              <input
                type="text"
                className="form-control"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="department" className="form-label">
                Отдел
              </label>
              <input
                type="text"
                className="form-control"
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
              />
            </div>
          </>
        )}
        <div className="mb-3">
          <label htmlFor="phone" className="form-label">
            Телефон
          </label>
          <input
            type="text"
            className={`form-control ${errorMessage && 'is-invalid'}`}
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
          />
          {errorMessage && <div className="invalid-feedback">{errorMessage}</div>}
        </div>
        <div className="mb-3">
          <label htmlFor="password" className="form-label">
            Пароль
          </label>
          <input
            type="password"
            className={`form-control ${errorMessage && 'is-invalid'}`}
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
          />
          {errorMessage && <div className="invalid-feedback">{errorMessage}</div>}
        </div>
        <button type="submit" className="btn btn-primary">
          {isLogin ? 'Войти' : 'Зарегистрироваться'}
        </button>
        <button type="button" className="btn btn-link" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
        </button>
      </form>
    </div>
  );
}

export default Auth;
