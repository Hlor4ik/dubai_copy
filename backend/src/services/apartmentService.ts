import { Apartment, SearchParams } from '../types/index.js';
import apartments from '../data/apartments.json' with { type: 'json' };

const apartmentList: Apartment[] = apartments as Apartment[];

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

export function formatApartmentForVoice(apt: Apartment): string {
  const priceMillions = (apt.price / 1000000).toFixed(1);
  // Короткое описание для быстрой озвучки
  return `${apt.district}, ${apt.area} квадратов, ${apt.floor} этаж, ${priceMillions} миллионов.`;
}

export function formatApartmentShort(apt: Apartment): string {
  const priceMillions = (apt.price / 1000000).toFixed(1);
  return `${apt.district}, ${apt.area} м², ${apt.floor} этаж, ${priceMillions} млн AED`;
}

