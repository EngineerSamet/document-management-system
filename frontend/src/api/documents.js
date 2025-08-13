import axios from 'axios';
import { API_URL } from '../utils/constants';

/**
 * Belge API'si için axios instance
 * Open/Closed Principle: Yeni özellikler eklemek için mevcut kodu değiştirmek yerine genişletebiliriz
 */
const API = axios.create({
  baseURL: `${API_URL}/api/documents`,
});

/**
 * API istekleri için gecikme fonksiyonu
 * @param {number} ms - Milisaniye cinsinden gecikme süresi
 * @returns {Promise} - Belirtilen süre sonra resolve olan promise
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Yeniden deneme mantığı ile API çağrısı yapar
 * @param {Function} apiCall - API çağrısı yapan fonksiyon
 * @param {number} maxRetries - Maksimum deneme sayısı
 * @param {number} initialDelay - İlk deneme gecikmesi (ms)
 * @returns {Promise} - API çağrısı sonucu
 */
const withRetry = async (apiCall, maxRetries = 2, initialDelay = 2000) => {
  let retryCount = 0;
  let delayTime = initialDelay;
  
  // Son başarısız API isteğinden bu yana yeterli zaman geçti mi kontrol et
  const lastFailedApiCall = localStorage.getItem('lastFailedDocumentsApiCall');
  const cooldownPeriod = 60000; // 60 saniye (daha uzun cooldown)
  
  if (lastFailedApiCall) {
    const timeSinceLastFailure = Date.now() - parseInt(lastFailedApiCall);
    if (timeSinceLastFailure < cooldownPeriod) {
      console.warn(`Documents API: Son başarısız denemeden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
      // Hata fırlatmak yerine varsayılan bir değer döndür
      return { 
        data: { 
          status: 'cooldown',
          message: 'API çağrısı için cooldown süresi dolmadı',
          data: null
        } 
      };
    }
  }
  
  // AbortController oluştur ve timeout ayarla
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 5000); // 5 saniye timeout
  
  try {
    while (retryCount <= maxRetries) {
      try {
        // apiCall fonksiyonuna signal parametresi ekle
        const result = await apiCall(abortController.signal);
        
        // Timeout'u temizle
        clearTimeout(timeoutId);
        
        // Başarılı API çağrısı, cooldown kaydını temizle
        localStorage.removeItem('lastFailedDocumentsApiCall');
        
        return result;
      } catch (error) {
        // Timeout hatası kontrolü
        if (error.name === 'AbortError' || error.name === 'CanceledError') {
          console.warn('API isteği zaman aşımına uğradı');
          // Network hatası durumunda son başarısız deneme zamanını kaydet
          localStorage.setItem('lastFailedDocumentsApiCall', Date.now().toString());
          
          // Varsayılan bir değer döndür
          return { 
            data: { 
              status: 'timeout',
              message: 'API isteği zaman aşımına uğradı',
              data: null
            } 
          };
        }
        
        // Network hatası durumunda son başarısız deneme zamanını kaydet
        if (error.message === 'Network Error' || 
            error.code === 'ERR_NETWORK' || 
            error.code === 'ECONNABORTED' || 
            error.message.includes('timeout') ||
            error.message.includes('ERR_INSUFFICIENT_RESOURCES')) {
          localStorage.setItem('lastFailedDocumentsApiCall', Date.now().toString());
          console.warn('Network hatası nedeniyle belge verisi alınamadı, sonraki denemeler için cooldown uygulanacak');
          
          // Son deneme ise varsayılan bir değer döndür
          if (retryCount >= maxRetries) {
            return { 
              data: { 
                status: 'error',
                message: error.message || 'Network hatası',
                data: null
              } 
            };
          }
        }
        
        retryCount++;
        
        // Son deneme değilse tekrar dene
        if (retryCount <= maxRetries) {
          // Rate limit hatası (429) için özel işlem
          if (error.response && error.response.status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            if (retryAfter) {
              delayTime = parseInt(retryAfter) * 1000;
            } else {
              delayTime *= 2; // Exponential backoff
            }
          } else {
            // Diğer hatalar için exponential backoff
            delayTime *= 2;
          }
          
          console.warn(`API çağrısı başarısız (${retryCount}/${maxRetries}), ${delayTime}ms sonra tekrar deneniyor...`, error.message);
          await delay(delayTime);
        } else {
          // Son deneme de başarısız oldu, varsayılan bir değer döndür
          return { 
            data: { 
              status: 'error',
              message: error.message || 'API çağrısı başarısız',
              data: null
            } 
          };
        }
      }
    }
  } finally {
    // Her durumda timeout'u temizle
    clearTimeout(timeoutId);
  }
};

// Request interceptor - token ekle
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // Debug log ekle
      console.log(`API isteği gönderiliyor: ${config.method?.toUpperCase()} ${config.url}, Token: ${token.substring(0, 10)}...`);
    } else {
      console.warn(`API isteği gönderiliyor: ${config.method?.toUpperCase()} ${config.url}, Token bulunamadı!`);
    }
    return config;
  },
  (error) => {
    console.error('API istek hatası:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - hataları yönet
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Token süresi dolmuşsa
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/giris?session=expired';
    }
    return Promise.reject(error);
  }
);

// ObjectId doğrulama fonksiyonu
const isValidObjectId = (id) => {
  const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  return objectIdPattern.test(id);
};

// Belge oluşturma
export const createDocument = async (documentData) => {
  try {
    console.log('createDocument API çağrıldı');
    
    // 1. FormData kontrolü
    if (!(documentData instanceof FormData)) {
      console.error('createDocument: documentData FormData tipinde olmalıdır');
      throw new Error('Belge verileri FormData tipinde olmalıdır');
    }
    
    // 2. Zorunlu alanların kontrolü
    const requiredFields = ['title', 'file'];
    const missingFields = [];
    
    // Her zorunlu alanı kontrol et
    for (const field of requiredFields) {
      const value = documentData.get(field);
      if (!value) {
        missingFields.push(field);
        console.error(`createDocument: Eksik zorunlu alan: ${field}`);
      }
    }
    
    if (missingFields.length > 0) {
      const errorMessage = `Doğrulama hataları: ${missingFields.map(field => {
        switch(field) {
          case 'title': return 'Başlık zorunludur';
          case 'file': return 'Dosya zorunludur';
          default: return `${field} zorunludur`;
        }
      }).join(', ')}`;
      
      console.error(`createDocument: ${errorMessage}`);
      throw new Error(errorMessage);
    }
    
    // 3. Başlık kontrolü
    const title = documentData.get('title');
    if (title) {
      const trimmedTitle = title.trim();
      if (trimmedTitle.length < 3) {
        console.error(`createDocument: Başlık çok kısa: ${trimmedTitle.length} karakter`);
        throw new Error('Başlık en az 3 karakter olmalıdır');
      } else if (trimmedTitle.length > 200) {
        console.error(`createDocument: Başlık çok uzun: ${trimmedTitle.length} karakter`);
        throw new Error('Başlık en fazla 200 karakter olabilir');
      }
      
      // Başlığı trim edilmiş haliyle güncelle
      documentData.delete('title');
      documentData.append('title', trimmedTitle);
    }
    
    // 4. Dosya kontrolü
    const file = documentData.get('file');
    if (file) {
      // Dosya boyutu kontrolü (10MB)
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxFileSize) {
        console.error(`createDocument: Dosya boyutu çok büyük: ${file.size} bytes`);
        throw new Error('Dosya boyutu 10MB\'dan küçük olmalıdır');
      }
      
      // Dosya tipi kontrolü
      if (file.type !== 'application/pdf') {
        console.error(`createDocument: Geçersiz dosya türü: ${file.type}`);
        throw new Error('Sadece PDF dosyaları yüklenebilir');
      }
    }
    
    // 5. Etiketleri işle
    if (documentData.get('tags')) {
      try {
        // Etiketlerin string olarak gönderildiğinden emin ol
        const tagsValue = documentData.get('tags');
        let tags;
        
        if (typeof tagsValue === 'string') {
          // Eğer zaten string ise ve JSON formatında değilse parse et
          if (tagsValue.startsWith('[') && tagsValue.endsWith(']')) {
            // Zaten JSON formatında - dokunma
            console.log('Etiketler zaten JSON formatında:', tagsValue);
            
            // JSON formatını doğrula ve geçerli olduğundan emin ol
            try {
              const parsedTags = JSON.parse(tagsValue);
              if (!Array.isArray(parsedTags)) {
                // JSON formatında ama dizi değil, düzelt
                documentData.delete('tags');
                documentData.append('tags', JSON.stringify([tagsValue]));
                console.log('Etiketler dizi formatına dönüştürüldü:', JSON.stringify([tagsValue]));
              }
            } catch (jsonError) {
              // JSON parse hatası, düzelt
              documentData.delete('tags');
              documentData.append('tags', JSON.stringify([tagsValue]));
              console.log('Geçersiz JSON formatı düzeltildi:', JSON.stringify([tagsValue]));
            }
          } else {
            // Virgülle ayrılmış etiketleri diziye çevir
            tags = tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            // FormData'dan mevcut tags'i sil ve JSON string olarak ekle
            documentData.delete('tags');
            documentData.append('tags', JSON.stringify(tags));
            console.log('Etiketler JSON formatına dönüştürüldü:', JSON.stringify(tags));
          }
        } else if (Array.isArray(tagsValue)) {
          // Eğer dizi ise JSON string'e dönüştür
          documentData.delete('tags');
          documentData.append('tags', JSON.stringify(tagsValue));
          console.log('Etiket dizisi JSON formatına dönüştürüldü:', JSON.stringify(tagsValue));
        }
      } catch (error) {
        // Hata durumunda varsayılan boş dizi gönder
        console.error(`createDocument: Etiketleri ayrıştırma hatası: ${error.message}`);
        documentData.delete('tags');
        documentData.append('tags', JSON.stringify([]));
        console.log('Hata nedeniyle boş etiket dizisi gönderiliyor');
      }
    }
    
    // 6. İsteği gönder
    console.log('Belge oluşturma isteği gönderiliyor...');
    
    const response = await API.post('/', documentData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    console.log('Belge oluşturma cevabı:', response);
    return response;
  } catch (error) {
    console.error('Belge oluşturma hatası:', error);
    
    // Hata mesajını ayıkla
    let errorMessage = 'Belge oluşturulurken bir hata oluştu';
    let statusCode = 500;
    let fieldErrors = {};
    
    if (error.response) {
      // Sunucu yanıtı ile dönen hatalar
      statusCode = error.response.status;
      
      // Hata mesajını al
      if (error.response.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      // Alan bazlı hataları al
      if (error.response.data?.errors) {
        // Hata nesnesi bir dizi olabilir
        if (Array.isArray(error.response.data.errors)) {
          fieldErrors = {};
          // Dizi içindeki her bir hata nesnesini işle
          error.response.data.errors.forEach((err, index) => {
            if (typeof err === 'object' && err !== null) {
              // Nesne içindeki her bir alan için hata mesajı oluştur
              if (err.param) {
                fieldErrors[err.param] = err.msg;
              } else {
                Object.entries(err).forEach(([key, value]) => {
                  fieldErrors[key] = value;
                });
              }
            } else {
              // Doğrudan değeri kullan
              fieldErrors[index] = String(err);
            }
          });
        } 
        // Hata nesnesi bir obje olabilir
        else if (typeof error.response.data.errors === 'object' && error.response.data.errors !== null) {
          fieldErrors = error.response.data.errors;
        }
        
        // Alan bazlı hataları mesaja ekle
        if (Object.keys(fieldErrors).length > 0) {
          const fieldErrorMessages = Object.entries(fieldErrors).map(([field, message]) => {
            // Mesaj bir nesne ise, toString() ile dönüştür
            const errorValue = typeof message === 'object' ? JSON.stringify(message) : message;
            return `${field}: ${errorValue}`;
          });
          errorMessage = `${errorMessage}: ${fieldErrorMessages.join(', ')}`;
        }
      }
      
      console.error(`Sunucu hatası (${statusCode}):`, errorMessage, fieldErrors);
    } else if (error.request) {
      // İstek yapıldı ama yanıt alınamadı
      errorMessage = 'Sunucu yanıt vermiyor, lütfen bağlantınızı kontrol edin';
      console.error('Sunucu yanıt vermiyor:', error.request);
    } else if (error.message) {
      // İstek oluşturulurken bir hata oluştu
      errorMessage = error.message;
      console.error('İstek hatası:', error.message);
    }
    
    // Hata nesnesini zenginleştir
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    enhancedError.status = statusCode;
    enhancedError.response = error.response;
    enhancedError.isAuthError = statusCode === 401;
    enhancedError.isPermissionError = statusCode === 403;
    enhancedError.isNotFoundError = statusCode === 404;
    enhancedError.isValidationError = statusCode === 400 || errorMessage.includes('Doğrulama');
    enhancedError.isNetworkError = !error.response && error.request;
    enhancedError.fieldErrors = fieldErrors;
    
    throw enhancedError;
  }
};

// Belge detaylarını getirme
export const getDocument = async (documentId) => {
  const response = await API.get(`/${documentId}`);
  return response.data;
};

// Belge güncelleme
export const updateDocument = async (documentId, documentData) => {
  const response = await API.put(`/${documentId}`, documentData);
  return response.data;
};

// Belge silme
export const deleteDocument = async (documentId) => {
  const response = await API.delete(`/${documentId}`);
  return response.data;
};

// Kullanıcının belgelerini getirme
export const getUserDocuments = async (page = 1, limit = 10) => {
  const response = await API.get(`/user/documents?page=${page}&limit=${limit}`);
  return response.data;
};

// Belgeyi onaylama
export const approveDocument = async (documentId, comment = '') => {
  try {
    console.log(`Belge onaylama işlemi başlatıldı - Belge ID: ${documentId}`);
    
    // Belge ID kontrolü
    if (!documentId) {
      console.error('approveDocument: documentId parametresi gereklidir');
      throw new Error('Belge ID parametresi gereklidir');
    }
    
    if (!isValidObjectId(documentId)) {
      console.error(`approveDocument: Geçersiz belge ID formatı: ${documentId}`);
      throw new Error('Geçersiz belge ID formatı');
    }
    
    // Token kontrolü
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('approveDocument: Token bulunamadı');
      throw new Error('Oturum bulunamadı, lütfen tekrar giriş yapın');
    }
    
    // API isteği gönder
    const response = await API.post(`/${documentId}/approve`, { comment: comment || '' });
    
    console.log('Belge onaylama cevabı:', response);
    return response.data;
  } catch (error) {
    console.error('Belge onaylama hatası:', error);
    
    // Hata mesajını ayıkla
    const errorMessage = error.response?.data?.message || 
                        error.message ||
                        'Belge onaylanırken bir hata oluştu';
    
    // Hata nesnesini zenginleştir
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    enhancedError.status = error.response?.status;
    enhancedError.isAuthError = error.response?.status === 401;
    enhancedError.isPermissionError = error.response?.status === 403;
    enhancedError.isNotFoundError = error.response?.status === 404;
    enhancedError.isValidationError = error.response?.status === 400;
    
    throw enhancedError;
  }
};

// Belgeyi reddet
export const rejectDocument = async (documentId, comment = '') => {
  try {
    console.log(`Belge reddetme işlemi başlatıldı - Belge ID: ${documentId}`);
    
    // Belge ID kontrolü
    if (!documentId) {
      console.error('rejectDocument: documentId parametresi gereklidir');
      throw new Error('Belge ID parametresi gereklidir');
    }
    
    if (!isValidObjectId(documentId)) {
      console.error(`rejectDocument: Geçersiz belge ID formatı: ${documentId}`);
      throw new Error('Geçersiz belge ID formatı');
    }
    
    // Token kontrolü
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('rejectDocument: Token bulunamadı');
      throw new Error('Oturum bulunamadı, lütfen tekrar giriş yapın');
    }
    
    // Yorum kontrolü
    if (!comment || comment.trim() === '') {
      console.error('rejectDocument: Reddetme işlemi için açıklama gereklidir');
      throw new Error('Reddetme işlemi için açıklama gereklidir');
    }
    
    // API isteği gönder
    const response = await API.post(`/${documentId}/reject`, { comment });
    
    console.log('Belge reddetme cevabı:', response);
    return response.data;
  } catch (error) {
    console.error('Belge reddetme hatası:', error);
    
    // Hata mesajını ayıkla
    const errorMessage = error.response?.data?.message || 
                        error.message ||
                        'Belge reddedilirken bir hata oluştu';
    
    // Hata nesnesini zenginleştir
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    enhancedError.status = error.response?.status;
    enhancedError.isAuthError = error.response?.status === 401;
    enhancedError.isPermissionError = error.response?.status === 403;
    enhancedError.isNotFoundError = error.response?.status === 404;
    enhancedError.isValidationError = error.response?.status === 400;
    
    throw enhancedError;
  }
};

// Belgeyi onaya gönderme
export const submitForApproval = async (documentId, approvalFlowId = null, approvers = [], flowType = 'standard') => {
  try {
    console.log('submitForApproval API çağrıldı:', { documentId, approvalFlowId, approvers, flowType });
    
    // Belge ID kontrolü
    if (!documentId) {
      console.error('submitForApproval: documentId parametresi gereklidir');
      throw new Error('Belge ID parametresi gereklidir');
    }
    
    // İstek verilerini hazırla
    const data = {
      flowType
    };
    
    if (approvalFlowId) {
      data.approvalFlowId = approvalFlowId;
    }
    
    if (approvers && approvers.length > 0) {
      data.approvers = approvers;
    }
    
    console.log('Onaya gönderme isteği verileri:', data);
    
    // API isteği yap - backend tarafında gerekli tüm kontroller yapılacak
    console.log(`Belgeyi onaya gönderme isteği yapılıyor: ${documentId}`);
    const response = await API.post(`/${documentId}/submit`, data);
    console.log('Onaya gönderme cevabı:', response);
    
    return response.data;
  } catch (error) {
    // Hata mesajını zenginleştir
    if (error.response) {
      console.error(`Onaya gönderme API hatası: ${error.message}`, error.response);
      
      // Hata türüne göre özel mesajlar
      if (error.response.status === 403) {
        const errorMessage = error.response.data?.message || 'Bu belgeye erişim yetkiniz yok';
        console.error('Erişim hatası:', errorMessage);
        throw new Error(errorMessage);
      } else if (error.response.status === 400) {
        const errorMessage = error.response.data?.message || 'Onay akışı bilgileri geçerli değil';
        console.error('Validasyon hatası:', errorMessage);
        throw new Error(errorMessage);
      } else if (error.response.status === 404) {
        const errorMessage = error.response.data?.message || 'Belge veya onaylayıcı bulunamadı';
        console.error('Bulunamadı hatası:', errorMessage);
        throw new Error(errorMessage);
      } else {
        // Diğer hata durumları
        const errorMessage = error.response.data?.message || 'Belge onaya gönderilirken bir hata oluştu';
        throw new Error(errorMessage);
      }
    }
    
    console.error(`İstek hatası: ${error.message}`);
    throw error;
  }
};

// Belgeyi indirme URL'ini alma
export const getDocumentDownloadUrl = (documentId) => {
  if (!documentId) {
    console.error('getDocumentDownloadUrl: documentId parametresi gereklidir');
    return null;
  }
  
  return `${API_URL}/api/documents/${documentId}/download`;
};

/**
 * Onay bekleyen belgeleri getirir
 * @param {number} page - Sayfa numarası
 * @param {number} limit - Sayfa başına belge sayısı
 * @returns {Promise<Object>} Onay bekleyen belgeler
 */
export const getPendingApprovals = async (page = 1, limit = 10) => {
  // AbortController oluştur
  const controller = new AbortController();
  
  try {
    // Son başarısız API isteğinden bu yana yeterli zaman geçti mi kontrol et
    const lastFailedApiCall = localStorage.getItem('lastFailedPendingApiCall');
    const cooldownPeriod = 120000; // 2 dakika (daha uzun cooldown)
    
    if (lastFailedApiCall) {
      const timeSinceLastFailure = Date.now() - parseInt(lastFailedApiCall);
      if (timeSinceLastFailure < cooldownPeriod) {
        console.warn(`Pending API: Son başarısız denemeden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
        // Boş bir yanıt döndür, hata fırlatma
        return { 
          data: { 
            data: { 
              documents: [], 
              pagination: { total: 0, page, limit, pages: 1 } 
            }
          }
        };
      }
    }
    
    console.log(`Onay bekleyen belgeler için API isteği: sayfa=${page}, limit=${limit}`);
    
    // Timeout ayarla - 8 saniye sonra iptal et
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 8000);
    
    // API endpoint'i düzelt - backend rotalarına göre doğru endpoint'i kullan
    // Backend'de /api/documents/pending-approvals endpoint'i tanımlı
    const response = await API.get(`/pending-approvals?page=${page}&limit=${limit}`, {
      timeout: 8000, // 8 saniye
      signal: controller.signal
    });
    
    // Timeout'u temizle
    clearTimeout(timeoutId);
    
    // Başarılı API çağrısı, cooldown kaydını temizle
    localStorage.removeItem('lastFailedPendingApiCall');
    
    console.log('Onay bekleyen belgeler yanıtı:', response);
    
    // ÖNEMLİ DEĞİŞİKLİK: Frontend tarafında ikinci bir filtreleme yapmayacağız
    // Backend artık doğru şekilde filtrelenmiş belgeleri gönderiyor
    
    return response;
  } catch (error) {
    // Timeout hatası veya iptal edilmiş istek kontrolü
    if (error.name === 'AbortError' || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      console.warn('Onay bekleyen belgeleri getirme isteği zaman aşımı veya iptal edildi');
      localStorage.setItem('lastFailedPendingApiCall', Date.now().toString());
      
      // Varsayılan yanıt döndür
      return { 
        data: { 
          data: { 
            documents: [], 
            pagination: { total: 0, page, limit, pages: 1 } 
          }
        }
      };
    }
    
    // Network hatası durumunda son başarısız deneme zamanını kaydet
    if (error.message === 'Network Error' || 
        error.code === 'ERR_NETWORK' || 
        error.code === 'ECONNABORTED' || 
        error.message?.includes('timeout') ||
        error.message?.includes('ERR_INSUFFICIENT_RESOURCES')) {
      localStorage.setItem('lastFailedPendingApiCall', Date.now().toString());
      console.warn('Network hatası nedeniyle onay bekleyen belgeler alınamadı, sonraki denemeler için cooldown uygulanacak');
    }
    
    console.error('Onay bekleyen belgeleri getirme hatası:', error);
    
    // Hata durumunda varsayılan yanıt döndür
    return { 
      data: { 
        data: { 
          documents: [], 
          pagination: { total: 0, page, limit, pages: 1 } 
        }
      }
    };
  }
};

// Dashboard istatistiklerini getirme
export const getDashboardStats = async () => {
  try {
    const response = await API.get('/dashboard/stats');
    
    if (!response || !response.data) {
      throw new Error('Sunucu yanıtı geçersiz');
    }
    
    return response.data;
  } catch (error) {
    console.error('Dashboard istatistikleri getirme hatası:', error);
    throw error;
  }
};

// Belgenin onay akışını getirme
export const getDocumentApprovalFlow = async (documentId) => {
  try {
    if (!documentId) {
      console.error('getDocumentApprovalFlow: documentId parametresi gereklidir');
      return { data: { approvalFlow: null, error: 'Belge ID parametresi gereklidir' } };
    }
    
    // Önce belge durumunu kontrol et
    const documentResponse = await API.get(`/${documentId}`);
    const document = documentResponse?.data?.data?.document;
    
    if (!document) {
      console.error(`${documentId} ID'li belge bulunamadı`);
      return { data: { approvalFlow: null, error: `${documentId} ID'li belge bulunamadı` } };
    }
    
    // API endpoint'i düzelt
    const response = await API.get(`/${documentId}/approval-flow`);
    
    // Onay akışı kontrolü
    const approvalFlow = response?.data?.data?.approvalFlow;
    
    // Belge durumu ve onay akışı tutarlılığını kontrol et
    if (!approvalFlow && (document.status === 'pending' || document.status === 'in_review')) {
      console.error(`Tutarsızlık: Belge durumu ${document.status} ama onay akışı yok`);
      return { 
        data: { 
          approvalFlow: null, 
          error: `Belge durumu '${document.status}' olmasına rağmen onay akışı bulunamadı. Bu bir sistem tutarsızlığıdır.`,
          document: document
        } 
      };
    }
    
    return response.data;
  } catch (error) {
    console.error('Belge onay akışı getirme hatası:', error);
    
    // 404 hatası durumunda belge için onay akışı henüz oluşturulmamış olabilir
    // Bu durumda null döndür, hata fırlatma
    if (error.response && error.response.status === 404) {
      console.warn(`${documentId} ID'li belge için onay akışı bulunamadı`);
      return { data: { approvalFlow: null, message: 'Bu belge için onay akışı henüz oluşturulmamış' } };
    }
    
    // Diğer hata durumlarında da UI'ın çökmemesi için boş veri döndür
    return { data: { approvalFlow: null, error: error.message } };
  }
};

// Onay akışı şablonlarını getirme
export const getApprovalTemplates = async () => {
  try {
    const response = await API.get('/approval/templates');
    return response.data;
  } catch (error) {
    console.error('Onay şablonları getirme hatası:', error);
    // Hata durumunda boş veri döndür
    return { data: { templates: [] } };
  }
};

// Onay akışı şablonu oluşturma
export const createApprovalTemplate = async (templateData) => {
  try {
    const response = await API.post('/approval/templates', templateData);
    return response.data;
  } catch (error) {
    console.error('Onay şablonu oluşturma hatası:', error);
    throw error;
  }
};

// Tüm belgeleri silme (sadece admin)
export const deleteAllDocuments = async () => {
  const response = await API.delete('/admin/all');
  return response.data;
};

// Varsayılan export - Geriye dönük uyumluluk için
const documentsApi = {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  getUserDocuments,
  approveDocument,
  rejectDocument,
  getDocumentDownloadUrl,
  getPendingApprovals,
  submitForApproval,
  getDashboardStats,
  getDocumentApprovalFlow,
  getApprovalTemplates,
  createApprovalTemplate,
  deleteAllDocuments
};

export default documentsApi;
