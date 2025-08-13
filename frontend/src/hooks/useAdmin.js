import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as adminApi from '../api/admin';
import { useAuth } from './useAuth';

/**
 * Admin işlemlerini yönetmek için hook
 * @returns {Object} Admin işlemleri
 */
export const useAdmin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user, isAuthenticated, isInitialized } = useAuth();
  const navigate = useNavigate();
  
  // Component mount olduğunda admin yetkisi kontrolü yap
  useEffect(() => {
    // Uygulama henüz başlatılmamışsa bekle
    if (!isInitialized) {
      console.log('Admin hook: Auth durumu henüz başlatılmadı, bekleniyor...');
      return;
    }
    
    // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
    if (!isAuthenticated && !loading) {
      console.warn('Admin hook: Kullanıcı giriş yapmamış');
      // Yönlendirme yapmadan önce biraz bekle (500ms)
      const timer = setTimeout(() => {
        navigate('/giris', { replace: true });
      }, 500);
      
      return () => clearTimeout(timer);
    }
    
    // Kullanıcı admin değilse dashboard'a yönlendir
    if (user && user.role !== 'ADMIN' && !loading) {
      console.warn('Admin hook: Kullanıcı admin değil:', user.role);
      // Yönlendirme yapmadan önce biraz bekle (500ms)
      const timer = setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, navigate, loading, isAuthenticated, isInitialized]);

  /**
   * Sistem istatistiklerini getirir
   * @param {boolean} forceRefresh - Önbelleği bypass edip her zaman yeni veri getir
   * @returns {Promise<Object>} Sistem istatistikleri
   */
  const getSystemStats = useCallback(async (forceRefresh = false) => {
    try {
      // Kullanıcı admin değilse veri çekme
      if (!isAuthenticated || !user || user.role !== 'ADMIN') {
        console.warn('Admin olmayan kullanıcı, sistem istatistikleri alınamıyor');
        return {
          userCount: 5, // Varsayılan değerler
          documentCount: 10,
          pendingDocuments: 3,
          approvalFlowCount: 2,
          error: 'Admin yetkisi gerekli'
        };
      }
      
      // Son başarısız API isteğinden bu yana yeterli zaman geçti mi kontrol et
      const lastFailedApiCall = localStorage.getItem('lastFailedAdminStatsCall');
      const cooldownPeriod = 10000; // 10 saniye (daha kısa cooldown)
      
      if (lastFailedApiCall && !forceRefresh) {
        const timeSinceLastFailure = Date.now() - parseInt(lastFailedApiCall);
        if (timeSinceLastFailure < cooldownPeriod) {
          console.warn(`useAdmin: Son başarısız denemeden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
          
          // Önbellekteki verileri kontrol et
          const cachedStats = localStorage.getItem('cachedSystemStats');
          if (cachedStats) {
            try {
              const parsedStats = JSON.parse(cachedStats);
              parsedStats.status = 'cached';
              parsedStats.error = 'Cooldown süresi dolmadı, önbellek verisi kullanılıyor';
              return parsedStats;
            } catch (e) {
              console.warn('Önbellek verisi bozuk, varsayılan değerler kullanılıyor');
            }
          }
          
          return {
            status: 'cooldown',
            userCount: 5, // Varsayılan değerler
            documentCount: 10,
            pendingDocuments: 3,
            approvalFlowCount: 2,
            error: 'Cooldown süresi dolmadı, varsayılan değerler kullanılıyor'
          };
        }
      }
      
      setLoading(true);
      setError(null);
      
      console.log('useAdmin: Sistem istatistikleri alınıyor...');
      
      // API isteği gönder - admin.js'deki getSystemStats fonksiyonunu kullan
      // Bu fonksiyon kendi içinde AbortController ve timeout kullanıyor
      const response = await adminApi.getSystemStats(forceRefresh);
      
      setLoading(false);
      
      // Hata kontrolü
      if (response.error) {
        console.warn('useAdmin: Sistem istatistikleri alınamadı:', response.error);
        setError(response.error);
      } else {
        console.log('useAdmin: Sistem istatistikleri başarıyla alındı');
        // Başarılı API çağrısı, cooldown kaydını temizle
        localStorage.removeItem('lastFailedAdminStatsCall');
      }
      
      // Başarılı yanıtı döndür
      return response;
    } catch (err) {
      // Hata detaylarını kaydet ve log'la
      console.error('useAdmin: Sistem istatistikleri alınamadı:', err);
      
      // Network hatası durumunda son başarısız deneme zamanını kaydet
      if (err.message === 'Network Error' || 
          err.code === 'ERR_NETWORK' || 
          err.code === 'ECONNABORTED' || 
          err.message?.includes('timeout') ||
          err.message?.includes('ERR_INSUFFICIENT_RESOURCES') ||
          err.name === 'AbortError' ||
          err.name === 'CanceledError' ||
          err.code === 'ERR_CANCELED') {
        
        localStorage.setItem('lastFailedAdminStatsCall', Date.now().toString());
        console.warn('Network hatası nedeniyle sistem istatistikleri alınamadı, sonraki denemeler için cooldown uygulanacak');
      }
      
      // Hata mesajını belirle
      let errorMessage = 'Sistem istatistikleri yüklenirken bir hata oluştu';
      
      // API hata mesajını kullan (varsa)
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setLoading(false);
      
      // Önbellekteki verileri kontrol et
      const cachedStats = localStorage.getItem('cachedSystemStats');
      if (cachedStats) {
        try {
          const parsedStats = JSON.parse(cachedStats);
          parsedStats.status = 'cached';
          parsedStats.error = errorMessage;
          return parsedStats;
        } catch (e) {
          console.warn('Önbellek verisi bozuk, varsayılan değerler kullanılıyor');
        }
      }
      
      // Varsayılan değerlerle yanıt döndür
      return {
        status: 'error',
        userCount: 5, // Varsayılan değerler
        documentCount: 10,
        pendingDocuments: 3,
        approvalFlowCount: 2,
        error: errorMessage
      };
    }
  }, [isAuthenticated, user, isInitialized]);

  /**
   * Tüm onay akışlarını siler
   * @returns {Promise<Object>} İşlem sonucu
   */
  const deleteAllApprovalFlows = useCallback(async () => {
    try {
      // Kullanıcı admin değilse işlemi engelle
      if (!isAuthenticated || !user || user.role !== 'ADMIN') {
        console.warn('Admin olmayan kullanıcı, onay akışları silinemiyor');
        throw new Error('Bu işlem için admin yetkisi gerekli');
      }
      
      setLoading(true);
      setError(null);
      
      console.log('useAdmin: Tüm onay akışları siliniyor...');
      
      // API isteği gönder
      const response = await adminApi.deleteAllApprovalFlows();
      
      console.log('useAdmin: Tüm onay akışları başarıyla silindi');
      
      // Silme işleminden sonra hemen istatistikleri yenile
      // forceRefresh=true ile önbelleği bypass et
      await getSystemStats(true);
      
      setLoading(false);
      
      return response;
    } catch (err) {
      console.error('useAdmin: Onay akışları silinirken hata:', err);
      
      // Hata mesajını belirle
      let errorMessage = 'Onay akışları silinirken bir hata oluştu';
      
      // API hata mesajını kullan (varsa)
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, [isAuthenticated, user, getSystemStats]);

  return {
    loading,
    error,
    getSystemStats,
    deleteAllApprovalFlows
  };
}; 