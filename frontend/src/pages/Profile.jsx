import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    department: '',
    password: '',
  });
  const [updateMessage, setUpdateMessage] = useState('');
  const { logout } = useAuth();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await axios.get('/api/check-auth');
        setUser(data.user);
        setEditForm({
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          department: data.user.department,
          password: '',
        });
      } catch (err) {
        setError('Ошибка загрузки профиля');
      }
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      logout(); // Используем функцию logout из AuthContext, которая уже содержит всю необходимую логику
    } catch (err) {
      setError('Ошибка при выходе из системы');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      password: '',
    });
    setUpdateMessage('');
    setError('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const updateData = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        department: editForm.department,
        ...(editForm.password && { password: editForm.password }),
      };

      await axios.put('/api/profile', updateData);

      setUser({
        ...user,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        department: editForm.department,
      });
      setIsEditing(false);
      setUpdateMessage('Профиль успешно обновлен');
      setTimeout(() => setUpdateMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при обновлении профиля');
    }
  };

  return (
    <div className="container mt-5">
      <h2>Профиль</h2>

      {error && <p className="text-danger">{error}</p>}
      {updateMessage && <p className="text-success">{updateMessage}</p>}

      {user && !isEditing ? (
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
          <div className="mt-3">
            <button onClick={handleEdit} className="btn btn-primary me-2">
              Редактировать
            </button>
            <button onClick={handleLogout} className="btn btn-danger">
              Выйти
            </button>
          </div>
        </div>
      ) : isEditing ? (
        <div className="card p-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Имя:</label>
              <input
                type="text"
                className="form-control"
                name="firstName"
                value={editForm.firstName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Фамилия:</label>
              <input
                type="text"
                className="form-control"
                name="lastName"
                value={editForm.lastName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Отдел:</label>
              <input
                type="text"
                className="form-control"
                name="department"
                value={editForm.department}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Новый пароль (оставьте пустым, если не хотите менять):</label>
              <input
                type="password"
                className="form-control"
                name="password"
                value={editForm.password}
                onChange={handleChange}
              />
            </div>
            <div className="mt-3">
              <button type="submit" className="btn btn-success me-2">
                Сохранить
              </button>
              <button type="button" onClick={handleCancel} className="btn btn-secondary">
                Отмена
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p>Загрузка...</p>
      )}
    </div>
  );
}
