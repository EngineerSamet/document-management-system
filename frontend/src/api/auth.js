import axios from 'axios';
import { API_URL } from '../utils/constants';

const API = axios.create({
  baseURL: `${API_URL}/api/auth`,
});

// Yeniden deneme için yardımcı fonksiyon
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Request interceptor - token ekle
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - hataları yönet
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Hata detaylarını logla
    console.error('Auth API hatası:', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      message: error.message,
      responseData: error.response?.data
    });
    
    // Rate limit hatası (429) için yeniden deneme mekanizması
    if (error.response && error.response.status === 429 && !error.config._retryCount) {
      error.config._retryCount = 1;
      console.warn('Rate limit aşıldı, 1 saniye sonra yeniden deneniyor...');
      await sleep(1000);
      return API(error.config);
    }
    
    // Token süresi dolmuşsa
    if (error.response && error.response.status === 401) {
      // Oturum süresi doldu mesajını kontrol et
      const isTokenExpired = 
        error.response.data?.message?.toLowerCase().includes('token süresi doldu') ||
        error.response.data?.message?.toLowerCase().includes('token expired') ||
        error.name === 'TokenExpiredError';
      
      // Eğer token süresi dolmuşsa, localStorage'dan temizle ve login sayfasına yönlendir
      if (isTokenExpired) {
        console.warn('Token süresi dolmuş, oturum sonlandırılıyor');
        localStorage.removeItem('accessToken');
        
        // Anlık yönlendirmeyi önlemek için setTimeout kullan (300ms gecikme)
        setTimeout(() => {
          window.location.href = '/giris?session=expired';
        }, 300);
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

// Giriş işlemi
export const login = async (email, password) => {
  try {
    console.log('Login API çağrılıyor:', { email });
    
    // Rate limit hatalarını yönetmek için retry mekanizması
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        const response = await API.post('/login', { email, password });
        console.log('Login API yanıtı:', response);
        
        // Yanıt kontrolü
        if (!response || !response.data) {
          throw new Error('Sunucu yanıtı geçersiz');
        }
        
        // Token kontrolü - API yanıt yapısına göre düzeltildi
        if (!response.data.data || !response.data.data.token) {
          throw new Error('Token bulunamadı');
        }
        
        // Kullanıcı bilgileri kontrolü - API yanıt yapısına göre düzeltildi
        if (!response.data.data.user) {
          throw new Error('Kullanıcı bilgileri bulunamadı');
        }
        
        return response.data;
      } catch (err) {
        // Rate limit hatası ise yeniden dene
        if (err.response && err.response.status === 429 && retries < maxRetries - 1) {
          retries++;
          const delay = retries * 1000; // Her denemede daha uzun bekle
          console.warn(`Rate limit aşıldı, ${delay}ms sonra yeniden deneniyor (${retries}/${maxRetries})...`);
          await sleep(delay);
        } else {
          throw err; // Diğer hatalar veya son deneme için hatayı fırlat
        }
      }
    }
  } catch (error) {
    console.error('Login API hatası:', error);
    
    // Hata mesajını zenginleştir
    if (error.response) {
      console.error('Sunucu yanıtı:', error.response.data);
      error.serverMessage = error.response.data.message || 'Sunucu hatası';
    }
    
    throw error;
  }
};

// Kayıt işlemi
export const register = async (userData) => {
  const response = await API.post('/register', userData);
  return response.data;
};

// Şifremi unuttum
export const forgotPassword = async (email) => {
  const response = await API.post('/forgot-password', { email });
  return response.data;
};

// Şifre sıfırlama tokeninin geçerliliğini kontrol et
export const validateResetToken = async (token) => {
  const response = await API.get(`/reset-password/validate?token=${token}`);
  return response.data;
};

// Şifre sıfırlama
export const resetPassword = async (token, password) => {
  const response = await API.post('/reset-password', { token, password });
  return response.data;
};

// Token yenileme
export const refreshToken = async (refreshToken) => {
  const response = await API.post('/refresh-token', { refreshToken });
  return response.data;
};

// Kullanıcı bilgilerini getir
export const getMe = async (forceRefresh = false) => {
  // AbortController oluştur
  const controller = new AbortController();
  let timeoutId = null;
  
  try {
    console.log('Kullanıcı bilgileri getiriliyor (getMe)...');
    
    // Token kontrolü
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('Token bulunamadı, kullanıcı bilgileri alınamıyor');
      return { 
        status: 'error',
        data: { user: null },
        message: 'Token bulunamadı'
      };
    }
    
    // Son başarısız istekten bu yana yeterli zaman geçti mi kontrol et
    const lastFailedAttempt = localStorage.getItem('lastFailedAuthAttempt');
    const cooldownPeriod = 120000; // 2 dakika (daha uzun cooldown)
    
    // forceRefresh true ise cooldown kontrolünü atla
    if (lastFailedAttempt && !forceRefresh) {
      const timeSinceLastFailure = Date.now() - parseInt(lastFailedAttempt);
      if (timeSinceLastFailure < cooldownPeriod) {
        console.warn(`Auth API: Son başarısız denemeden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
        return { 
          status: 'cooldown',
          data: { user: null },
          message: 'Rate limit aşıldı, lütfen daha sonra tekrar deneyin'
        };
      }
    }
    
    // Timeout ayarla - 8 saniye sonra iptal et
    timeoutId = setTimeout(() => {
      controller.abort();
    }, 8000); // 8 saniye timeout (daha uzun süre)
    
    // API isteği gönder
    const response = await API.get('/me', {
      timeout: 8000, // 8 saniye timeout
      signal: controller.signal
    });
    
    // Timeout'u temizle
    clearTimeout(timeoutId);
    timeoutId = null;
    
    // Yanıt kontrolü
    if (!response || !response.data) {
      console.error('Geçersiz API yanıtı:', response);
      return { 
        status: 'error',
        data: { user: null },
        message: 'Sunucu yanıtı geçersiz'
      };
    }
    
    // Kullanıcı bilgileri kontrolü
    if (!response.data.data || !response.data.data.user) {
      console.error('Kullanıcı bilgileri bulunamadı:', response.data);
      return { 
        status: 'error',
        data: { user: null },
        message: 'Kullanıcı bilgileri bulunamadı'
      };
    }
    
    // Başarılı istek sonrası son başarısız deneme kaydını temizle
    localStorage.removeItem('lastFailedAuthAttempt');
    
    // Kullanıcı bilgilerini logla
    const { user } = response.data.data;
    console.log('Kullanıcı bilgileri başarıyla alındı:', {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    });
    
    return response.data;
  } catch (error) {
    // Timeout'u temizle (eğer hala aktifse)
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Timeout hatası veya iptal edilmiş istek kontrolü
    if (error.name === 'AbortError' || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      console.warn('Kullanıcı bilgileri getirme isteği zaman aşımına uğradı veya iptal edildi');
      localStorage.setItem('lastFailedAuthAttempt', Date.now().toString());
      
      return { 
        status: 'error',
        data: { user: null },
        message: 'İstek zaman aşımına uğradı'
      };
    }
    
    // Network hatası durumunda son başarısız deneme zamanını kaydet
    if (error.message === 'Network Error' || 
        error.code === 'ERR_NETWORK' || 
        error.code === 'ECONNABORTED' || 
        error.message?.includes('timeout') ||
        error.message?.includes('ERR_INSUFFICIENT_RESOURCES')) {
      localStorage.setItem('lastFailedAuthAttempt', Date.now().toString());
      console.warn('Network hatası nedeniyle kullanıcı bilgileri alınamadı, sonraki denemeler için cooldown uygulanacak');
    }
    
    // API hatalarını logla
    console.error('Auth API hatası:', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      message: error.message,
      responseData: error.response?.data
    });
    
    return { 
      status: 'error',
      data: { user: null },
      message: error.message || 'Kullanıcı bilgileri alınamadı'
    };
  }
};

// Profil güncelleme
export const updateProfile = async (userData) => {
  const response = await API.post('/update-profile', userData);
  return response.data;
};

// Çıkış yap
export const logout = async () => {
  const response = await API.post('/logout');
  return response.data;
};

// Varsayılan export - Geriye dönük uyumluluk için
const authApi = {
  login,
  register,
  forgotPassword,
  validateResetToken,
  resetPassword,
  refreshToken,
  getMe,
  updateProfile,
  logout
};

export default authApi;
