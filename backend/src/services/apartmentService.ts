import { Apartment, SearchParams } from '../types/index.js';
import apartments from '../data/apartments.json' with { type: 'json' };

const apartmentList: Apartment[] = apartments as Apartment[];

/**
 * Заменяет английские термины на русские для естественной озвучки
 */
export function localizeForVoice(text: string): string {
  let result = text;
  
  // Районы Дубая
  result = result.replace(/\bDubai Marina\b/gi, 'Дубай Марина');
  result = result.replace(/\bDowntown Dubai\b/gi, 'Даунтаун Дубай');
  result = result.replace(/\bPalm Jumeirah\b/gi, 'Палм Джумейра');
  result = result.replace(/\bJBR\b/gi, 'Джибиар');
  result = result.replace(/\bBusiness Bay\b/gi, 'Бизнес Бей');
  result = result.replace(/\bDubai Hills\b/gi, 'Дубай Хиллс');
  result = result.replace(/\bJVC\b/gi, 'ДжиВиСи');
  result = result.replace(/\bCreek Harbour\b/gi, 'Крик Харбур');
  result = result.replace(/\bDIFC\b/gi, 'ДИФС');
  
  // Преобразуем числа перед "миллион" в текст: "до 3 миллионов" -> "до трёх миллионов"
  result = result.replace(/(\d+)\s*(миллион[а-я]*)/gi, (match, num, millionForm) => {
    const numInt = parseInt(num);
    const numText = convertNumberToText(numInt);
    return `${numText} ${millionForm}`;
  });
  
  // Числа с единицами - более естественное произношение
  // "1.8 млн" -> "один и восемь десятых миллиона"
  result = result.replace(/(\d+)\.(\d+)\s*млн/gi, (match, int, dec) => {
    const intText = convertNumberToText(parseInt(int));
    return `${intText} и ${dec} десятых миллиона`;
  });
  
  // "65 м²" -> "65 квадратных метров"
  result = result.replace(/(\d+)\s*м²/g, (match, num) => {
    return `${num} квадратных метров`;
  });
  
  // Единицы и параметры
  result = result.replace(/\bm\b/g, 'метров');
  result = result.replace(/\bm²\b/g, 'квадратных метров');
  result = result.replace(/\bAED\b/gi, 'дирха́м');
  result = result.replace(/\bmlb\b/gi, 'миллионов');
  result = result.replace(/\bmillion\b/gi, 'миллионов');
  
  // Популярные фразы
  result = result.replace(/\bfurnished\b/gi, 'меблирована');
  result = result.replace(/\bunfurnished\b/gi, 'без мебели');
  result = result.replace(/\bbeach\b/gi, 'пляж');
  result = result.replace(/\bpool\b/gi, 'бассейн');
  result = result.replace(/\bgym\b/gi, 'спортзал');
  result = result.replace(/\bparking\b/gi, 'парковка');
  result = result.replace(/\bview\b/gi, 'вид');
  result = result.replace(/\bterrace\b/gi, 'терраса');
  result = result.replace(/\bbalcony\b/gi, 'балкон');
  
  return result;
}

// Конвертирует число в текстовое числительное (helper для localizeForVoice)
function convertNumberToText(num: number): string {
  const units: { [key: number]: string } = {
    0: 'ноль', 1: 'один', 2: 'два', 3: 'три', 4: 'четыре', 5: 'пять',
    6: 'шесть', 7: 'семь', 8: 'восемь', 9: 'девять', 10: 'десять',
    11: 'одиннадцать', 12: 'двенадцать', 13: 'тринадцать', 14: 'четырнадцать', 15: 'пятнадцать',
    16: 'шестнадцать', 17: 'семнадцать', 18: 'восемнадцать', 19: 'девятнадцать', 20: 'двадцать'
  };
  
  if (units[num]) {
    return units[num];
  }
  
  // Для чисел больше 20 возвращаем как есть
  return num.toString();
}

export function searchApartments(params: SearchParams, excludeIds: string[] = []): Apartment[] {
  return apartmentList.filter(apt => {
    // Исключаем уже показанные
    if (excludeIds.includes(apt.id)) return false;

    // Фильтр по району
    if (params.district) {
      const searchDistrict = params.district.toLowerCase();
      const aptDistrict = apt.district.toLowerCase();
      if (!aptDistrict.includes(searchDistrict) && !searchDistrict.includes(aptDistrict)) {
        return false;
      }
    }

    // Фильтр по цене
    if (params.price_min && apt.price < params.price_min) return false;
    if (params.price_max && apt.price > params.price_max) return false;

    // Фильтр по площади
    if (params.area_min && apt.area < params.area_min) return false;
    if (params.area_max && apt.area > params.area_max) return false;

    // Фильтр по этажу
    if (params.floor_min && apt.floor < params.floor_min) return false;
    if (params.floor_max && apt.floor > params.floor_max) return false;

    return true;
  }).sort((a, b) => {
    // Сортировка по релевантности (ближе к середине диапазона цены)
    if (params.price_min && params.price_max) {
      const targetPrice = (params.price_min + params.price_max) / 2;
      const diffA = Math.abs(a.price - targetPrice);
      const diffB = Math.abs(b.price - targetPrice);
      return diffA - diffB;
    }
    return 0;
  });
}

export function getApartmentById(id: string): Apartment | undefined {
  return apartmentList.find(apt => apt.id === id);
}

export function getAllDistricts(): string[] {
  return [...new Set(apartmentList.map(apt => apt.district))];
}

// Получить статистику по району
export function getDistrictStats(district: string): { minPrice: number; maxPrice: number; count: number } | null {
  const searchDistrict = district.toLowerCase();
  const districtApartments = apartmentList.filter(apt => {
    const aptDistrict = apt.district.toLowerCase();
    return aptDistrict.includes(searchDistrict) || searchDistrict.includes(aptDistrict);
  });
  
  if (districtApartments.length === 0) return null;
  
  const prices = districtApartments.map(apt => apt.price);
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    count: districtApartments.length
  };
}

export function formatApartmentForVoice(apt: Apartment): string {
  const priceMillions = (apt.price / 1000000).toFixed(1);
  
  // Правильные падежи и склонения для натурального звучания
  const areaText = `${apt.area} ${getSquareMetersForm(apt.area)}`;
  const floorText = getOrdinalFloor(apt.floor);
  const priceText = formatPriceForVoice(parseFloat(priceMillions));
  
  let description = `${apt.district}, ${areaText}, ${floorText}, ${priceText}`;
  return localizeForVoice(description);
}

// Конвертирует число этажа в порядковое числительное
function getOrdinalFloor(floor: number): string {
  const ordinals: { [key: number]: string } = {
    1: 'первый', 2: 'второй', 3: 'третий', 4: 'четвёртый', 5: 'пятый',
    6: 'шестой', 7: 'седьмой', 8: 'восьмой', 9: 'девятый', 10: 'десятый',
    11: 'одиннадцатый', 12: 'двенадцатый', 13: 'тринадцатый', 14: 'четырнадцатый', 15: 'пятнадцатый',
    16: 'шестнадцатый', 17: 'семнадцатый', 18: 'восемнадцатый', 19: 'девятнадцатый', 20: 'двадцатый',
    25: 'двадцать пятый', 30: 'тридцатый', 45: 'сорок пятый', 50: 'пятидесятый'
  };
  
  if (ordinals[floor]) {
    return `${ordinals[floor]} этаж`;
  }
  
  // Для остальных чисел используем числительное + этаж
  return `${floor} этаж`;
}

// Конвертирует число в текстовое числительное
function numberToText(num: number): string {
  const units: { [key: number]: string } = {
    0: 'ноль', 1: 'один', 2: 'два', 3: 'три', 4: 'четыре', 5: 'пять',
    6: 'шесть', 7: 'семь', 8: 'восемь', 9: 'девять', 10: 'десять',
    11: 'одиннадцать', 12: 'двенадцать', 13: 'тринадцать', 14: 'четырнадцать', 15: 'пятнадцать',
    16: 'шестнадцать', 17: 'семнадцать', 18: 'восемнадцать', 19: 'девятнадцать', 20: 'двадцать'
  };
  
  if (units[num]) {
    return units[num];
  }
  
  // Для чисел больше 20 возвращаем как есть
  return num.toString();
}

// Форматирует цену для естественного произношения
function formatPriceForVoice(millions: number): string {
  // Если дробное число (например 2.1)
  if (millions % 1 !== 0) {
    const parts = millions.toFixed(1).split('.');
    const intPart = parseInt(parts[0]);
    const decPart = parts[1];
    const intText = numberToText(intPart);
    return `${intText} и ${decPart} миллиона дирха́м`;
  }
  
  // Для целых чисел используем правильную форму
  const intNum = Math.floor(millions);
  const numText = numberToText(intNum);
  return `${numText} ${getMillionForm(millions)}`;
}

// Правильная форма "квадратный метр"
function getSquareMetersForm(num: number): string {
  const lastDigit = num % 10;
  const lastTwo = num % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'квадратных метров';
  if (lastDigit === 1) return 'квадратный метр';
  if (lastDigit >= 2 && lastDigit <= 4) return 'квадратных метра';
  return 'квадратных метров';
}

// Правильная форма "миллион"
function getMillionForm(num: number): string {
  // Для дробных чисел всегда "миллиона" (2.5 миллиона)
  if (num % 1 !== 0) return 'миллиона дирха́м';
  
  const lastDigit = Math.floor(num) % 10;
  const lastTwo = Math.floor(num) % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'миллионов дирха́м';
  if (lastDigit === 1) return 'миллион дирха́м';
  if (lastDigit >= 2 && lastDigit <= 4) return 'миллиона дирха́м';
  return 'миллионов дирха́м';
}

export function formatApartmentShort(apt: Apartment): string {
  const priceMillions = (apt.price / 1000000).toFixed(1);
  return `${apt.district}, ${apt.area} м², ${apt.floor} этаж, ${priceMillions} млн AED`;
}

