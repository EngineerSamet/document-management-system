const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * JWT token doğrulama middleware'i
 * İsteğin Authorization başlığındaki JWT token'ı doğrular
 * Tek sorumluluk: Token geçerli mi ve kullanıcı var mı kontrol eder
 */
const protect = async (req, res, next) => {
  try {
    // Debug: Tüm başlıkları logla
    logger.debug(`Auth Middleware - Request Headers: ${JSON.stringify(req.headers)}`);
    logger.debug(`Auth Middleware - Request Path: ${req.path}`);
    
    // Authorization başlığını kontrol et
    const authHeader = req.headers.authorization;
    
    // Debug: Authorization başlığını logla
    logger.debug(`Auth Middleware - Authorization Header: ${authHeader}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`Auth Middleware - Invalid or missing Authorization header: ${authHeader}`);
      return res.status(401).json({
        status: 'error',
        message: 'Yetkilendirme başlığı bulunamadı veya geçersiz format',
        code: 'MISSING_AUTH_HEADER'
      });
    }
    
    // Token'ı ayıkla
    const token = authHeader.split(' ')[1];
    
    // Debug: Token'ı logla (güvenlik için sadece ilk 10 karakteri)
    logger.debug(`Auth Middleware - Token (ilk 10 karakter): ${token.substring(0, 10)}...`);
    
    if (!token) {
      logger.warn('Auth Middleware - Token not provided');
      return res.status(401).json({
        status: 'error',
        message: 'Token sağlanmadı',
        code: 'MISSING_TOKEN'
      });
    }
    
    try {
      // Token'ı doğrula
      const decoded = jwt.verify(token, jwtConfig.secret);
      
      // Debug: Decode edilen token bilgilerini logla
      logger.debug(`Auth Middleware - Decoded Token: ${JSON.stringify({
        id: decoded.id,
        exp: decoded.exp,
        iat: decoded.iat
      })}`);
      
      // Token süresi kontrolü
      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp < currentTime) {
        logger.warn(`Auth Middleware - Token expired: ${decoded.exp} < ${currentTime}`);
        return res.status(401).json({
          status: 'error',
          message: 'Token süresi doldu',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      // Kullanıcıyı veritabanından bul
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        logger.warn(`Auth Middleware - User not found for ID: ${decoded.id}`);
        return res.status(401).json({
          status: 'error',
          message: 'Kullanıcı bulunamadı veya token geçersiz',
          code: 'USER_NOT_FOUND'
        });
      }
      
      // Debug: Bulunan kullanıcıyı logla
      logger.info(`Auth Middleware - Kullanıcı bulundu: ${user.email}, rol: ${user.role}`);
      
      // Kullanıcı aktif değilse
      if (!user.isActive) {
        logger.warn(`Auth Middleware - Inactive user: ${user.email}`);
        return res.status(403).json({
          status: 'error',
          message: 'Hesabınız devre dışı bırakılmış',
          code: 'INACTIVE_USER'
        });
      }
      
      // Kullanıcı e-postası doğrulanmamışsa
      if (!user.isVerified) {
        logger.warn(`Auth Middleware - Unverified user: ${user.email}`);
        return res.status(403).json({
          status: 'error',
          message: 'Lütfen önce e-posta adresinizi doğrulayın',
          code: 'UNVERIFIED_USER'
        });
      }
      
      // Kullanıcı bilgisini isteğe ekle
      // Rol büyük harfe çevrilerek eklensin
      if (user.role && typeof user.role === 'string') {
        user.role = user.role.toUpperCase();
      }
      
      // Token süre bilgisini ekle
      const tokenExpiry = decoded.exp;
      const timeRemaining = tokenExpiry - currentTime;
      
      // Token süresinin dolmasına 5 dakikadan az kaldıysa uyarı logla
      if (timeRemaining < 300) {
        logger.warn(`Auth Middleware - Token süresi yakında dolacak: ${timeRemaining} saniye kaldı, kullanıcı: ${user.email}`);
      }
      
      // Kullanıcı ve token bilgilerini request'e ekle
      req.user = user;
      req.tokenInfo = {
        expiresAt: decoded.exp,
        timeRemaining: timeRemaining,
        issuedAt: decoded.iat
      };
      
      logger.debug(`Auth Middleware - User and token info attached to request: ${user.email}, role: ${user.role}, token expires in ${timeRemaining}s`);
      next();
    } catch (jwtError) {
      // JWT doğrulama hataları
      logger.error(`Auth Middleware - JWT Doğrulama Hatası: ${jwtError.name}: ${jwtError.message}`);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token süresi doldu',
          code: 'TOKEN_EXPIRED'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          status: 'error',
          message: 'Geçersiz token',
          code: 'INVALID_TOKEN'
        });
      } else {
        return res.status(401).json({
          status: 'error',
          message: 'Token doğrulama hatası',
          code: 'TOKEN_VERIFICATION_ERROR'
        });
      }
    }
  } catch (error) {
    // Debug: Hataları logla
    logger.error(`Auth Middleware - Genel Hata: ${error.name}: ${error.message}`);
    logger.error(`Auth Middleware - Stack: ${error.stack}`);
    
    return res.status(500).json({
      status: 'error',
      message: 'Yetkilendirme işlemi sırasında bir hata oluştu',
      code: 'AUTH_SERVER_ERROR'
    });
  }
};

// Admin rolünü kontrol eden middleware
const isAdmin = (req, res, next) => {
  // Önce kullanıcının oturum açmış olduğundan emin ol
  if (!req.user) {
    logger.warn('Admin kontrolü - Kullanıcı oturum açmamış');
    return res.status(401).json({
      status: 'error',
      message: 'Yetkilendirme gerekli',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Debug: Admin kontrolü için kullanıcı bilgilerini logla
  logger.debug(`Admin kontrolü - Kullanıcı: ${req.user.email}, rol: ${req.user.role}`);
  
  // Kullanıcının admin rolüne sahip olup olmadığını kontrol et
  if (req.user.role !== 'ADMIN') {
    logger.warn(`Admin kontrolü - Yetkisiz erişim: ${req.user.email} (${req.user.role})`);
    return res.status(403).json({
      status: 'error',
      message: 'Bu işlem için admin yetkisi gerekli',
      code: 'ADMIN_REQUIRED'
    });
  }
  
  // Admin yetkisi varsa devam et
  logger.info(`Admin erişimi onaylandı: ${req.user.email}`);
  next();
};

module.exports = {
  protect,
  isAdmin
};
