import React, { useState } from 'react';

function Profile() {
    const [profileData, setProfileData] = useState({
        firstName: '',
        lastName: '',
        department: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfileData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Данные профиля обновлены:', profileData);
        // Логика отправки данных на сервер
    };

    return (
        <div className="container mt-5">
            <h1>Личный кабинет</h1>
            <form onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label htmlFor="firstName" className="form-label">Имя</label>
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
                    <label htmlFor="lastName" className="form-label">Фамилия</label>
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
                    <label htmlFor="department" className="form-label">Отдел</label>
                    <input
                        type="text"
                        className="form-control"
                        id="department"
                        name="department"
                        value={profileData.department}
                        onChange={handleChange}
                    />
                </div>
                <button type="submit" className="btn btn-primary">Сохранить</button>
            </form>
        </div>
    );
}

export default Profile;
