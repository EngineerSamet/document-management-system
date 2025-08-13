const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * MongoDB bağlantısını kurar
 */
const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/document-approval-system';
    
    // MongoDB bağlantı seçenekleri
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Sunucu seçim zaman aşımı: 5 saniye
      socketTimeoutMS: 45000, // Soket zaman aşımı: 45 saniye
      family: 4, // IPv4 kullan
      connectTimeoutMS: 10000, // Bağlantı zaman aşımı: 10 saniye
      heartbeatFrequencyMS: 10000, // Kalp atışı sıklığı: 10 saniye
    };
    
    console.log('MongoDB bağlantısı başlatılıyor...');
    console.log('MongoDB URI:', MONGODB_URI);
    console.log('MongoDB options:', JSON.stringify(options));
    
    // MongoDB'ye bağlan
    const connection = await mongoose.connect(MONGODB_URI, options);
    
    // Bağlantı başarılı
    console.log('MongoDB bağlantısı kuruldu');
    logger.info('MongoDB bağlantısı kuruldu');
    
    // Bağlantı durumu değişikliklerini dinle
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB bağlantısı kesildi');
      logger.warn('MongoDB bağlantısı kesildi');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB bağlantı hatası:', err.message);
      console.error('Hata detayları:', err.stack);
      logger.error('MongoDB bağlantı hatası:', err);
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB ile yeniden bağlantı kuruldu');
      logger.info('MongoDB ile yeniden bağlantı kuruldu');
    });
    
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB bağlantı hatası:', error.message);
    console.error('Hata detayları:', error.stack);
    logger.error('MongoDB bağlantı hatası:', error);
    
    // Bağlantı hatası durumunda 3 saniye bekleyip tekrar dene
    console.log('3 saniye sonra tekrar bağlanmayı deneyecek...');
    setTimeout(() => {
      console.log('Yeniden bağlanmayı deniyor...');
      return connectDB();
    }, 3000);
  }
};

module.exports = connectDB;
