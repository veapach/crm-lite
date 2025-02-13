import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Certificates() {
    const [files, setFiles] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [newName, setNewName] = useState("");

    useEffect(() => {
        fetchCertificates();
    }, []);

    const fetchCertificates = async () => {
        try {
            const response = await axios.get('http://localhost:8080/api/certificates');
            setCertificates(response.data);
        } catch (error) {
            console.error("Ошибка при загрузке сертификатов", error);
        }
    };

    const handleFileChange = (e) => {
        setFiles(e.target.files);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (files.length === 0) return;

        const formData = new FormData();
        Array.from(files).forEach(file => formData.append("files", file));

        try {
            await axios.post('http://localhost:8080/api/upload', formData);
            fetchCertificates();
        } catch (error) {
            console.error("Ошибка при загрузке файлов", error);
        }
    };

    const handleDownload = (filename) => {
        window.location.href = `http://localhost:8080/api/download/${filename}`;
    };

    const handleRename = async (oldName) => {
        if (!newName.trim()) return;

        try {
            await axios.put('http://localhost:8080/api/rename', { oldName, newName });
            setNewName("");
            fetchCertificates();
        } catch (error) {
            console.error("Ошибка при переименовании файла", error);
        }
    };

    const handleDelete = async (filename) => {
        try {
            await axios.delete(`http://localhost:8080/api/delete/${filename}`);
            fetchCertificates();
        } catch (error) {
            console.error("Ошибка при удалении файла", error);
        }
    };

    return (
        <div className="container mt-5">
            <h1>Хранилище сертификатов</h1>

            <form onSubmit={handleUpload} className="mb-4">
                <div className="mb-3">
                    <label htmlFor="files" className="form-label">Выберите файлы</label>
                    <input
                        type="file"
                        className="form-control"
                        id="files"
                        multiple
                        onChange={handleFileChange}
                    />
                </div>
                <button type="submit" className="btn btn-primary">Загрузить</button>
            </form>

            <h3>Загруженные сертификаты</h3>
            <ul className="list-group">
                {certificates.map((certificate, index) => (
                    <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                        <span>{certificate}</span>
                        <div>
                            <input
                                type="text"
                                placeholder="Новое имя"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="form-control d-inline-block w-auto"
                            />
                            <button className="btn btn-warning btn-sm mx-2" onClick={() => handleRename(certificate)}>Переименовать</button>
                            <button className="btn btn-success btn-sm" onClick={() => handleDownload(certificate)}>Скачать</button>
                            <button className="btn btn-danger btn-sm ms-2" onClick={() => handleDelete(certificate)}>Удалить</button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default Certificates;
