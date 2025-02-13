import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Profile() {
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    department: '',
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        console.log('Токен:', token);
        if (token) {
          const response = await axios.get('http://localhost:8080/api/check-auth', {
            headers: {
              Authorization: token,
            },
          });

          setIsAuthenticated(response.data.isAuthenticated);
          if (response.data.user) {
            setProfileData(response.data.user);
          }
        }
      } catch (error) {
        console.error('Ошибка проверки авторизации', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    };
    checkAuth();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = 'http://localhost:8080/api/update-profile'; // Предположим, что у вас есть такой эндпоинт
    try {
      await axios.post(url, profileData);
      alert('Данные профиля обновлены');
      setErrorMessage('');
    } catch (error) {
      if (error.response) {
        setErrorMessage(error.response.data.error || 'Ошибка');
      } else {
        setErrorMessage('Ошибка сети');
      }
    }
  };

  if (!isAuthenticated) {
    return <div>Пожалуйста, войдите в систему.</div>;
  }

  return (
    <div className="container mt-5">
      <h1>Личный кабинет</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="firstName" className="form-label">
            Имя
          </label>
          <input
            type="text"
            className="form-control"
            id="firstName"
            name="firstName"
            value={profileData.firstName}
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
            value={profileData.lastName}
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
            value={profileData.department}
            onChange={handleChange}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Сохранить
        </button>
        {errorMessage && <div className="text-danger">{errorMessage}</div>}
      </form>
    </div>
  );
}

export default Profile;
