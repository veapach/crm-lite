// Маппинг технических адресов на реальные адреса с координатами
// Формат: "техническийАдрес": { address: "Человеческий адрес", coordinates: [широта, долгота] }

export const addressMapping = {
  // Пример (можете заполнить своими данными)
  '1234_Москва_ул_Ленина_1': {
    address: 'Москва, ул. Ленина, д. 1',
    coordinates: [55.751244, 37.618423], // Координаты Москвы (Красная площадь)
  },

  // Добавьте свои маппинги ниже в формате:
  // "техАдрес": {
  //   address: "Реальный адрес",
  //   coordinates: [широта, долгота]
  // },
};

// Функция для получения данных адреса по техническому адресу
export const getAddressData = (technicalAddress) => {
  if (!technicalAddress) return null;

  // Попробуем найти точное совпадение
  if (addressMapping[technicalAddress]) {
    return addressMapping[technicalAddress];
  }

  // Если не нашли, вернем null
  return null;
};
