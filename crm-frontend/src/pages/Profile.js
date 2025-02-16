import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        console.log('Токен из localStorage:', token);

        if (!token) {
          console.log('Токен отсутствует, перенаправление на /auth');
          navigate('/auth');
          return;
        }

        const { data } = await axios.get('http://localhost:8080/api/check-auth', {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
          },
        });

        console.log('Получен ответ:', data);
        setUser(data.user);
      } catch (err) {
        console.error('Ошибка аутентификации:', err.response?.data);
        console.error('Заголовки запроса:', err.config?.headers);
        setError('Ошибка загрузки профиля');
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('storage'));
        navigate('/auth');
      }
    };

    fetchUser();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('storage'));
    navigate('/auth');
  };

  return (
    <div className="container mt-5">
      <h2>Профиль</h2>

      {error && <p className="text-danger">{error}</p>}
      {user ? (
        <div className="card p-4">
          <p>
            <strong>Имя:</strong> {user.firstName}
          </p>
          <p>
            <strong>Фамилия:</strong> {user.lastName}
          </p>
          <p>
            <strong>Отдел:</strong> {user.department}
          </p>
          <p>
            <strong>Телефон:</strong> {user.phone}
          </p>
          <button onClick={handleLogout} className="btn btn-danger mt-3">
            Выйти
          </button>
        </div>
      ) : (
        <p>Загрузка...</p>
      )}
    </div>
  );
}
