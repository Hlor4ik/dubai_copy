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
  
  // Единицы и параметры
  result = result.replace(/\bm\b/g, 'квадратных метров');
  result = result.replace(/\bm²\b/g, 'квадратных метров');
  result = result.replace(/\bAED\b/g, 'дирхам');
  result = result.replace(/\bmlb\b/gi, 'млн');
  result = result.replace(/\bmillion\b/gi, 'миллион');
  
  // Популярные фразы
  result = result.replace(/\bfurnished\b/gi, 'меблирована');
  result = result.replace(/\bunfurnished\b/gi, 'неуставленная');
  result = result.replace(/\bbeach\b/gi, 'пляж');
  result = result.replace(/\bpool\b/gi, 'бассейн');
  result = result.replace(/\bgym\b/gi, 'спортзал');
  result = result.replace(/\bparking\b/gi, 'парковка');
  result = result.replace(/\bview\b/gi, 'вид');
  result = result.replace(/\bterrace\b/gi, 'терраса');
  result = result.replace(/\bbalcony\b/gi, 'балкон');
  
  return result;
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
  const floorText = `${apt.floor} ${getFloorForm(apt.floor)}`;
  const priceText = `${priceMillions} ${getMillionForm(parseFloat(priceMillions))}`;
  
  let description = `${apt.district}, ${areaText}, ${floorText}, ${priceText}`;
  return localizeForVoice(description);
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

// Правильная форма "этаж"
function getFloorForm(num: number): string {
  return 'этаж'; // "15 этаж" звучит естественнее чем "15-й этаж" в быстрой речи
}

// Правильная форма "миллион"
function getMillionForm(num: number): string {
  // Для дробных чисел всегда "миллиона" (2.5 миллиона)
  if (num % 1 !== 0) return 'миллиона дирхам';
  
  const lastDigit = Math.floor(num) % 10;
  const lastTwo = Math.floor(num) % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'миллионов дирхам';
  if (lastDigit === 1) return 'миллион дирхам';
  if (lastDigit >= 2 && lastDigit <= 4) return 'миллиона дирхам';
  return 'миллионов дирхам';
}

export function formatApartmentShort(apt: Apartment): string {
  const priceMillions = (apt.price / 1000000).toFixed(1);
  return `${apt.district}, ${apt.area} м², ${apt.floor} этаж, ${priceMillions} млн AED`;
}

