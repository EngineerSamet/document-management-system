import axios from 'axios';
import { API_URL } from '../utils/constants';

/**
 * Kullanıcı API'si için axios instance
 * Open/Closed Principle: Yeni özellikler eklemek için mevcut kodu değiştirmek yerine genişletebiliriz
 */
const API = axios.create({
  baseURL: `${API_URL}/api/users`,
});

/**
 * API istekleri için gecikme fonksiyonu
 * @param {number} ms - Milisaniye cinsinden gecikme süresi
 * @returns {Promise} - Belirtilen süre sonra resolve olan promise
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry mekanizması ile API isteği yapan yardımcı fonksiyon
 * SRP (Single Responsibility Principle): Bu fonksiyon sadece retry mekanizmasından sorumlu
 * 
 * @param {Function} apiCall - API çağrısı yapan fonksiyon
 * @param {number} maxRetries - Maksimum yeniden deneme sayısı
 * @param {number} initialDelay - İlk yeniden deneme için gecikme süresi (ms)
 * @returns {Promise} - API yanıtı
 */
const withRetry = async (apiCall, maxRetries = 3, initialDelay = 1000) => {
  let lastError;
  let delayTime = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // API çağrısını yap
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      // Rate limiting hatası (429) durumunda yeniden dene
      if (error.response && error.response.status === 429 && attempt < maxRetries) {
        console.warn(`Rate limit aşıldı, ${delayTime}ms sonra yeniden deneniyor (${attempt + 1}/${maxRetries})...`);
        await delay(delayTime);
        // Exponential backoff: Her denemede bekleme süresini artır
        delayTime *= 2;
      } else {
        // Diğer hata türleri veya maksimum deneme sayısına ulaşıldıysa hatayı fırlat
        throw error;
      }
    }
  }
  
  throw lastError;
};

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

/**
 * Kullanıcıları listeleme (admin için)
 * @param {number} page - Sayfa numarası
 * @param {number} limit - Sayfa başına kullanıcı sayısı
 * @param {Object} filters - Filtreleme parametreleri
 * @returns {Promise} - API yanıtı
 */
export const getAllUsers = async (page = 1, limit = 10, filters = {}) => {
  return withRetry(async () => {
    const response = await API.get('/', { params: { page, limit, ...filters } });
    
    // API yanıt yapısını kontrol et ve kullanıcı verilerini döndür
    if (response.data && response.data.data && response.data.data.users) {
      return response.data.data.users;
    } else if (response.data && response.data.users) {
      return response.data.users;
    } else if (response.data && response.data.results) {
      return response.data.results;
    } else if (response.data && Array.isArray(response.data)) {
      return response.data;
    } else {
      // Diğer olası yanıt yapıları için
      console.warn('API yanıt yapısı beklenen formatta değil:', response.data);
      return response.data; // Olduğu gibi döndür, çağıran tarafta işlenecek
    }
  });
};

// getUsers fonksiyonu (getAllUsers'ın alias'ı) - Geriye dönük uyumluluk için
export const getUsers = getAllUsers;

/**
 * Belirli bir kullanıcıyı getirme
 * @param {string} id - Kullanıcı ID'si
 * @returns {Promise} - API yanıtı
 */
export const getUserById = async (id) => {
  return withRetry(async () => {
    const response = await API.get(`/${id}`);
    return response.data;
  });
};

/**
 * Kullanıcı oluşturma (admin için)
 * @param {Object} userData - Kullanıcı verileri
 * @returns {Promise} - API yanıtı
 */
export const createUser = async (userData) => {
  return withRetry(async () => {
    // Departman ve pozisyon değerlerinin doğru formatta olduğundan emin olalım
    const updatedUserData = {
      ...userData
    };
    
    // Departman değerini normalize et
    if (updatedUserData.department) {
      updatedUserData.department = normalizeDepartmentId(updatedUserData.department);
    }
    
    // Boş string veya undefined değerleri null olarak ayarla
    if (!updatedUserData.department || updatedUserData.department === '') {
      updatedUserData.department = null;
    }
    
    if (!updatedUserData.position || updatedUserData.position === '') {
      updatedUserData.position = null;
    }
    
    console.log('API: Kullanıcı oluşturma verileri:', updatedUserData);
    
    const response = await API.post('/', updatedUserData);
    return response.data;
  });
};

/**
 * Kullanıcı güncelleme
 * @param {string} id - Kullanıcı ID'si
 * @param {Object} userData - Güncellenecek kullanıcı verileri
 * @returns {Promise} - API yanıtı
 */
export const updateUser = async (id, userData) => {
  return withRetry(async () => {
    // Departman ve pozisyon değerlerinin doğru formatta olduğundan emin olalım
    const updatedUserData = {
      ...userData
    };
    
    // Departman değerini normalize et
    if (updatedUserData.department) {
      updatedUserData.department = normalizeDepartmentId(updatedUserData.department);
    }
    
    // Boş string veya undefined değerleri null olarak ayarla
    if (!updatedUserData.department || updatedUserData.department === '') {
      updatedUserData.department = null;
    }
    
    if (!updatedUserData.position || updatedUserData.position === '') {
      updatedUserData.position = null;
    }
    
    console.log('API: Kullanıcı güncelleme verileri:', updatedUserData);
    
    const response = await API.put(`/${id}`, updatedUserData);
    return response.data;
  });
};

/**
 * Kullanıcı profil bilgilerini güncelleme (normal kullanıcı için)
 * @param {Object} userData - Güncellenecek profil verileri
 * @returns {Promise} - API yanıtı
 */
export const updateUserProfile = async (userData) => {
  return withRetry(async () => {
    try {
      // Departman ve pozisyon değerlerinin doğru formatta olduğundan emin olalım
      const updatedUserData = {
        ...userData
      };
      
      // Departman değerini normalize et
      if (updatedUserData.department) {
        updatedUserData.department = normalizeDepartmentId(updatedUserData.department);
      }
      
      // Boş string veya undefined değerleri null olarak ayarla
      if (!updatedUserData.department || updatedUserData.department === '') {
        updatedUserData.department = null;
      }
      
      if (!updatedUserData.position || updatedUserData.position === '') {
        updatedUserData.position = null;
      }
      
      console.log('API: Profil güncelleme verileri:', updatedUserData);
      
      // Özel endpoint'i kullan (/profile)
      // NOT: Express.js route'ları tanımlandıkları sırayla değerlendirir.
      // Bu nedenle, backend'de '/profile' endpoint'i '/:id' endpoint'inden ÖNCE tanımlanmalıdır.
      const response = await API.put('/profile', updatedUserData);
      
      // API yanıt yapısını kontrol et
      if (response.data && response.data.data && response.data.data.user) {
        // Standart API yanıt yapısı
        return response.data.data.user;
      } else if (response.data && response.data.user) {
        // Alternatif API yanıt yapısı
        return response.data.user;
      } else {
        // Diğer olası yanıt yapıları
        console.warn('API yanıt yapısı beklenen formatta değil:', response.data);
        return response.data; // Olduğu gibi döndür
      }
    } catch (error) {
      // Hata detaylarını logla
      console.error('Profil güncelleme hatası:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // CastError (geçersiz ID formatı) hatası
      if (error.response?.data?.message === 'Geçersiz ID formatı') {
        console.error('HATA: MongoDB "profile" string\'ini bir ObjectId olarak yorumlamaya çalışıyor. Backend\'de route\'ların sırası yanlış olabilir.');
      }
      
      // Hatayı yeniden fırlat
      throw error;
    }
  });
};

/**
 * Kullanıcı şifre değiştirme
 * @param {string} currentPassword - Mevcut şifre
 * @param {string} newPassword - Yeni şifre
 * @returns {Promise} - API yanıtı
 */
export const changePassword = async (currentPassword, newPassword) => {
  return withRetry(async () => {
    try {
      console.log('Şifre değiştirme isteği gönderiliyor...');
      
      const response = await API.post('/change-password', { 
        currentPassword, 
        newPassword 
      });
      
      console.log('Şifre değiştirme yanıtı:', response.data);
      
      return response.data;
    } catch (error) {
      // Hata detaylarını logla
      console.error('Şifre değiştirme hatası:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // Hatayı yeniden fırlat
      throw error;
    }
  });
};

/**
 * Kullanıcı silme
 * @param {string} id - Kullanıcı ID'si
 * @returns {Promise} - API yanıtı
 */
export const deleteUser = async (id) => {
  return withRetry(async () => {
    const response = await API.delete(`/${id}`);
    return response.data;
  });
};

/**
 * Kullanıcı aktivasyon durumunu değiştirme
 * @param {string} id - Kullanıcı ID'si
 * @param {boolean} isActive - Aktivasyon durumu
 * @returns {Promise} - API yanıtı
 */
export const toggleUserStatus = async (id, isActive) => {
  return withRetry(async () => {
    const response = await API.patch(`/${id}/status`, { isActive });
    return response.data;
  });
};

/**
 * Kullanıcı rolünü değiştirme (admin için)
 * @param {string} id - Kullanıcı ID'si
 * @param {string} role - Yeni rol
 * @returns {Promise} - API yanıtı
 */
export const changeUserRole = async (id, role) => {
  return withRetry(async () => {
    const response = await API.patch(`/${id}/role`, { role });
    return response.data;
  });
};

/**
 * Departman ID'sini normalize etme
 * @param {string} departmentId - Normalize edilecek departman ID'si
 * @returns {string} - Normalize edilmiş departman ID'si
 */
export const normalizeDepartmentId = (departmentId) => {
  if (!departmentId) return '';
  
  // Departman ID'sini büyük harfe çevir ve trim et
  const normalizedId = departmentId.trim().toUpperCase();
  
  // Departman eşleştirme tablosu
  const departmentMap = {
    'IT': 'IT',
    'BILGI ISLEM': 'IT',
    'BILGI İŞLEM': 'IT',
    'BILGI TEKNOLOJILERI': 'IT',
    'BİLGİ İŞLEM': 'IT',
    'BİLGİ TEKNOLOJİLERİ': 'IT',
    'BILGI_ISLEM': 'IT',
    'BILGI_TEKNOLOJILERI': 'IT',
    'BT': 'IT',
    'HR': 'HR',
    'IK': 'HR',
    'İK': 'HR',
    'INSAN KAYNAKLARI': 'HR',
    'İNSAN KAYNAKLARI': 'HR',
    'INSAN_KAYNAKLARI': 'HR',
    'FINANCE': 'FINANCE',
    'FINANS': 'FINANCE',
    'FİNANS': 'FINANCE',
    'MALI ISLER': 'FINANCE',
    'MALİ İŞLER': 'FINANCE',
    'MALI_ISLER': 'FINANCE',
    'MARKETING': 'MARKETING',
    'PAZARLAMA': 'MARKETING',
    'SALES': 'SALES',
    'SATIS': 'SALES',
    'SATIŞ': 'SALES',
    'OPERATIONS': 'OPERATIONS',
    'OPERASYON': 'OPERATIONS',
    'LEGAL': 'LEGAL',
    'HUKUK': 'LEGAL',
    'CUSTOMER_SERVICE': 'CUSTOMER_SERVICE',
    'MUSTERI HIZMETLERI': 'CUSTOMER_SERVICE',
    'MÜŞTERİ HİZMETLERİ': 'CUSTOMER_SERVICE',
    'RESEARCH': 'RESEARCH',
    'AR-GE': 'RESEARCH',
    'ARGE': 'RESEARCH',
    'ARASTIRMA VE GELISTIRME': 'RESEARCH',
    'ARAŞTIRMA VE GELİŞTİRME': 'RESEARCH'
  };
  
  // Eşleştirme tablosunda varsa eşleşen ID'yi döndür
  if (departmentMap[normalizedId]) {
    return departmentMap[normalizedId];
  }
  
  // Eşleştirme tablosunda yoksa orijinal değeri döndür
  return departmentId;
};

/**
 * Departman listesini getirme
 * @returns {Promise} - API yanıtı
 */
export const getDepartments = async () => {
  // Not: Backend'de henüz departman API'si olmadığı için sabit bir liste döndürüyoruz
  // SOLID prensiplerinden Interface Segregation: İstemciler kullanmadıkları arayüzlere bağımlı değildir
  // YAGNI: Backend API'si olmadığı için şimdilik sabit liste kullanıyoruz
  
  try {
    console.log('Departman listesi getiriliyor...');
    
    // Sabit departman listesi
    const departments = [
      { id: 'IT', name: 'Bilgi Teknolojileri' },
      { id: 'HR', name: 'İnsan Kaynakları' },
      { id: 'FINANCE', name: 'Finans' },
      { id: 'MARKETING', name: 'Pazarlama' },
      { id: 'SALES', name: 'Satış' },
      { id: 'OPERATIONS', name: 'Operasyon' },
      { id: 'LEGAL', name: 'Hukuk' },
      { id: 'CUSTOMER_SERVICE', name: 'Müşteri Hizmetleri' },
      { id: 'RESEARCH', name: 'Araştırma ve Geliştirme' }
    ];
    
    // Gerçek API yanıtını simüle et
    return Promise.resolve({
      status: 200,
      data: {
        departments
      }
    });
  } catch (error) {
    console.error('Departman listesi getirme hatası:', error);
    throw error;
  }
};

/**
 * Departman adını ID'ye göre bulma
 * @param {string} departmentId - Departman ID'si
 * @returns {string} - Departman adı
 */
export const getDepartmentNameById = async (departmentId) => {
  try {
    // Departman ID'sini normalize et
    const normalizedId = normalizeDepartmentId(departmentId);
    
    // Departman listesini getir
    const response = await getDepartments();
    const departments = response.data.departments;
    
    // Departman adını bul
    const department = departments.find(dept => dept.id === normalizedId);
    
    // Departman bulunduysa adını döndür, bulunamadıysa orijinal ID'yi döndür
    return department ? department.name : departmentId;
  } catch (error) {
    console.error('Departman adı bulma hatası:', error);
    return departmentId; // Hata durumunda orijinal ID'yi döndür
  }
};

/**
 * Pozisyon listesini getirme
 * @param {string|null} departmentId - Departman ID'si (opsiyonel)
 * @returns {Promise} - API yanıtı
 */
export const getPositions = async (departmentId = null) => {
  try {
    // Departman ID'si kontrolü ve düzeltme
    if (!departmentId || departmentId === '') {
      departmentId = null;
      console.log('Pozisyon listesi getiriliyor, departman: varsayılan (departmentId null veya boş)');
    } else {
      // Departman ID'sini normalize et
      const originalId = departmentId;
      departmentId = normalizeDepartmentId(departmentId);
      
      if (originalId !== departmentId) {
        console.log(`Departman ID normalize edildi: "${originalId}" -> "${departmentId}"`);
      }
      
      console.log('Pozisyon listesi getiriliyor, departman:', departmentId);
    }
    
    // Gerçek API çağrısını simüle etmek için gecikme ekle (100ms)
    await delay(100);
    
    // Varsayılan pozisyonlar - tüm departmanlar için kullanılabilir
    const defaultPositions = [
      { id: 'MANAGER', name: 'Yönetici' },
      { id: 'SPECIALIST', name: 'Uzman' },
      { id: 'ASSISTANT', name: 'Asistan' },
      { id: 'INTERN', name: 'Stajyer' },
      { id: 'DIRECTOR', name: 'Direktör' },
      { id: 'COORDINATOR', name: 'Koordinatör' },
      { id: 'ANALYST', name: 'Analist' },
      { id: 'CONSULTANT', name: 'Danışman' }
    ];
    
    // Departman ID'si yoksa varsayılan pozisyonları döndür
    if (!departmentId) {
      console.log('Departman seçilmemiş, varsayılan pozisyonlar döndürülüyor');
      return Promise.resolve({
        status: 200,
        data: {
          positions: defaultPositions
        }
      });
    }
    
    // Sabit pozisyon listesi - departmana göre filtreleme
    const departmentPositions = {
      // Bilgi Teknolojileri pozisyonları
      'IT': [
        { id: 'IT_MANAGER', name: 'IT Müdürü' },
        { id: 'SYSTEM_ADMIN', name: 'Sistem Yöneticisi' },
        { id: 'SOFTWARE_DEV', name: 'Yazılım Geliştirici' },
        { id: 'NETWORK_ADMIN', name: 'Ağ Yöneticisi' },
        { id: 'SECURITY_SPECIALIST', name: 'Güvenlik Uzmanı' },
        { id: 'DATABASE_ADMIN', name: 'Veritabanı Yöneticisi' },
        { id: 'IT_SUPPORT', name: 'IT Destek Uzmanı' },
        { id: 'QA_ENGINEER', name: 'Test Mühendisi' },
        { id: 'DEVOPS_ENGINEER', name: 'DevOps Mühendisi' },
        { id: 'UI_UX_DESIGNER', name: 'UI/UX Tasarımcısı' }
      ],
      // İnsan Kaynakları pozisyonları
      'HR': [
        { id: 'HR_MANAGER', name: 'İK Müdürü' },
        { id: 'HR_SPECIALIST', name: 'İK Uzmanı' },
        { id: 'RECRUITER', name: 'İşe Alım Uzmanı' },
        { id: 'TRAINING_SPECIALIST', name: 'Eğitim Uzmanı' },
        { id: 'COMPENSATION_SPECIALIST', name: 'Ücret ve Yan Haklar Uzmanı' },
        { id: 'HR_ASSISTANT', name: 'İK Asistanı' }
      ],
      // Finans pozisyonları
      'FINANCE': [
        { id: 'FINANCE_MANAGER', name: 'Finans Müdürü' },
        { id: 'ACCOUNTANT', name: 'Muhasebeci' },
        { id: 'FINANCIAL_ANALYST', name: 'Finansal Analist' },
        { id: 'BUDGET_ANALYST', name: 'Bütçe Analisti' },
        { id: 'TAX_SPECIALIST', name: 'Vergi Uzmanı' },
        { id: 'FINANCE_ASSISTANT', name: 'Finans Asistanı' }
      ],
      // Pazarlama pozisyonları
      'MARKETING': [
        { id: 'MARKETING_MANAGER', name: 'Pazarlama Müdürü' },
        { id: 'MARKETING_SPECIALIST', name: 'Pazarlama Uzmanı' },
        { id: 'DIGITAL_MARKETING_SPECIALIST', name: 'Dijital Pazarlama Uzmanı' },
        { id: 'CONTENT_CREATOR', name: 'İçerik Üreticisi' },
        { id: 'SOCIAL_MEDIA_SPECIALIST', name: 'Sosyal Medya Uzmanı' },
        { id: 'BRAND_MANAGER', name: 'Marka Yöneticisi' },
        { id: 'MARKETING_ANALYST', name: 'Pazarlama Analisti' }
      ],
      // Satış pozisyonları
      'SALES': [
        { id: 'SALES_MANAGER', name: 'Satış Müdürü' },
        { id: 'SALES_REPRESENTATIVE', name: 'Satış Temsilcisi' },
        { id: 'ACCOUNT_MANAGER', name: 'Müşteri Yöneticisi' },
        { id: 'BUSINESS_DEVELOPER', name: 'İş Geliştirme Uzmanı' },
        { id: 'SALES_ANALYST', name: 'Satış Analisti' },
        { id: 'SALES_ASSISTANT', name: 'Satış Asistanı' }
      ],
      // Operasyon pozisyonları
      'OPERATIONS': [
        { id: 'OPERATIONS_MANAGER', name: 'Operasyon Müdürü' },
        { id: 'OPERATIONS_SPECIALIST', name: 'Operasyon Uzmanı' },
        { id: 'LOGISTICS_SPECIALIST', name: 'Lojistik Uzmanı' },
        { id: 'SUPPLY_CHAIN_SPECIALIST', name: 'Tedarik Zinciri Uzmanı' },
        { id: 'QUALITY_CONTROL_SPECIALIST', name: 'Kalite Kontrol Uzmanı' },
        { id: 'OPERATIONS_ANALYST', name: 'Operasyon Analisti' }
      ],
      // Hukuk pozisyonları
      'LEGAL': [
        { id: 'LEGAL_COUNSEL', name: 'Hukuk Müşaviri' },
        { id: 'LAWYER', name: 'Avukat' },
        { id: 'LEGAL_ASSISTANT', name: 'Hukuk Asistanı' },
        { id: 'COMPLIANCE_OFFICER', name: 'Uyum Görevlisi' },
        { id: 'LEGAL_ANALYST', name: 'Hukuk Analisti' }
      ],
      // Müşteri Hizmetleri pozisyonları
      'CUSTOMER_SERVICE': [
        { id: 'CUSTOMER_SERVICE_MANAGER', name: 'Müşteri Hizmetleri Müdürü' },
        { id: 'CUSTOMER_SERVICE_REPRESENTATIVE', name: 'Müşteri Temsilcisi' },
        { id: 'CUSTOMER_SUPPORT_SPECIALIST', name: 'Müşteri Destek Uzmanı' },
        { id: 'CUSTOMER_SUCCESS_MANAGER', name: 'Müşteri Başarı Yöneticisi' },
        { id: 'CUSTOMER_EXPERIENCE_SPECIALIST', name: 'Müşteri Deneyimi Uzmanı' }
      ],
      // Araştırma ve Geliştirme pozisyonları
      'RESEARCH': [
        { id: 'RESEARCH_DIRECTOR', name: 'Ar-Ge Direktörü' },
        { id: 'RESEARCH_SCIENTIST', name: 'Araştırma Bilimcisi' },
        { id: 'PRODUCT_DEVELOPER', name: 'Ürün Geliştirici' },
        { id: 'RESEARCH_ANALYST', name: 'Araştırma Analisti' },
        { id: 'INNOVATION_SPECIALIST', name: 'İnovasyon Uzmanı' },
        { id: 'RESEARCH_ASSISTANT', name: 'Araştırma Asistanı' }
      ]
    };
    
    // Departman ID'sine göre pozisyonları al
    let positions = departmentPositions[departmentId];
    
    // Eğer bu departman için özel pozisyonlar tanımlanmamışsa
    if (!positions) {
      console.log(`${departmentId} departmanı için özel pozisyonlar tanımlanmamış, varsayılan liste kullanılıyor`);
      
      // Varsayılan pozisyonları kullan
      positions = defaultPositions;
    } else {
      console.log(`${departmentId} departmanı için ${positions.length} pozisyon bulundu`);
    }
    
    // Gerçek API yanıtını simüle et
    return Promise.resolve({
      status: 200,
      data: {
        positions
      }
    });
  } catch (error) {
    console.error('Pozisyon listesi getirme hatası:', error);
    
    // Hata durumunda varsayılan pozisyonları döndür
    return Promise.resolve({
      status: 200,
      data: {
        positions: [
          { id: 'MANAGER', name: 'Yönetici' },
          { id: 'SPECIALIST', name: 'Uzman' },
          { id: 'ASSISTANT', name: 'Asistan' }
        ]
      }
    });
  }
};

/**
 * Pozisyon adını ID'ye göre bulma
 * @param {string} positionId - Pozisyon ID'si
 * @param {string|null} departmentId - Departman ID'si (opsiyonel)
 * @returns {Promise<string>} - Pozisyon adı
 */
export const getPositionNameById = async (positionId, departmentId = null) => {
  try {
    // Pozisyon ID'si yoksa boş string döndür
    if (!positionId) {
      return '';
    }
    
    // Departman ID'sini normalize et
    if (departmentId) {
      departmentId = normalizeDepartmentId(departmentId);
    }
    
    // Pozisyon listesini getir
    const response = await getPositions(departmentId);
    const positions = response.data.positions;
    
    // Pozisyon adını bul
    const position = positions.find(pos => pos.id === positionId);
    
    // Pozisyon bulunduysa adını döndür, bulunamadıysa orijinal ID'yi döndür
    return position ? position.name : positionId;
  } catch (error) {
    console.error('Pozisyon adı bulma hatası:', error);
    return positionId; // Hata durumunda orijinal ID'yi döndür
  }
};

// Varsayılan export - Geriye dönük uyumluluk için
const usersApi = {
  getAllUsers,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserProfile,
  changePassword,
  deleteUser,
  toggleUserStatus,
  changeUserRole,
  getDepartments,
  getPositions,
  normalizeDepartmentId,
  getDepartmentNameById,
  getPositionNameById
};

export default usersApi;
