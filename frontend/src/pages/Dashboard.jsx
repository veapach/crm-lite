import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Dashboard.css';

function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user && user.department === 'Админ';

  return (
    <div className="container mt-5">
      <div className="dashboard-header">
        <h1>Личный кабинет</h1>
        <p>Добро пожаловать, {user?.firstName} {user?.lastName}!</p>
      </div>

      <div className="dashboard-sections">
        <div className="row">
          <div className="col-md-4 mb-4">
            <div className="dashboard-card">
              <h3>Новый отчет</h3>
              <p>Создайте новый отчет о выполненных работах</p>
              <Link to="/new-report" className="btn btn-primary">Создать отчет</Link>
            </div>
          </div>
          
          <div className="col-md-4 mb-4">
            <div className="dashboard-card">
              <h3>Мои отчеты</h3>
              <p>Просмотр и управление вашими отчетами</p>
              <Link to="/reports" className="btn btn-primary">Перейти к отчетам</Link>
            </div>
          </div>
          
          <div className="col-md-4 mb-4">
            <div className="dashboard-card">
              <h3>Файлы</h3>
              <p>Управление файлами и документами</p>
              <Link to="/files" className="btn btn-primary">Перейти к файлам</Link>
            </div>
          </div>
          
          {/* <div className="col-md-4 mb-4">
            <div className="dashboard-card">
              <h3>Заявки</h3>
              <p>Просмотр и управление заявками</p>
              <Link to="/requests" className="btn btn-primary">Перейти к заявкам</Link>
            </div>
          </div> */}
          
          <div className="col-md-4 mb-4">
            <div className="dashboard-card">
              <h3>Профиль</h3>
              <p>Управление вашим профилем и настройками</p>
              <Link to="/profile" className="btn btn-primary">Перейти в профиль</Link>
            </div>
          </div>
          
          {isAdmin && (
            <div className="col-md-4 mb-4">
              <div className="dashboard-card admin-card">
                <h3>Администрирование</h3>
                <p>Управление пользователями и системой</p>
                <Link to="/admin" className="btn btn-danger">Панель администратора</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
