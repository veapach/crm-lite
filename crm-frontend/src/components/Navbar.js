import React from 'react';
import { Link } from 'react-router-dom';

function Navbar() {
    return (
        <div>
            <nav className="navbar navbar-expand-lg navbar-light bg-light">
                <div className="container">
                    <Link className="navbar-brand" to="/">CRM</Link>
                    <div className="collapse navbar-collapse" id="navbarNav">
                        <ul className="navbar-nav ml-auto">
                            <li className="nav-item">
                                <Link className="nav-link" to="/report">Отчеты</Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link" to="/certificates">Сертификаты</Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link" to="/profile">Профиль</Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <nav className="navbar navbar-light fixed-bottom bg-light">
                <div className="container">
                    <ul className="navbar-nav w-100">
                        <li className="nav-item col text-center">
                            <Link className="nav-link" to="/report">Отчеты</Link>
                        </li>
                        <li className="nav-item col text-center">
                            <Link className="nav-link" to="/certificates">Сертификаты</Link>
                        </li>
                        <li className="nav-item col text-center">
                            <Link className="nav-link" to="/profile">Профиль</Link>
                        </li>
                    </ul>
                </div>
            </nav>
        </div>
    );
}

export default Navbar;
