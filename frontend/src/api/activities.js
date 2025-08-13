import axios from 'axios';
import { API_URL } from '../utils/constants';

/**
 * Etkinlik API fonksiyonları
 */

/**
 * Son etkinlikleri getirir
 * @param {Object} options - Sorgu seçenekleri
 * @param {Number} options.limit - Maksimum kayıt sayısı
 * @param {String} options.entityType - Varlık tipi filtresi (opsiyonel)
 * @param {String} options.action - İşlem tipi filtresi (opsiyonel)
 * @returns {Promise<Array>} Etkinlik listesi
 */
export const getRecentActivities = async (options = {}) => {
  try {
    const { limit = 10, entityType, action } = options;
    
    // Query parametreleri oluştur
    const params = new URLSearchParams();
    params.append('limit', limit);
    
    if (entityType) {
      params.append('entityType', entityType);
    }
    
    if (action) {
      params.append('action', action);
    }
    
    const response = await axios.get(`${API_URL}/api/activities/recent?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
    
    return response.data.data.activities;
  } catch (error) {
    console.error('Son etkinlikleri getirme hatası:', error);
    throw error;
  }
};

/**
 * Dashboard için özet etkinlik verileri getirir
 * @returns {Promise<Array>} Etkinlik listesi
 */
export const getDashboardActivities = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/activities/dashboard`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
    
    return response.data.data.activities;
  } catch (error) {
    console.error('Dashboard etkinliklerini getirme hatası:', error);
    throw error;
  }
};

/**
 * Kullanıcının son etkinliklerini getirir
 * @param {String} userId - Kullanıcı ID
 * @param {Number} limit - Maksimum kayıt sayısı
 * @returns {Promise<Array>} Etkinlik listesi
 */
export const getUserActivities = async (userId, limit = 10) => {
  try {
    const response = await axios.get(`${API_URL}/api/activities/user/${userId}?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
    
    return response.data.data.activities;
  } catch (error) {
    console.error('Kullanıcı etkinliklerini getirme hatası:', error);
    throw error;
  }
}; 