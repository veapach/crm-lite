import React, { useState } from 'react';

function Report() {
    const [reportData, setReportData] = useState({
        title: '',
        description: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setReportData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Отчет создан:', reportData);
        // Здесь добавим логику отправки данных на сервер позже
    };

    return (
        <div className="container mt-5">
            <h1>Создание отчета</h1>
            <form onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label htmlFor="title" className="form-label">Название отчета</label>
                    <input
                        type="text"
                        className="form-control"
                        id="title"
                        name="title"
                        value={reportData.title}
                        onChange={handleChange}
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="description" className="form-label">Описание отчета</label>
                    <textarea
                        className="form-control"
                        id="description"
                        name="description"
                        rows="3"
                        value={reportData.description}
                        onChange={handleChange}
                    ></textarea>
                </div>
                <button type="submit" className="btn btn-primary">Создать отчет</button>
            </form>
        </div>
    );
}

export default Report;
