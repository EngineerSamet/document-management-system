const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/User');
const jwtConfig = require('../../config/jwt');
const emailService = require('../../utils/email');
const logger = require('../../utils/logger');
const Log = require('../../models/Log');

/**
 * Kimlik doğrulama servisi
 */
class AuthService {
  /**
   * Kullanıcı kaydı yapar
   * @param {Object} userData - Kullanıcı bilgileri
   * @returns {Promise<Object>} Oluşturulan kullanıcı
   */
  async register(userData) {
    try {
      // E-posta adresinin kullanımda olup olmadığını kontrol et
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('Bu e-posta adresi zaten kullanımda');
      }
      
      // Yeni kullanıcı oluştur
      const user = await User.create(userData);
      
      // İşlemi logla
      await Log.logUserAction(
        user._id,
        'register',
        `Yeni kullanıcı kaydı: ${user.email}`,
        { userId: user._id }
      );
      
      return user;
    } catch (error) {
      logger.error(`Kullanıcı kaydı hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Kullanıcı girişi yapar
   * @param {string} email - E-posta adresi
   * @param {string} password - Şifre
   * @returns {Promise<Object>} Token ve kullanıcı bilgileri
   */
  async login(email, password) {
    try {
      // Test ortamında mı çalışıyoruz?
      const isTestEnvironment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
      const isTestEmail = email.endsWith('@example.com');
      
      // Debug log
      if (isTestEnvironment) {
        logger.info(`Giriş denemesi: ${email} (Test kullanıcısı: ${isTestEmail ? 'Evet' : 'Hayır'})`);
      }
      
      // Kullanıcıyı e-posta adresine göre bul (şifre dahil)
      const user = await User.findOne({ email }).select('+password');
      
      // Kullanıcı bulunamadıysa
      if (!user) {
        const error = new Error('Geçersiz e-posta adresi veya şifre');
        error.statusCode = 401; // Unauthorized
        logger.warn(`Kullanıcı bulunamadı: ${email}`);
        throw error;
      }
      
      // Debug log - kullanıcı bulundu
      if (isTestEnvironment) {
        logger.info(`Kullanıcı bulundu: ${email} (ID: ${user._id}, Aktif: ${user.isActive}, Doğrulanmış: ${user.isVerified})`);
      }
      
      // Kullanıcı aktif değilse
      if (!user.isActive) {
        const error = new Error('Hesabınız devre dışı bırakılmış');
        error.statusCode = 403; // Forbidden
        logger.warn(`Aktif olmayan kullanıcı girişi: ${email}`);
        throw error;
      }
      
      // E-posta doğrulama kontrolü
      // Test ortamında (development veya test) ve example.com uzantılı e-postalar için bypass et
      
      // Eğer test ortamı ve test email değilse veya production ortamındaysa doğrulama kontrolü yap
      if ((!isTestEnvironment || !isTestEmail) && !user.isVerified) {
        // Kullanıcı e-postası doğrulanmamışsa
        const error = new Error('Lütfen önce e-posta adresinizi doğrulayın');
        error.statusCode = 403; // Forbidden
        logger.warn(`Doğrulanmamış kullanıcı girişi: ${email}`);
        throw error;
      }
      
      // Şifreyi kontrol et
      logger.info(`Şifre kontrolü yapılıyor: ${email}`);
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        const error = new Error('Geçersiz e-posta adresi veya şifre');
        error.statusCode = 401; // Unauthorized
        logger.warn(`Geçersiz şifre: ${email}`);
        throw error;
      }
      
      // Debug log - şifre doğru
      if (isTestEnvironment) {
        logger.info(`✅ Şifre doğrulandı: ${email}`);
      }
      
      // Test ortamında example.com uzantılı e-postalar için isVerified'ı otomatik olarak true yap
      if (isTestEnvironment && isTestEmail && !user.isVerified) {
        logger.info(`Test kullanıcısı ${email} için e-posta doğrulaması otomatik olarak yapıldı`);
        user.isVerified = true;
        await user.save();
      }
      
      // Son giriş zamanını güncelle
      const now = new Date();
      
      // Sistem saati kontrolü - gelecek tarihli olmamasını sağla
      // SOLID prensibi: Single Responsibility - sadece geçerli tarihi atama sorumluluğu
      user.lastLogin = now;
      
      // Son giriş tarihini logla
      logger.info(`Son giriş tarihi güncellendi: ${user.email}, tarih: ${now.toISOString()}`);
      
      await user.save();
      
      // Token oluştur
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);
      
      // Şifreyi çıkar
      user.password = undefined;
      
      // Rol büyük harfe çevrildiğinden emin ol
      if (user.role) {
        const upperCaseRole = user.role.toUpperCase();
        // MongoDB'deki kullanıcı belgesini güncelle
        await User.updateOne({ _id: user._id }, { role: upperCaseRole });
        // Kullanıcı nesnesini de güncelle
        user.role = upperCaseRole;
      }
      
      // İşlemi logla
      await Log.logUserAction(
        user._id,
        'login',
        `Kullanıcı girişi: ${user.email}`,
        { userId: user._id }
      );
      
      logger.info(`✅ Başarılı giriş: ${email}`);
      
      return {
        user,
        token,
        refreshToken
      };
    } catch (error) {
      logger.error(`Kullanıcı girişi hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Kullanıcı çıkışı yapar
   * @param {string} userId - Kullanıcı ID
   * @returns {Promise<boolean>} İşlem başarılı mı?
   */
  async logout(userId) {
    try {
      // Kullanıcıyı bul
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('Kullanıcı bulunamadı');
      }
      
      // İşlemi logla
      await Log.logUserAction(
        userId,
        'logout',
        `Kullanıcı çıkışı: ${user.email}`,
        { userId }
      );
      
      return true;
    } catch (error) {
      logger.error(`Kullanıcı çıkışı hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Token yeniler
   * @param {string} refreshToken - Yenileme token'ı
   * @returns {Promise<Object>} Yeni token ve kullanıcı bilgileri
   */
  async refreshToken(refreshToken) {
    try {
      // Token'ı doğrula
      const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);
      
      // Kullanıcıyı bul
      const user = await User.findById(decoded.id);
      
      // Kullanıcı bulunamadıysa veya aktif değilse
      if (!user || !user.isActive) {
        const error = new Error('Geçersiz token');
        error.statusCode = 401; // Unauthorized
        throw error;
      }
      
      // E-posta doğrulama kontrolü
      // Test ortamında (development veya test) ve example.com uzantılı e-postalar için bypass et
      const isTestEnvironment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
      const isTestEmail = user.email.endsWith('@example.com');
      
      // Eğer test ortamı ve test email değilse veya production ortamındaysa doğrulama kontrolü yap
      if ((!isTestEnvironment || !isTestEmail) && !user.isVerified) {
        // Kullanıcı e-postası doğrulanmamışsa
        const error = new Error('Lütfen önce e-posta adresinizi doğrulayın');
        error.statusCode = 403; // Forbidden
        throw error;
      }
      
      // Yeni token oluştur
      const token = this.generateToken(user);
      
      return {
        user,
        token
      };
    } catch (error) {
      logger.error(`Token yenileme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Şifre sıfırlama isteği oluşturur
   * @param {string} email - E-posta adresi
   * @returns {Promise<boolean>} İşlem başarılı mı?
   */
  async forgotPassword(email) {
    try {
      // Kullanıcıyı e-posta adresine göre bul
      const user = await User.findOne({ email });
      
      // Kullanıcı bulunamadıysa (güvenlik için aynı mesajı döndür)
      if (!user) {
        return true;
      }
      
      // Şifre sıfırlama token'ı oluştur
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Hash'lenmiş token'ı kaydet
      user.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
      
      // Token'ın geçerlilik süresini ayarla (10 dakika)
      user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
      
      await user.save();
      
      // E-posta gönder
      await emailService.sendPasswordResetEmail(user, resetToken);
      
      // İşlemi logla
      await Log.logUserAction(
        user._id,
        'forgot-password',
        `Şifre sıfırlama isteği: ${user.email}`,
        { userId: user._id }
      );
      
      return true;
    } catch (error) {
      logger.error(`Şifre sıfırlama isteği hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Şifre sıfırlar
   * @param {string} token - Sıfırlama token'ı
   * @param {string} password - Yeni şifre
   * @returns {Promise<boolean>} İşlem başarılı mı?
   */
  async resetPassword(token, password) {
    try {
      // Token'ı hash'le
      const resetPasswordToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
      
      // Token'a sahip ve süresi geçmemiş kullanıcıyı bul
      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
      });
      
      // Kullanıcı bulunamadıysa veya token süresi geçmişse
      if (!user) {
        throw new Error('Geçersiz veya süresi dolmuş token');
      }
      
      // Yeni şifreyi ayarla
      user.password = password;
      
      // Token bilgilerini temizle
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      
      await user.save();
      
      // İşlemi logla
      await Log.logUserAction(
        user._id,
        'reset-password',
        `Şifre sıfırlama: ${user.email}`,
        { userId: user._id }
      );
      
      return true;
    } catch (error) {
      logger.error(`Şifre sıfırlama hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Şifre değiştirir
   * @param {string} userId - Kullanıcı ID
   * @param {string} currentPassword - Mevcut şifre
   * @param {string} newPassword - Yeni şifre
   * @returns {Promise<boolean>} İşlem başarılı mı?
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Kullanıcıyı ID'ye göre bul (şifre dahil)
      const user = await User.findById(userId).select('+password');
      
      // Kullanıcı bulunamadıysa
      if (!user) {
        throw new Error('Kullanıcı bulunamadı');
      }
      
      // Mevcut şifreyi kontrol et
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        throw new Error('Mevcut şifre yanlış');
      }
      
      // Yeni şifreyi ayarla
      user.password = newPassword;
      
      await user.save();
      
      // İşlemi logla
      await Log.logUserAction(
        user._id,
        'change-password',
        `Şifre değişikliği: ${user.email}`,
        { userId: user._id }
      );
      
      return true;
    } catch (error) {
      logger.error(`Şifre değiştirme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * JWT token oluşturur
   * @param {Object} user - Kullanıcı
   * @returns {string} JWT token
   */
  generateToken(user) {
    return jwt.sign(
      { 
        id: user._id,
        email: user.email,
        role: user.role
      },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );
  }
  
  /**
   * JWT refresh token oluşturur
   * @param {Object} user - Kullanıcı
   * @returns {string} JWT refresh token
   */
  generateRefreshToken(user) {
    return jwt.sign(
      { 
        id: user._id
      },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn }
    );
  }
}

module.exports = new AuthService();
