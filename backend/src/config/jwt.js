/**
 * JWT yapılandırma dosyası
 */

// Geliştirme ortamını kontrol et
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

// Debug: JWT yapılandırması için ortam bilgisini logla
console.log(`JWT Config - Environment: ${isDevelopment ? 'Development' : 'Production'}`);

// Geliştirme ortamında daha uzun token süreleri kullan
const devExpiresIn = '30d'; // Geliştirme ortamında 30 gün
const prodExpiresIn = '1d'; // Üretim ortamında 1 gün

const devRefreshExpiresIn = '60d'; // Geliştirme ortamında 60 gün
const prodRefreshExpiresIn = '7d'; // Üretim ortamında 7 gün

// JWT yapılandırması
const jwtConfig = {
  // JWT gizli anahtarı
  secret: process.env.JWT_SECRET || 'gizli_anahtar',
  
  // JWT geçerlilik süresi - geliştirme ortamında daha uzun, üretimde daha kısa
  expiresIn: isDevelopment 
    ? process.env.JWT_EXPIRES_IN || devExpiresIn
    : process.env.JWT_EXPIRES_IN || prodExpiresIn,
  
  // JWT yenileme anahtarı
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'yenileme_anahtari',
  
  // JWT yenileme süresi - geliştirme ortamında daha uzun, üretimde daha kısa
  refreshExpiresIn: isDevelopment
    ? process.env.JWT_REFRESH_EXPIRES_IN || devRefreshExpiresIn
    : process.env.JWT_REFRESH_EXPIRES_IN || prodRefreshExpiresIn,
  
  // Token tipi
  tokenType: 'Bearer',
  
  // Token oluşturma seçenekleri
  options: {
    issuer: 'document-approval-system',
    audience: 'document-approval-system-users',
  }
};

// Debug: JWT yapılandırma bilgilerini logla
console.log(`JWT Config - Token expires in: ${jwtConfig.expiresIn}`);
console.log(`JWT Config - Refresh token expires in: ${jwtConfig.refreshExpiresIn}`);

module.exports = jwtConfig;
