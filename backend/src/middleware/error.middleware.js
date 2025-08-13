const logger = require('../config/logger');
const { ApiError, ValidationError, NotFoundError, PermissionError, AuthenticationError } = require('../utils/errors');

/**
 * Merkezi hata yakalama middleware'i
 * Tüm hataları yakalar ve uygun formatta yanıt döndürür
 */
const errorHandler = (err, req, res, next) => {
  // Hata detaylarını logla
  logger.logError(err, req);
  
  // API hatası ise doğrudan statusCode ve mesajı kullan
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      ...(err.errors && { errors: err.errors })
    });
  }
  
  // Özel statusCode'lu hatalar
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      ...(err.errors && { errors: err.errors })
    });
  }
  
  // Mongoose validasyon hatası
  if (err.name === 'ValidationError') {
    const validationErrors = {};
    
    // Her bir hata alanını işle
    Object.keys(err.errors).forEach(field => {
      validationErrors[field] = err.errors[field].message;
    });
    
    return res.status(400).json({
      status: 'error',
      message: 'Doğrulama hataları',
      errors: validationErrors
    });
  }
  
  // MongoDB CastError (geçersiz ID formatı)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    // Eğer path "_id" ise ve value "profile" ise, özel bir hata mesajı döndür
    if (err.path === '_id' && err.value === 'profile') {
      logger.error('Express.js route sıralaması hatası: "/profile" endpoint\'i "/:id" endpoint\'inden ÖNCE tanımlanmalıdır.');
      
      return res.status(400).json({
        status: 'error',
        message: 'Route yapılandırma hatası: /profile endpoint\'i /:id endpoint\'inden önce tanımlanmalıdır',
        errors: { 
          route: 'Express.js route sıralaması hatası',
          detail: 'MongoDB "profile" string\'ini bir ObjectId olarak yorumlamaya çalışıyor'
        }
      });
    }
    
    return res.status(400).json({
      status: 'error',
      message: 'Geçersiz ID formatı',
      errors: { [err.path]: `Geçersiz ID formatı: "${err.value}" bir ObjectId değil` }
    });
  }
  
  // MongoDB duplicate key hatası
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    
    return res.status(409).json({
      status: 'error',
      message: 'Kayıt zaten mevcut',
      errors: { [field]: `${field} değeri '${value}' zaten kullanılıyor` }
    });
  }
  
  // JWT hataları
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Geçersiz token',
      errors: { token: 'Geçersiz veya süresi dolmuş token' }
    });
  }
  
  // Token süresi dolmuş
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      message: 'Token süresi dolmuş',
      errors: { token: 'Oturum süresi dolmuş, lütfen tekrar giriş yapın' }
    });
  }
  
  // Multer dosya yükleme hataları
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      status: 'error',
      message: 'Dosya boyutu çok büyük',
      errors: { file: 'Dosya boyutu 10MB\'dan küçük olmalıdır' }
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      status: 'error',
      message: 'Beklenmeyen dosya alanı',
      errors: { file: 'Beklenmeyen dosya alanı' }
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      status: 'error',
      message: 'Çok fazla dosya',
      errors: { file: 'En fazla 1 dosya yükleyebilirsiniz' }
    });
  }
  
  // Disk ve dosya sistemi hataları
  if (['ENOSPC', 'EROFS', 'EACCES', 'EPERM'].includes(err.code)) {
    logger.error(`Dosya sistemi hatası: ${err.code} - ${err.message}`);
    
    return res.status(500).json({
      status: 'error',
      message: 'Dosya işleme hatası',
      errors: { server: 'Sunucu dosya işleme hatası, lütfen daha sonra tekrar deneyin' }
    });
  }
  
  // SyntaxError (JSON ayrıştırma hatası)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      status: 'error',
      message: 'Geçersiz JSON formatı',
      errors: { body: 'Gönderilen veri geçerli JSON formatında değil' }
    });
  }
  
  // Diğer tüm hatalar için 500 Internal Server Error
  return res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Sunucu hatası' 
      : err.message || 'Sunucu hatası',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = errorHandler;
