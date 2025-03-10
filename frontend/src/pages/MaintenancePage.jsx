import React from 'react';
import { FaTools, FaTelegram, FaArrowRight } from 'react-icons/fa';

function MaintenancePage() {
  return (
    <div className="container text-center mt-5">
      <div className="maintenance-container p-5 bg-light rounded shadow-sm">
        <FaTools className="text-warning mb-4" style={{ fontSize: '5rem' }} />
        
        <h1 className="mb-4">Сайт временно недоступен</h1>
        
        <div className="alert alert-warning mb-4">
          <p className="lead mb-0">
            Ведутся технические работы. Приносим извинения за временные неудобства.
          </p>
        </div>
        
        <div className="mt-4 mb-5">
          <p className="fs-5">
            Для создания отчета можете пока воспользоваться ботом в Телеграм:
          </p>
          
          <a 
            href="https://t.me/act_for_vv_bot" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-primary btn-lg mt-3"
            style={{ textDecoration: 'none' }}
          >
            <FaTelegram className="me-2" />
            @act_for_vv_bot
            <FaArrowRight className="ms-2" />
          </a>
        </div>
        
        <div className="mt-4">
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-outline-secondary"
          >
            Проверить доступность сайта
          </button>
        </div>
      </div>
    </div>
  );
}

export default MaintenancePage; 