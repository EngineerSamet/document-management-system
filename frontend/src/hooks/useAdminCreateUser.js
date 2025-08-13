import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as adminApi from '../api/admin';
import { useNotification } from './useNotification';

/**
 * Admin tarafından yeni kullanıcı oluşturma işlemlerini yönetmek için hook
 * @returns {Object} Kullanıcı oluşturma işlemleri ve durumları
 */
export const useAdminCreateUser = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [testUserPassword, setTestUserPassword] = useState(null); // Test kullanıcısı şifresi
  const { errorToast } = useNotification();
  const navigate = useNavigate();

  /**
   * Yeni kullanıcı oluşturur
   * @param {Object} userData - Kullanıcı verileri (firstName, lastName, email, role, department, position)
   * @returns {Promise<Object>} İşlem sonucu
   */
  const createUser = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);
      setTestUserPassword(null); // Önceki test şifresini temizle
      
      // API isteği gönder - Yeni email doğrulama endpoint'ini kullan
      const response = await adminApi.createUser({
        ...userData,
        // Şifre alanı artık gerekli değil, email doğrulama sistemi kullanılacak
        password: userData.password || Math.random().toString(36).slice(-10) // Geçici şifre (eğer verilmezse)
      });
      
      // Test kullanıcısı şifresini kontrol et ve kaydet
      if (response.testPassword) {
        setTestUserPassword(response.testPassword);
      }
      
      setLoading(false);
      return {
        success: true,
        data: response.data,
        testPassword: response.testPassword // Test şifresini döndür
      };
    } catch (err) {
      setLoading(false);
      
      // Hata mesajını belirle
      let errorMessage = 'Kullanıcı oluşturulurken bir hata oluştu';
      
      // API hata mesajını kullan (varsa)
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Hata koduna göre özel mesajlar
      if (err.response?.status === 401) {
        errorMessage = 'Oturum süresi dolmuş veya geçersiz';
        // Oturum hatası varsa login sayfasına yönlendir
        setTimeout(() => {
          navigate('/giris', { replace: true });
        }, 500);
      } else if (err.response?.status === 403) {
        errorMessage = 'Bu işlem için admin yetkisi gerekli';
      } else if (err.response?.status === 409) {
        errorMessage = 'Bu e-posta adresi ile kayıtlı bir kullanıcı zaten var';
      } else if (err.response?.status === 400) {
        errorMessage = 'Geçersiz kullanıcı bilgileri. Lütfen tüm alanları kontrol ediniz';
      }
      
      setError(errorMessage);
      errorToast(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }, [navigate, errorToast]);

  return {
    createUser,
    loading,
    error,
    testUserPassword // Test kullanıcısı şifresini döndür
  };
}; 