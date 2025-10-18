import React, { useState } from 'react';
import { YMaps, Map, Placemark, GeolocationControl, ZoomControl } from 'react-yandex-maps';
import { Modal, Button, Spinner } from 'react-bootstrap';

function TicketsMap({ tickets }) {
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [mapCenter, setMapCenter] = useState([55.751574, 37.573856]); // Москва по умолчанию
  const [ticketsWithCoords, setTicketsWithCoords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Функция для парсинга адреса из формата "цифры_адрес"
  const parseAddress = (address) => {
    if (!address) return '';
    // Удаляем цифры и подчеркивание в начале (например, "123_улица Ленина" -> "улица Ленина")
    const match = address.match(/^\d+_(.+)$/);
    return match ? match[1] : address;
  };

  // Используем встроенный геокодер Яндекс.Карт через window.ymaps
  const geocodeAddressYmaps = (address, ymaps) => {
    return new Promise((resolve) => {
      const parsedAddress = parseAddress(address);
      ymaps.geocode(parsedAddress, { results: 1 })
        .then(result => {
          const firstGeoObject = result.geoObjects.get(0);
          if (firstGeoObject) {
            const coords = firstGeoObject.geometry.getCoordinates();
            resolve(coords);
          } else {
            resolve(null);
          }
        })
        .catch(error => {
          console.error('Ошибка геокодирования:', error);
          resolve(null);
        });
    });
  };

  const handlePlacemarkClick = (ticket) => {
    setSelectedTicket(ticket);
    setShowModal(true);
  };

  const handleOpenRoute = () => {
    if (selectedTicket && selectedTicket.coordinates) {
      const [lat, lng] = selectedTicket.coordinates;
      // Открываем Яндекс.Карты с маршрутом
      window.open(`https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`, '_blank');
    }
    setShowModal(false);
  };

  const onMapLoad = async (ymaps) => {
    setIsLoading(true);
    const ticketsWithCoordinates = [];

    for (const ticket of tickets) {
      const coords = await geocodeAddressYmaps(ticket.address, ymaps);
      if (coords) {
        ticketsWithCoordinates.push({
          ...ticket,
          coordinates: coords,
          parsedAddress: parseAddress(ticket.address)
        });
      }
    }

    setTicketsWithCoords(ticketsWithCoordinates);
    
    // Если есть координаты, центрируем карту на первой точке
    if (ticketsWithCoordinates.length > 0) {
      setMapCenter(ticketsWithCoordinates[0].coordinates);
    }
    
    setIsLoading(false);
  };

  // Определяем цвет метки в зависимости от статуса заявки
  const getPlacemarkColor = (status) => {
    switch (status) {
      case 'Не назначено':
        return 'red';
      case 'В работе':
        return 'yellow';
      case 'Завершено':
        return 'green';
      default:
        return 'blue';
    }
  };

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <YMaps
        query={{
          apikey: '29294198-6cdc-4996-a870-01e89b830f3e', // Замените на ваш API ключ
          lang: 'ru_RU',
        }}
      >
        <Map
          defaultState={{
            center: mapCenter,
            zoom: 10,
          }}
          width="100%"
          height="100%"
          modules={['geocode']}
          onLoad={onMapLoad}
        >
          <GeolocationControl options={{ float: 'left' }} />
          <ZoomControl options={{ float: 'right' }} />
          
          {isLoading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              zIndex: 1000
            }}>
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Загрузка...</span>
              </Spinner>
              <div>Геокодирование адресов...</div>
            </div>
          )}

          {ticketsWithCoords.map((ticket) => (
            <Placemark
              key={ticket.id}
              geometry={ticket.coordinates}
              options={{
                preset: `islands#${getPlacemarkColor(ticket.status)}Icon`,
                iconColor: getPlacemarkColor(ticket.status),
              }}
              properties={{
                hintContent: ticket.parsedAddress,
                balloonContent: `
                  <div>
                    <strong>Заявка #${ticket.id}</strong><br/>
                    <strong>Адрес:</strong> ${ticket.parsedAddress}<br/>
                    <strong>Описание:</strong> ${ticket.description}<br/>
                    <strong>Статус:</strong> ${ticket.status}<br/>
                    <strong>Инженер:</strong> ${ticket.engineerName || 'Не назначен'}
                  </div>
                `,
              }}
              onClick={() => handlePlacemarkClick(ticket)}
            />
          ))}
        </Map>
      </YMaps>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Заявка #{selectedTicket?.id}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTicket && (
            <div>
              <p><strong>Адрес:</strong> {selectedTicket.parsedAddress}</p>
              <p><strong>Дата:</strong> {selectedTicket.date}</p>
              <p><strong>ФИО:</strong> {selectedTicket.fullName}</p>
              <p><strong>Должность:</strong> {selectedTicket.position}</p>
              <p><strong>Контакт:</strong> {selectedTicket.contact}</p>
              <p><strong>Описание:</strong> {selectedTicket.description}</p>
              <p><strong>Статус:</strong> {selectedTicket.status}</p>
              <p><strong>Инженер:</strong> {selectedTicket.engineerName || 'Не назначен'}</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Закрыть
          </Button>
          <Button variant="primary" onClick={handleOpenRoute}>
            Построить маршрут
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Легенда */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        zIndex: 1000
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Легенда:</div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: 'red', borderRadius: '50%', marginRight: '8px' }}></div>
          <span>Не назначено</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: 'yellow', borderRadius: '50%', marginRight: '8px' }}></div>
          <span>В работе</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: 'green', borderRadius: '50%', marginRight: '8px' }}></div>
          <span>Завершено</span>
        </div>
      </div>
    </div>
  );
}

export default TicketsMap;
