import axios from 'axios';
import { API_URL } from '../utils/constants';

/**
 * Log API fonksiyonları
 */

/**
 * Sistem loglarını getirir
 * @param {Object} params - Sorgu parametreleri
 * @returns {Promise<Object>} Log kayıtları ve sayfalama bilgileri
 */
export const getLogs = async (params = {}) => {
  try {
    const response = await axios.get(`${API_URL}/api/logs`, {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Log kayıtlarını getirme hatası:', error);
    throw error;
  }
};

/**
 * Son etkinlikleri getirir
 * @param {Number} limit - Maksimum kayıt sayısı
 * @returns {Promise<Array>} Etkinlik listesi
 */
export const getRecentActivities = async (limit = 10) => {
  try {
    const response = await axios.get(`${API_URL}/api/logs/recent?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
    
    return response.data.activities;
  } catch (error) {
    console.error('Son etkinlikleri getirme hatası:', error);
    throw error;
  }
};