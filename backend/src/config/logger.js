const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Log dizinini oluştur
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Tarih formatı
const dateFormat = () => {
  return new Date(Date.now()).toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// Log formatı
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
});

// Winston logger yapılandırması
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: dateFormat }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  defaultMeta: { service: 'document-service' },
  transports: [
    // Konsol çıktısı
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: dateFormat }),
        logFormat
      )
    }),
    
    // Bilgi ve üstü seviyedeki loglar için dosya
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Sadece hata logları için dosya
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ],
  // Beklenmeyen hatalar için
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ],
  // Promise reddetmeleri için
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Geliştirme ortamında daha ayrıntılı konsol çıktısı
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// HTTP isteklerini loglamak için middleware
logger.httpStream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Hata yakalama yardımcı fonksiyonu
logger.logError = (err, req = null) => {
  const errorDetails = {
    message: err.message,
    stack: err.stack,
    name: err.name
  };
  
  if (req) {
    errorDetails.method = req.method;
    errorDetails.url = req.originalUrl;
    errorDetails.ip = req.ip;
    errorDetails.user = req.user ? req.user.id : 'anonymous';
  }
  
  logger.error(`Hata: ${err.message}`, { error: errorDetails });
};

module.exports = logger; 