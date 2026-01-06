import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '../../context/ClientAuthContext';
import styles from './ClientAuth.module.css';

const LOGO_SRC = '/assets/Логотип ВВ/ВкусВилл зеленый/Лого-ВкусВилл-зеленый.png';

// Функция форматирования телефона при вводе: +7 (919) 762-77-70
const formatPhoneInput = (value) => {
  // Убираем всё кроме цифр
  let digits = value.replace(/\D/g, '');
  
  // Если начинается с 8 или 7, заменяем на 7
  if (digits.startsWith('8')) {
    digits = '7' + digits.slice(1);
  }
  if (!digits.startsWith('7') && digits.length > 0) {
    digits = '7' + digits;
  }
  
  // Ограничиваем 11 цифрами
  digits = digits.slice(0, 11);
  
  // Форматируем
  if (digits.length === 0) return '';
  if (digits.length <= 1) return '+' + digits;
  if (digits.length <= 4) return '+' + digits[0] + ' (' + digits.slice(1);
  if (digits.length <= 7) return '+' + digits[0] + ' (' + digits.slice(1, 4) + ') ' + digits.slice(4);
  if (digits.length <= 9) return '+' + digits[0] + ' (' + digits.slice(1, 4) + ') ' + digits.slice(4, 7) + '-' + digits.slice(7);
  return '+' + digits[0] + ' (' + digits.slice(1, 4) + ') ' + digits.slice(4, 7) + '-' + digits.slice(7, 9) + '-' + digits.slice(9, 11);
};

// Функция нормализации телефона (для отправки на сервер)
const normalizePhone = (phone) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return '+7' + digits.slice(1);
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return '+' + digits;
  }
  if (digits.length === 10) {
    return '+7' + digits;
  }
  return phone;
};

// Валидация телефона
const isValidPhone = (phone) => {
  const normalized = normalizePhone(phone);
  return /^\+7\d{10}$/.test(normalized);
};

// Валидация email
const isValidEmail = (email) => {
  if (!email) return true; // Не обязательное поле
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function ClientAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    login: '',
    email: '',
    password: '',
    fullName: '',
    phone: '',
    position: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useClientAuth();

  // Валидация полей в реальном времени
  const validateField = (name, value) => {
    switch (name) {
      case 'fullName':
        if (!value.trim()) return 'ФИО обязательно';
        if (value.trim().length < 2) return 'ФИО слишком короткое';
        return '';
      case 'phone':
        if (!value.trim()) return 'Телефон обязателен';
        if (!isValidPhone(value)) return 'Формат: +7XXXXXXXXXX';
        return '';
      case 'email':
        if (value && !isValidEmail(value)) return 'Некорректный email';
        return '';
      case 'password':
        if (!value) return 'Пароль обязателен';
        if (value.length < 6) return 'Минимум 6 символов';
        return '';
      case 'login':
        if (!value.trim()) return 'Введите телефон или email';
        return '';
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Форматирование телефона при вводе
    let newValue = value;
    if (name === 'phone') {
      newValue = formatPhoneInput(value);
    }
    // Форматирование для поля login если вводится телефон
    if (name === 'login') {
      const digits = value.replace(/\D/g, '');
      // Если начинается с цифры или +, форматируем как телефон
      if (digits.length > 0 && (value.startsWith('+') || value.startsWith('7') || value.startsWith('8') || /^\d/.test(value))) {
        newValue = formatPhoneInput(value);
      }
    }
    
    setForm({ ...form, [name]: newValue });
    setError('');
    
    // Валидация в реальном времени если поле уже было тронуто
    if (touched[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: validateField(name, newValue)
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setFieldErrors(prev => ({
      ...prev,
      [name]: validateField(name, value)
    }));
  };

  // Валидация всей формы
  const validateForm = () => {
    const errors = {};
    if (!isLogin) {
      errors.fullName = validateField('fullName', form.fullName);
      errors.phone = validateField('phone', form.phone);
      errors.email = validateField('email', form.email);
      errors.password = validateField('password', form.password);
    } else {
      errors.login = validateField('login', form.login);
      errors.password = validateField('password', form.password);
    }
    setFieldErrors(errors);
    setTouched({ fullName: true, phone: true, email: true, password: true, login: true });
    return !Object.values(errors).some(err => err);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await login(form.login, form.password);
      } else {
        if (!form.phone || !form.password || !form.fullName) {
          setError('Заполните обязательные поля');
          setLoading(false);
          return;
        }
        result = await register({
          ...form,
          phone: normalizePhone(form.phone)
        });
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
    setFieldErrors({});
    setTouched({});
    setForm({
      login: '',
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
                  className={`${styles.formInput} ${fieldErrors.fullName && touched.fullName ? styles.inputError : ''}`}
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Введите ваше имя"
                />
                {fieldErrors.fullName && touched.fullName && (
                  <span className={styles.fieldError}>{fieldErrors.fullName}</span>
                )}
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Телефон *</label>
                  <input
                    className={`${styles.formInput} ${fieldErrors.phone && touched.phone ? styles.inputError : ''}`}
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="+7..."
                  />
                  {fieldErrors.phone && touched.phone && (
                    <span className={styles.fieldError}>{fieldErrors.phone}</span>
                  )}
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

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email</label>
                <input
                  className={`${styles.formInput} ${fieldErrors.email && touched.email ? styles.inputError : ''}`}
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="example@mail.ru (необязательно)"
                />
                {fieldErrors.email && touched.email && (
                  <span className={styles.fieldError}>{fieldErrors.email}</span>
                )}
              </div>
            </>
          )}

          {isLogin ? (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Телефон или Email *</label>
              <input
                className={`${styles.formInput} ${fieldErrors.login && touched.login ? styles.inputError : ''}`}
                type="text"
                name="login"
                value={form.login}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="+7... или example@mail.ru"
              />
              {fieldErrors.login && touched.login && (
                <span className={styles.fieldError}>{fieldErrors.login}</span>
              )}
            </div>
          ) : null}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Пароль *</label>
            <input
              className={`${styles.formInput} ${fieldErrors.password && touched.password ? styles.inputError : ''}`}
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Введите пароль (минимум 6 символов)"
            />
            {fieldErrors.password && touched.password && (
              <span className={styles.fieldError}>{fieldErrors.password}</span>
            )}
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
