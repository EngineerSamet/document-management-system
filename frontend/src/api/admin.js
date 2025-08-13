import axios from 'axios';
import { API_URL } from '../utils/constants';

/**
 * API istekleri için gecikme fonksiyonu
 * @param {number} ms - Milisaniye cinsinden gecikme süresi
 * @returns {Promise} - Belirtilen süre sonra resolve olan promise
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Admin API'si için axios instance
 */
const API = axios.create({
  baseURL: `${API_URL}/api/admin`,
});

// Request interceptor - token ekle
API.interceptors.request.use(
  (config) => {
    // Local storage'dan token al
    const token = localStorage.getItem('accessToken');
    
    // Debug: İstek bilgilerini ve token durumunu logla
    console.debug('Admin API isteği:', {
      url: config.url,
      method: config.method,
      hasToken: !!token,
      tokenFirstChars: token ? `${token.substring(0, 10)}...` : null
    });
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('Admin API isteği için token bulunamadı');
      // Token yoksa hata fırlat ve isteği iptal et
      return Promise.reject(new Error('Token bulunamadı'));
    }
    
    return config;
  },
  (error) => {
    console.error('Admin API istek hatası:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - hataları yönet
API.interceptors.response.use(
  (response) => {
    // Debug: Başarılı yanıt bilgilerini logla
    console.debug('Admin API başarılı yanıt:', {
      url: response.config.url,
      status: response.status,
      statusText: response.statusText
    });
    return response;
  },
  (error) => {
    // Hata detaylarını logla
    console.error('Admin API hatası:', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      message: error.message,
      responseData: error.response?.data
    });
    
    // Token süresi dolmuşsa
    if (error.response && error.response.status === 401) {
      // Oturum süresi doldu mesajını kontrol et
      const isTokenExpired = 
        error.response.data?.message?.toLowerCase().includes('token süresi doldu') ||
        error.response.data?.message?.toLowerCase().includes('token expired') ||
        error.response.data?.code === 'TOKEN_EXPIRED' ||
        error.name === 'TokenExpiredError';
      
      // Token yoksa veya geçersizse
      const isTokenInvalid = 
        error.response.data?.code === 'INVALID_TOKEN' ||
        error.response.data?.code === 'MISSING_TOKEN' ||
        error.response.data?.code === 'MISSING_AUTH_HEADER';
      
      // Eğer token süresi dolmuşsa, localStorage'dan temizle ve login sayfasına yönlendir
      if (isTokenExpired || isTokenInvalid) {
        console.warn(`Token ${isTokenExpired ? 'süresi dolmuş' : 'geçersiz'}, oturum sonlandırılıyor`);
        localStorage.removeItem('accessToken');
        
        // Anlık yönlendirmeyi önlemek için setTimeout kullan (500ms gecikme)
        setTimeout(() => {
          window.location.href = '/giris?session=expired';
        }, 500);
      } else {
        // Diğer 401 hataları için sadece log
        console.warn('Yetkilendirme hatası (401):', error.response?.data?.message);
      }
    }
    
    // Yetki hatası (403)
    if (error.response && error.response.status === 403) {
      console.warn('Yetki hatası (403):', error.response?.data?.message);
      // Burada sadece log yapıyoruz, otomatik yönlendirme yapmıyoruz
    }
    
    return Promise.reject(error);
  }
);

/**
 * Sistem istatistiklerini getirir
 * @param {boolean} forceRefresh - Önbellekteki verileri kullanmayı atlayıp her zaman yeni istek yap
 * @returns {Promise<Object>} Sistem istatistikleri
 */
export const getSystemStats = async (forceRefresh = false) => {
  // AbortController oluştur
  const controller = new AbortController();
  let timeoutId = null;
  
  try {
    // Token kontrolü - token yoksa hata fırlatma, boş veri döndür
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('Sistem istatistiklerini getirme hatası: Token bulunamadı');
      return {
        status: 'error',
        userCount: 0,
        documentCount: 0,
        pendingDocuments: 0,
        approvalFlowCount: 0,
        error: 'Kullanıcı giriş yapmamış'
      };
    }
    
    // Son başarısız API isteğinden bu yana yeterli zaman geçti mi kontrol et
    const lastFailedApiCall = localStorage.getItem('lastFailedStatsApiCall');
    const cooldownPeriod = 10000; // 10 saniye (daha kısa cooldown)
    
    if (lastFailedApiCall && !forceRefresh) {
      const timeSinceLastFailure = Date.now() - parseInt(lastFailedApiCall);
      if (timeSinceLastFailure < cooldownPeriod) {
        console.warn(`Stats API: Son başarısız denemeden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
        // Varsayılan değerlerle yanıt döndür
        return {
          status: 'cooldown',
          userCount: 0,
          documentCount: 0,
          pendingDocuments: 0,
          approvalFlowCount: 0,
          error: 'Cooldown süresi dolmadı, varsayılan değerler kullanılıyor'
        };
      }
    }
    
    // Daha önceki başarılı çağrı zamanını kontrol et
    // Çok sık çağrı yapmayı engelle
    const lastSuccessfulStatsFetch = localStorage.getItem('lastSuccessfulStatsFetch');
    const minFetchInterval = 10000; // 10 saniye (daha kısa fetch aralığı)
    
    // Sayfa yenileme kontrolü - F5 ile sayfanın yenilenmesi veya forceRefresh durumunda önbellek kontrolünü atla
    const isPageRefresh = sessionStorage.getItem('isPageRefresh') === 'true';
    
    // Sayfa yenileme durumunu sıfırla
    if (isPageRefresh) {
      sessionStorage.removeItem('isPageRefresh');
      console.log('Sayfa yenilendi veya forceRefresh=true, önbellek kontrolü atlanıyor ve yeni veri getiriliyor');
    } else if (lastSuccessfulStatsFetch && !forceRefresh) {
      const timeSinceLastSuccess = Date.now() - parseInt(lastSuccessfulStatsFetch);
      if (timeSinceLastSuccess < minFetchInterval) {
        console.log(`Stats API: Son başarılı sistem istatistikleri çağrısından bu yana sadece ${Math.round(timeSinceLastSuccess/1000)} saniye geçti, yeni istek yapılmıyor`);
        // En son alınan verileri localStorage'dan getir veya varsayılan değerler kullan
        const cachedStats = localStorage.getItem('cachedSystemStats');
        if (cachedStats) {
          try {
            return JSON.parse(cachedStats);
          } catch (e) {
            console.warn('Önbellek verisi bozuk, varsayılan değerler kullanılıyor');
          }
        }
        
        // Önbellekte veri yoksa varsayılan değerler döndür
        return {
          status: 'cached',
          userCount: 0,
          documentCount: 0,
          pendingDocuments: 0,
          approvalFlowCount: 0,
          error: 'Minimum istek aralığı dolmadı, önbellek verisi kullanılıyor'
        };
      }
    }
    
    console.log('Sistem istatistikleri alınıyor...');
    
    // Timeout ayarla - 8 saniye sonra iptal et
    timeoutId = setTimeout(() => {
      controller.abort();
    }, 8000); // 8 saniye timeout (daha uzun süre)
    
    // API isteği gönder
    const response = await API.get('/stats', {
      timeout: 8000, // 8 saniye timeout
      signal: controller.signal
    });
    
    // Timeout'u temizle
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Başarılı API çağrısı, cooldown kaydını temizle
    localStorage.removeItem('lastFailedStatsApiCall');
    
    // Başarılı çağrı zamanını kaydet
    localStorage.setItem('lastSuccessfulStatsFetch', Date.now().toString());
    
    console.log('Sistem istatistikleri başarıyla alındı:', response.data);
    
    // API yanıt yapısını kontrol et ve doğru veriyi döndür
    if (response.data && response.data.data) {
      // API yanıtını önbelleğe kaydetmeden önce düzenle
      const statsData = {
        status: 'success',
        data: response.data.data,
        timestamp: Date.now()
      };
      
      // Verileri önbelleğe kaydet
      localStorage.setItem('cachedSystemStats', JSON.stringify(statsData));
      return statsData;
    } else if (response.data && response.data.status === 'success') {
      // Alternatif API yanıt yapısı
      const statsData = {
        status: 'success',
        data: response.data,
        timestamp: Date.now()
      };
      
      // Verileri önbelleğe kaydet
      localStorage.setItem('cachedSystemStats', JSON.stringify(statsData));
      return statsData;
    } else {
      console.warn('API yanıt yapısı beklenen formatta değil:', response.data);
      // Hata durumunda varsayılan değerlerle yanıt döndür
      return {
        status: 'error',
        userCount: 0,
        documentCount: 0,
        pendingDocuments: 0,
        approvalFlowCount: 0,
        error: 'API yanıt yapısı beklenen formatta değil'
      };
    }
  } catch (error) {
    // Timeout'u temizle (eğer hala aktifse)
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Timeout hatası veya iptal edilmiş istek kontrolü
    if (error.name === 'AbortError' || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      console.warn('Sistem istatistikleri getirme isteği zaman aşımına uğradı veya iptal edildi');
      localStorage.setItem('lastFailedStatsApiCall', Date.now().toString());
      
      // Önbellekteki verileri kontrol et
      const cachedStats = localStorage.getItem('cachedSystemStats');
      if (cachedStats) {
        try {
          const parsedStats = JSON.parse(cachedStats);
          parsedStats.status = 'cached';
          parsedStats.error = 'İstek zaman aşımına uğradı, önbellek verisi kullanılıyor';
          return parsedStats;
        } catch (e) {
          console.warn('Önbellek verisi bozuk, varsayılan değerler kullanılıyor');
        }
      }
      
      return {
        status: 'error',
        userCount: 0,
        documentCount: 0,
        pendingDocuments: 0,
        approvalFlowCount: 0,
        error: 'İstek zaman aşımına uğradı'
      };
    }
    
    // Network hatası durumunda son başarısız deneme zamanını kaydet
    if (error.message === 'Network Error' || 
        error.code === 'ERR_NETWORK' || 
        error.code === 'ECONNABORTED' || 
        error.message?.includes('timeout') ||
        error.message?.includes('ERR_INSUFFICIENT_RESOURCES')) {
      
      localStorage.setItem('lastFailedStatsApiCall', Date.now().toString());
      console.warn('Network hatası nedeniyle sistem istatistikleri alınamadı, sonraki denemeler için cooldown uygulanacak');
    }
    
    // Diğer hatalar için detaylı log
    console.error('Sistem istatistiklerini getirme hatası:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      url: error.config?.url,
      data: error.response?.data
    });
    
    // Önbellekteki verileri kontrol et
    const cachedStats = localStorage.getItem('cachedSystemStats');
    if (cachedStats) {
      try {
        const parsedStats = JSON.parse(cachedStats);
        parsedStats.status = 'cached';
        parsedStats.error = error.message || 'Sistem istatistikleri alınamadı, önbellek verisi kullanılıyor';
        return parsedStats;
      } catch (e) {
        console.warn('Önbellek verisi bozuk, varsayılan değerler kullanılıyor');
      }
    }
    
    // Hata durumunda varsayılan değerlerle yanıt döndür
    return {
      status: 'error',
      userCount: 0,
      documentCount: 0,
      pendingDocuments: 0,
      approvalFlowCount: 0,
      error: error.message || 'Sistem istatistikleri alınamadı'
    };
  }
}; 

/**
 * Yeni kullanıcı oluşturur (sadece admin yetkisi ile)
 * @param {Object} userData - Kullanıcı verileri (firstName, lastName, email, password, role, department, position)
 * @returns {Promise<Object>} Oluşturulan kullanıcı bilgileri
 */
export const createUser = async (userData) => {
  try {
    console.log('Yeni kullanıcı oluşturuluyor:', userData.email);
    
    // Yeni endpoint'i kullan - email doğrulama sistemine uygun
    const response = await axios.post(
      `${API_URL}/api/users/admin/create`,
      userData,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      }
    );
    
    console.log('Kullanıcı başarıyla oluşturuldu:', response.data);
    
    // Test kullanıcısı için şifre bilgisini kontrol et
    const isTestEmail = userData.email && userData.email.endsWith('@example.com');
    const testPassword = response.data?.data?.user?.testPassword;
    
    if (isTestEmail && testPassword) {
      console.log(`📝 Test kullanıcısı şifresi: ${testPassword}`);
      console.log('Bu şifreyi not alın, daha sonra görüntülenemeyecektir!');
      
      // Test şifresini yanıta ekle
      return {
        ...response.data,
        testPassword
      };
    }
    
    return response.data;
  } catch (error) {
    // Hata detaylarını logla
    console.error('Kullanıcı oluşturma hatası:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      data: error.response?.data
    });
    
    // Hatayı fırlat
    throw error;
  }
}; 

/**
 * Tüm kullanıcıları getirir (debug amaçlı, filtresiz)
 * @returns {Promise<Object>} Tüm kullanıcılar
 */
export const getAllUsersDebug = async () => {
  try {
    console.log('Debug: Tüm kullanıcıları getirme isteği gönderiliyor...');
    
    // Son başarısız API isteğinden bu yana yeterli zaman geçti mi kontrol et
    const lastFailedApiCall = localStorage.getItem('lastFailedDebugApiCall');
    const cooldownPeriod = 60000; // 60 saniye (daha uzun cooldown)
    
    if (lastFailedApiCall) {
      const timeSinceLastFailure = Date.now() - parseInt(lastFailedApiCall);
      if (timeSinceLastFailure < cooldownPeriod) {
        console.warn(`Debug API: Son başarısız denemeden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
        // Varsayılan değerlerle yanıt döndür
        return { 
          status: 'cooldown',
          data: { 
            users: [
              // Varsayılan kullanıcı verileri
              {
                _id: '1',
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@example.com',
                role: 'ADMIN',
                isActive: true,
                isVerified: true,
                department: 'Yönetim',
                position: 'Sistem Yöneticisi',
                lastLogin: new Date().toISOString()
              }
            ] 
          },
          message: 'Cooldown süresi dolmadı, varsayılan veriler kullanılıyor'
        };
      }
    }
    
    // API isteği gönder - timeout ekle ve abortController kullan
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 3000); // 3 saniye timeout
    
    // Admin debug endpoint'i kullan
    const response = await axios.get('/api/admin/users/debug', {
      timeout: 3000, // 3 saniye
      signal: abortController.signal
    });
    
    // Timeout'u temizle
    clearTimeout(timeoutId);
    
    // Başarılı API çağrısı, cooldown kaydını temizle
    localStorage.removeItem('lastFailedDebugApiCall');
    
    console.log('Debug: Tüm kullanıcılar başarıyla alındı:', response.data);
    return response.data;
  } catch (error) {
    // Network hatası durumunda son başarısız deneme zamanını kaydet
    if (error.message === 'Network Error' || 
        error.code === 'ERR_NETWORK' || 
        error.code === 'ECONNABORTED' || 
        error.message.includes('timeout') ||
        error.message.includes('ERR_INSUFFICIENT_RESOURCES') ||
        error.name === 'AbortError' ||
        error.name === 'CanceledError') {
      
      localStorage.setItem('lastFailedDebugApiCall', Date.now().toString());
      console.warn('Network hatası nedeniyle debug kullanıcı verisi alınamadı, sonraki denemeler için cooldown uygulanacak');
    }
    
    console.error('Debug: Kullanıcıları getirme hatası:', error);
    
    // Hata durumunda varsayılan değerlerle yanıt döndür
    return { 
      status: 'error',
      data: { 
        users: [
          // Varsayılan kullanıcı verileri
          {
            _id: '1',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
            role: 'ADMIN',
            isActive: true,
            isVerified: true,
            department: 'Yönetim',
            position: 'Sistem Yöneticisi',
            lastLogin: new Date().toISOString()
          }
        ] 
      },
      message: 'Kullanıcı verileri alınamadı, varsayılan veriler kullanılıyor'
    };
  }
}; 

/**
 * Kullanıcıyı siler (sadece admin yetkisi ile)
 * @param {string} userId - Silinecek kullanıcının ID'si
 * @returns {Promise<Object>} İşlem sonucu
 */
export const deleteUser = async (userId) => {
  try {
    console.log(`Kullanıcı silme isteği gönderiliyor: ${userId}`);
    
    // Token kontrolü
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('Token bulunamadı');
      throw new Error('Kullanıcı giriş yapmamış');
    }
    
    // API isteği gönder
    const response = await axios.delete(
      `/api/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    console.log('Kullanıcı başarıyla silindi:', response.data);
    return response.data;
  } catch (error) {
    console.error('Kullanıcı silme hatası:', error);
    throw error;
  }
}; 

/**
 * Tüm onay akışlarını siler (sadece admin yetkisi ile)
 * @returns {Promise<Object>} İşlem sonucu
 */
export const deleteAllApprovalFlows = async () => {
  try {
    console.log('Tüm onay akışlarını silme isteği gönderiliyor');
    
    // Token kontrolü
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('Token bulunamadı');
      throw new Error('Kullanıcı giriş yapmamış');
    }
    
    // API isteği gönder
    const response = await axios.delete(`${API_URL}/api/admin/approval-flows/all`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('Tüm onay akışları başarıyla silindi:', response.data);
    
    // Önbelleği temizle - silme işlemlerinden sonra istatistiklerin güncel olmasını sağlar
    localStorage.removeItem('cachedSystemStats');
    localStorage.removeItem('lastSuccessfulStatsFetch');
    
    // Sayfa yenileme bayrağını ayarla - bir sonraki API çağrısının yeni veri getirmesini sağlar
    sessionStorage.setItem('isPageRefresh', 'true');
    
    return response.data;
  } catch (error) {
    console.error('Tüm onay akışlarını silme hatası:', error);
    
    // Hata mesajını ayıkla
    const errorMessage = error.response?.data?.message || 
                        error.message ||
                        'Onay akışları silinirken bir hata oluştu';
    
    // Hata nesnesini zenginleştir
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    enhancedError.status = error.response?.status;
    enhancedError.isAuthError = error.response?.status === 401;
    enhancedError.isPermissionError = error.response?.status === 403;
    
    throw enhancedError;
  }
}; 