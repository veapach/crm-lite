import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ phone: '', password: '', firstName: '', lastName: '', department: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const { data } = await axios.post(`http://${config.API_BASE_URL}:8080/api/${isLogin ? 'login' : 'register'}`, form);

      localStorage.setItem('token', data.token);
      // Добавляем событие storage для обновления navbar
      window.dispatchEvent(new Event('storage'));

      navigate('/profile');
    } catch (err) {
      console.error('Ошибка:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Произошла ошибка');
    }
  };

  return (
    <div className="container mt-5">
      <h1>{isLogin ? 'Вход' : 'Регистрация'}</h1>

      <form onSubmit={handleSubmit} className="mb-4">
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
                value={form.firstName}
                onChange={handleChange}
                required
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
                value={form.lastName}
                onChange={handleChange}
                required
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
                value={form.department}
                onChange={handleChange}
                required
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
            className="form-control"
            id="phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="password" className="form-label">
            Пароль
          </label>
          <input
            type="password"
            className="form-control"
            id="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <button type="submit" className="btn btn-primary">
          {isLogin ? 'Войти' : 'Зарегистрироваться'}
        </button>
      </form>

      <button onClick={() => setIsLogin(!isLogin)} className="btn btn-link">
        {isLogin ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войти'}
      </button>
    </div>
  );
}
