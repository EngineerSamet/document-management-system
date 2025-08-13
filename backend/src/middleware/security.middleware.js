const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');

// Ortam değişkenini kontrol et
const isDevelopment = process.env.NODE_ENV === 'development';

// Localhost ve 127.0.0.1 isteklerini rate limit'ten muaf tut
const isLocalhost = (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip.includes('::ffff:127.0.0.1');
};

// Rate limiting middleware - Geliştirme ortamında daha yüksek limitler
const apiLimiter = rateLimit({
  windowMs: isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000, // Geliştirmede 1 dakika, üretimde 15 dakika
  max: isDevelopment ? 5000 : 100, // Geliştirmede 5000 istek, üretimde 100 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çok fazla istek yapıldı, lütfen daha sonra tekrar deneyin',
  // Localhost isteklerini atla
  skip: isLocalhost,
  // Geliştirme ortamında rate limit uyarılarını logla
  handler: (req, res, next, options) => {
    if (isDevelopment) {
      console.warn(`Rate limit aşıldı: ${req.ip} - ${req.originalUrl}`);
    }
    res.status(options.statusCode).json({
      status: 'error',
      message: options.message
    });
  }
});

// Admin API'si için daha yüksek limitler (özellikle dashboard için)
const adminApiLimiter = rateLimit({
  windowMs: isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000,
  max: isDevelopment ? 10000 : 200, // Admin için daha yüksek limitler
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalhost,
  message: 'Çok fazla admin API isteği yapıldı, lütfen daha sonra tekrar deneyin'
});

// Login için daha yüksek rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 100 : 5, // Geliştirmede 100 deneme, üretimde 5 deneme
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalhost,
  message: 'Çok fazla giriş denemesi, lütfen daha sonra tekrar deneyin'
});

// CORS ayarları
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};

// Güvenlik middleware'lerini uygula
const applySecurityMiddleware = (app) => {
  try {
    console.log('Güvenlik middleware\'leri uygulanıyor...');
    console.log(`Ortam: ${isDevelopment ? 'Development' : 'Production'}`);
    
    // Helmet ayarları - daha basit yapılandırma
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrcElem: ["'self'", "https://fonts.gstatic.com", "data:"]
          }
        },
        xssFilter: true, // XSS koruması etkin
        noSniff: true, // X-Content-Type-Options
        ieNoOpen: true, // X-Download-Options
        frameguard: { action: 'sameorigin' }, // X-Frame-Options
        hsts: false // HSTS devre dışı (geliştirme için)
      })
    );
    console.log('Helmet middleware uygulandı');
    
    // CORS koruması
    app.use(cors(corsOptions));
    console.log('CORS middleware uygulandı');
    
    try {
      // NoSQL injection koruması
      app.use(mongoSanitize());
      console.log('MongoDB sanitize middleware uygulandı');
    } catch (error) {
      console.error('MongoDB sanitize middleware hatası:', error);
    }
    
    try {
      // XSS koruması
      app.use(xss());
      console.log('XSS middleware uygulandı');
    } catch (error) {
      console.error('XSS middleware hatası:', error);
    }
    
    // API için rate limiting - Admin API'si için özel limiter kullan
    app.use('/api/admin', adminApiLimiter);
    app.use('/api/', apiLimiter);
    
    // Login için özel rate limiting
    app.use('/api/auth/login', loginLimiter);
    console.log('Rate limiting middleware\'leri uygulandı');
    
    console.log('Tüm güvenlik middleware\'leri başarıyla uygulandı');
    return app;
  } catch (error) {
    console.error('Güvenlik middleware uygulama hatası:', error);
    // Hata durumunda bile uygulamayı döndür, çökmesin
    return app;
  }
};

module.exports = {
  applySecurityMiddleware
}; 