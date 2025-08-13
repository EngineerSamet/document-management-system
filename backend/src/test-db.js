require('dotenv').config();
const mongoose = require('mongoose');
const connectDatabase = require('./config/database');
const User = require('./models/User');
const logger = require('./utils/logger');

/**
 * Veritabanı bağlantısını ve temel işlemleri test eder
 */
const testDatabase = async () => {
  try {
    // Veritabanına bağlan
    await connectDatabase();
    
    logger.info('Veritabanı bağlantısı başarılı');
    
    // Admin kullanıcısı var mı kontrol et
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (adminExists) {
      logger.info('Admin kullanıcısı zaten var');
      logger.info(`Admin e-posta: ${adminExists.email}`);
    } else {
      // Admin kullanıcısı oluştur
      const adminUser = await User.create({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin',
        department: 'Bilgi İşlem',
        position: 'Sistem Yöneticisi'
      });
      
      logger.info('Admin kullanıcısı oluşturuldu');
      logger.info(`Admin ID: ${adminUser._id}`);
      logger.info(`Admin e-posta: ${adminUser.email}`);
    }
    
    // Normal kullanıcı oluştur
    const userExists = await User.findOne({ email: 'user@example.com' });
    
    if (userExists) {
      logger.info('Test kullanıcısı zaten var');
      logger.info(`Kullanıcı e-posta: ${userExists.email}`);
    } else {
      const normalUser = await User.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'user@example.com',
        password: 'user123',
        role: 'user',
        department: 'Muhasebe',
        position: 'Uzman'
      });
      
      logger.info('Test kullanıcısı oluşturuldu');
      logger.info(`Kullanıcı ID: ${normalUser._id}`);
      logger.info(`Kullanıcı e-posta: ${normalUser.email}`);
    }
    
    logger.info('Veritabanı testi başarıyla tamamlandı');
    process.exit(0);
  } catch (error) {
    logger.error(`Veritabanı test hatası: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
};

// Testi çalıştır
testDatabase(); 