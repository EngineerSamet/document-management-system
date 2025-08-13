const winston = require('winston');
const path = require('path');

// Log dosyaları için klasör yolu
const logDir = 'logs';

// Winston formatı
const { combine, timestamp, printf, colorize } = winston.format;

// Özel log formatı
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

// Winston logger yapılandırması
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Konsol çıktısı
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
    // Hata logları için dosya çıktısı
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    // Tüm loglar için dosya çıktısı
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    }),
  ],
  // Beklenmeyen hatalar için
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log') 
    }),
  ],
  // Programın çökmesini engelleme
  exitOnError: false
});

module.exports = logger;
