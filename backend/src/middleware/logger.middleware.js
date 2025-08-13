const logger = require('../utils/logger');

/**
 * HTTP isteklerini loglama middleware'i
 */
const loggerMiddleware = (req, res, next) => {
  // İstek başlangıç zamanı
  const startTime = new Date();
  
  // İstek tamamlandığında çalışacak fonksiyon
  res.on('finish', () => {
    // İstek bitiş zamanı
    const endTime = new Date();
    
    // İstek süresi (ms)
    const responseTime = endTime - startTime;
    
    // İstek bilgilerini logla
    const logMessage = `${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime}ms - ${req.ip}`;
    
    // Durum koduna göre log seviyesini belirle
    if (res.statusCode >= 500) {
      logger.error(logMessage);
    } else if (res.statusCode >= 400) {
      logger.warn(logMessage);
    } else {
      logger.info(logMessage);
    }
    
    // İstek gövdesi ve başlıkları (sadece geliştirme ortamında)
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Request Headers: ${JSON.stringify(req.headers)}`);
      
      // Hassas bilgileri içermeyen isteklerin gövdelerini logla
      if (!req.originalUrl.includes('/auth')) {
        logger.debug(`Request Body: ${JSON.stringify(req.body)}`);
      }
    }
  });
  
  next();
};

// Obje olarak export et (destructuring için)
module.exports = { loggerMiddleware };
