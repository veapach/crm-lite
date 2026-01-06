import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '../../context/ClientAuthContext';
import styles from './ClientAuth.module.css';

const LOGO_SRC = '/assets/Логотип ВВ/ВкусВилл зеленый/Лого-ВкусВилл-зеленый.png';

export default function ClientAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    position: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useClientAuth();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await login(form.email, form.password);
      } else {
        if (!form.email || !form.password || !form.fullName) {
          setError('Заполните обязательные поля');
          setLoading(false);
          return;
        }
        result = await register(form);
      }

      if (result.success) {
        navigate('/client/tickets');
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError('Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setForm({
      email: '',
      password: '',
      fullName: '',
      phone: '',
      position: ''
    });
  };

  return (
    <div className={styles.authPageWrapper} data-theme="light">
      {/* Анимированный градиентный фон */}
      <div className={styles.animatedBg}>
        <div className={styles.gradientOrb1}></div>
        <div className={styles.gradientOrb2}></div>
        <div className={styles.gradientOrb3}></div>
        <div className={styles.gradientOrb4}></div>
      </div>

      <div className={styles.authCard}>
        <div className="text-center mb-4">
          <img src={LOGO_SRC} alt="ВкусВилл" className={styles.logo} />
        </div>
        
        <h2 className={styles.authTitle}>
          {isLogin ? 'Вход в личный кабинет' : 'Регистрация'}
        </h2>
        
        <p className={styles.authSubtitle}>
          {isLogin 
            ? 'Войдите, чтобы просматривать свои заявки' 
            : 'Создайте аккаунт для отслеживания заявок'}
        </p>

        <form className={styles.authForm} onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>ФИО *</label>
                <input
                  className={styles.formInput}
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="Введите ваше имя"
                  required={!isLogin}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Телефон</label>
                  <input
                    className={styles.formInput}
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+7..."
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Должность</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    name="position"
                    value={form.position}
                    onChange={handleChange}
                    placeholder="Ваша должность"
                  />
                </div>
              </div>
            </>
          )}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email *</label>
            <input
              className={styles.formInput}
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="example@mail.ru"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Пароль *</label>
            <input
              className={styles.formInput}
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Введите пароль"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className={styles.errorAlert}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                {isLogin ? 'Вход...' : 'Регистрация...'}
              </>
            ) : (
              isLogin ? 'Войти' : 'Зарегистрироваться'
            )}
          </button>
        </form>

        <div className={styles.toggleSection}>
          <span className={styles.toggleText}>
            {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
          </span>
          <button onClick={toggleMode} className={styles.toggleBtn}>
            {isLogin ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </div>

        <div className={styles.divider}>
          <span>или</span>
        </div>

        <button 
          onClick={() => navigate('/tickets')} 
          className={styles.guestBtn}
        >
          Оставить заявку без регистрации
        </button>

        <button 
          onClick={() => navigate('/auth')} 
          className={styles.engineerBtn}
        >
          Вход для инженеров
        </button>
      </div>
    </div>
  );
}
