const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const jwtConfig = require('../../config/jwt');
const emailService = require('../../utils/email');
const logger = require('../../utils/logger');
const Log = require('../../models/Log');

/**
 * Kullanıcı servisi
 */
class UserService {
  /**
   * Yeni kullanıcı oluşturur (admin tarafından)
   * @param {Object} userData - Kullanıcı bilgileri
   * @returns {Promise<Object>} Oluşturulan kullanıcı
   */
  async createUser(userData) {
    try {
      // E-posta adresinin kullanımda olup olmadığını kontrol et
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('Bu e-posta adresi zaten kullanımda');
      }
      
      // Test ortamında mı çalışıyoruz?
      const isTestEnvironment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
      const isTestEmail = userData.email.endsWith('@example.com');
      
      // Test ortamında ve example.com uzantılı e-posta ise, doğrudan aktif ve doğrulanmış olarak ayarla
      const isActive = isTestEnvironment && isTestEmail ? true : false;
      const isVerified = isTestEnvironment && isTestEmail ? true : false;
      
      logger.info(`Kullanıcı oluşturuluyor: ${userData.email} (Test kullanıcısı: ${isTestEmail ? 'Evet' : 'Hayır'}, Aktif: ${isActive}, Doğrulanmış: ${isVerified})`);
      
      // Kullanıcı verilerini logla (hassas bilgiler hariç)
      logger.info('Kullanıcı verileri:', {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        department: userData.department,
        position: userData.position
      });
      
      // Kullanıcının şifresini kontrol et
      let userPassword;
      
      // Eğer şifre verilmişse kullan, yoksa geçici şifre oluştur
      if (userData.password && userData.password.trim().length > 0) {
        // Şifre verilmiş, doğrudan kullan
        userPassword = userData.password;
        logger.info(`Kullanıcı için verilen şifre kullanılıyor: ${userData.email}`);
      } else {
        // Şifre verilmemiş, geçici şifre oluştur
        userPassword = crypto.randomBytes(10).toString('hex');
        logger.info(`Kullanıcı için geçici şifre oluşturuldu: ${userData.email}`);
      }
      
      // Yeni kullanıcı oluştur
      const user = new User({
        ...userData,
        password: userPassword, // Şifreyi doğrudan ata, pre-save hook hash'leyecek
        isActive,
        isVerified
      });
      
      // Veritabanına kaydet ve sonucu logla
      try {
        await user.save();
        logger.info(`✅ Kullanıcı veritabanına başarıyla kaydedildi: ${user._id}`);
      } catch (saveError) {
        logger.error(`❌ Kullanıcı veritabanına kaydedilemedi:`, saveError);
        throw saveError;
      }
      
      // Test ortamında ve example.com uzantılı e-posta ise, doğrulama e-postası gönderme
      if (!(isTestEnvironment && isTestEmail)) {
        // Doğrulama token'ı oluştur
        const verificationToken = this.generateVerificationToken(user);
        
        // E-posta doğrulama linki gönder
        await this.sendVerificationEmail(user, verificationToken);
      } else {
        logger.info(`Test kullanıcısı ${userData.email} için e-posta doğrulama adımı atlandı. Kullanıcı otomatik olarak aktif ve doğrulanmış durumda.`);
        
        // Test kullanıcısı için şifreyi logla (sadece geliştirme ortamında)
        if (isTestEnvironment) {
          logger.info(`🔑 Test kullanıcısı şifresi (hash'lenmemiş): ${userPassword}`);
        }
      }
      
      // İşlemi logla
      await Log.logUserAction(
        user._id,
        'create-user',
        `Admin tarafından yeni kullanıcı oluşturuldu: ${user.email}`,
        { userId: user._id }
      );
      
      // Oluşturulan kullanıcıyı kontrol amaçlı tekrar veritabanından çek
      const createdUser = await User.findById(user._id);
      if (createdUser) {
        logger.info(`✅ Kullanıcı veritabanında doğrulandı: ${createdUser.email} (Aktif: ${createdUser.isActive}, Doğrulanmış: ${createdUser.isVerified})`);
      } else {
        logger.warn(`⚠️ Kullanıcı oluşturuldu ancak veritabanında doğrulanamadı: ${user.email}`);
      }
      
      // Test kullanıcısı için şifre bilgisini ekle (sadece yanıtta)
      if (isTestEnvironment && isTestEmail) {
        // Yanıta şifre bilgisini ekle (sadece test ortamında)
        return {
          ...user.toObject(),
          _testPassword: userPassword // Hash'lenmemiş şifre (sadece test için)
        };
      }
      
      return user;
    } catch (error) {
      logger.error(`Kullanıcı oluşturma hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * E-posta doğrulama token'ı oluşturur
   * @param {Object} user - Kullanıcı
   * @returns {string} JWT token
   */
  generateVerificationToken(user) {
    return jwt.sign(
      { 
        id: user._id,
        email: user.email
      },
      jwtConfig.secret,
      { expiresIn: '24h' } // 24 saat geçerli
    );
  }
  
  /**
   * E-posta doğrulama linki gönderir
   * @param {Object} user - Kullanıcı
   * @param {string} token - Doğrulama token'ı
   * @returns {Promise<Object>} Gönderim sonucu
   */
  async sendVerificationEmail(user, token) {
    try {
      // Test ortamında mı çalışıyoruz?
      const isTestEnvironment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
      const isTestEmail = user.email.endsWith('@example.com');
      
      // Test ortamında ve example.com uzantılı e-posta ise, e-posta gönderimi simüle et
      if (isTestEnvironment && isTestEmail) {
        logger.info(`Test kullanıcısı ${user.email} için doğrulama e-postası gönderimi simüle edildi`);
        
        // Doğrulama URL'sini logla (test için)
        const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify?token=${token}`;
        logger.info(`Test kullanıcısı doğrulama URL'si: ${verifyUrl}`);
        
        return {
          messageId: `simulated-${Date.now()}`,
          response: 'Test ortamında simüle edildi'
        };
      }
      
      const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify?token=${token}`;
      const subject = 'Hesap Doğrulama';
      
      const text = `Sayın ${user.firstName} ${user.lastName},
      
Kurum İçi Evrak Sistemine hoş geldiniz. Hesabınızı doğrulamak ve şifrenizi belirlemek için aşağıdaki bağlantıya tıklayınız:

${verifyUrl}

Bu bağlantı 24 saat süreyle geçerlidir.

Saygılarımızla,
Kurum İçi Evrak Sistemi`;
      
      const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hesap Doğrulama</h2>
        <p>Sayın <strong>${user.firstName} ${user.lastName}</strong>,</p>
        <p>Kurum İçi Evrak Sistemine hoş geldiniz. Hesabınızı doğrulamak ve şifrenizi belirlemek için aşağıdaki butona tıklayınız:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Hesabımı Doğrula</a>
        </div>
        
        <p>Bu bağlantı 24 saat süreyle geçerlidir.</p>
        
        <p>Saygılarımızla,<br>Kurum İçi Evrak Sistemi</p>
      </div>
      `;
      
      const result = await emailService.sendEmail({
        to: user.email,
        subject,
        text,
        html
      });
      
      logger.info(`Doğrulama e-postası gönderildi: ${user.email}`);
      
      // Eğer önizleme URL'si varsa logla
      if (result.previewUrl) {
        logger.info(`Doğrulama e-postası önizleme URL'si: ${result.previewUrl}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Doğrulama e-postası gönderme hatası: ${error.message}`);
      
      // Test ortamında hata fırlatma, sadece log
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        logger.warn('Test ortamında doğrulama e-postası gönderimi başarısız, ancak işlem devam edecek');
        return {
          error: error.message,
          simulated: true
        };
      }
      
      throw error;
    }
  }
  
  /**
   * E-posta doğrulama token'ını kontrol eder
   * @param {string} token - Doğrulama token'ı
   * @returns {Promise<Object>} Kullanıcı bilgisi
   */
  async verifyEmail(token) {
    try {
      // Token'ı doğrula
      const decoded = jwt.verify(token, jwtConfig.secret);
      
      // Kullanıcıyı bul
      const user = await User.findById(decoded.id);
      
      // Kullanıcı bulunamadıysa
      if (!user) {
        throw new Error('Geçersiz token');
      }
      
      // Kullanıcı zaten doğrulanmışsa
      if (user.isVerified) {
        throw new Error('Hesap zaten doğrulanmış');
      }
      
      return user;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Doğrulama bağlantısının süresi dolmuş');
      }
      logger.error(`E-posta doğrulama hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Kullanıcı şifresini belirler ve hesabı aktifleştirir
   * @param {string} userId - Kullanıcı ID
   * @param {string} password - Yeni şifre
   * @returns {Promise<Object>} Güncellenmiş kullanıcı
   */
  async setPassword(userId, password) {
    try {
      // Kullanıcıyı bul
      const user = await User.findById(userId);
      
      // Kullanıcı bulunamadıysa
      if (!user) {
        throw new Error('Kullanıcı bulunamadı');
      }
      
      // Şifreyi güncelle
      user.password = password;
      user.isVerified = true;
      user.isActive = true;
      
      await user.save();
      
      // İşlemi logla
      await Log.logUserAction(
        user._id,
        'verify-account',
        `Hesap doğrulandı ve şifre belirlendi: ${user.email}`,
        { userId: user._id }
      );
      
      return user;
    } catch (error) {
      logger.error(`Şifre belirleme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Test kullanıcılarını toplu olarak aktifleştirir
   * @returns {Promise<Object>} İşlem sonucu
   */
  async bulkActivateDummyUsers() {
    try {
      // @example.com uzantılı ve aktif olmayan kullanıcıları bul
      const dummyUsers = await User.find({
        email: /.*@example\.com$/,
        isActive: false
      });
      
      if (dummyUsers.length === 0) {
        return { message: 'Aktifleştirilecek test kullanıcısı bulunamadı', count: 0 };
      }
      
      // Her kullanıcı için rastgele şifre oluştur ve aktifleştir
      const updatedUsers = [];
      
      for (const user of dummyUsers) {
        // Rastgele şifre oluştur
        const randomPassword = crypto.randomBytes(5).toString('hex') + 'A1';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(randomPassword, salt);
        
        // Kullanıcıyı güncelle
        user.password = hashedPassword;
        user.isVerified = true;
        user.isActive = true;
        await user.save();
        
        // Şifreyi kaydet (gerçek ortamda yapılmaz, sadece test için)
        updatedUsers.push({
          id: user._id,
          email: user.email,
          password: randomPassword
        });
        
        // İşlemi logla
        await Log.logUserAction(
          user._id,
          'bulk-activate',
          `Test kullanıcısı aktifleştirildi: ${user.email}`,
          { userId: user._id }
        );
      }
      
      return {
        message: `${dummyUsers.length} test kullanıcısı başarıyla aktifleştirildi`,
        count: dummyUsers.length,
        users: updatedUsers
      };
    } catch (error) {
      logger.error(`Test kullanıcılarını aktifleştirme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kullanıcıyı siler (admin tarafından)
   * @param {string} userId - Silinecek kullanıcının ID'si
   * @returns {Promise<Object>} Silme işlemi sonucu
   */
  async deleteUser(userId) {
    try {
      // Kullanıcının var olup olmadığını kontrol et
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('Kullanıcı bulunamadı');
      }
      
      // Admin kullanıcıları silmeyi engelle (güvenlik önlemi)
      if (user.role === 'ADMIN' && user.email === 'admin@example.com') {
        throw new Error('Ana admin hesabı silinemez');
      }
      
      logger.info(`Kullanıcı siliniyor: ${user.email} (ID: ${userId})`);
      
      // Kullanıcıyı sil
      await User.findByIdAndDelete(userId);
      
      // İşlemi logla
      await Log.logUserAction(
        userId,
        'delete-user',
        `Kullanıcı silindi: ${user.email}`,
        { userId: userId }
      );
      
      logger.info(`Kullanıcı başarıyla silindi: ${user.email} (ID: ${userId})`);
      
      return { success: true, message: `Kullanıcı başarıyla silindi: ${user.email}` };
    } catch (error) {
      logger.error(`Kullanıcı silme hatası: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new UserService(); 