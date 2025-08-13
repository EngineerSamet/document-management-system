const authService = require('../services/auth.service');
const logger = require('../../utils/logger');

/**
 * Kimlik doğrulama kontrolcüsü
 */
class AuthController {
  /**
   * Kullanıcı kaydı yapar
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async register(req, res, next) {
    try {
      const userData = req.body;
      
      const user = await authService.register(userData);
      
      res.status(201).json({
        status: 'success',
        message: 'Kullanıcı başarıyla oluşturuldu',
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            department: user.department,
            position: user.position
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Kullanıcı girişi yapar
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      
      const { user, token, refreshToken } = await authService.login(email, password);
      
      // Rol değerinin büyük harfle olduğundan emin ol
      const userRole = user.role ? user.role.toUpperCase() : user.role;
      
      res.status(200).json({
        status: 'success',
        message: 'Giriş başarılı',
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: userRole,
            department: user.department,
            position: user.position
          },
          token,
          refreshToken
        }
      });
    } catch (error) {
      // Özel hata durumları için HTTP status kodlarını ayarla
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          status: 'error',
          message: error.message
        });
      }
      
      // Diğer hatalar için 500 Internal Server Error döndür
      next(error);
    }
  }
  
  /**
   * Kullanıcı çıkışı yapar
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async logout(req, res, next) {
    try {
      const userId = req.user.id;
      
      // Çıkış işlemini loglama
      await authService.logout(userId);
      
      res.status(200).json({
        status: 'success',
        message: 'Çıkış başarılı'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Token yeniler
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Yenileme token\'ı gerekli'
        });
      }
      
      const { user, token } = await authService.refreshToken(refreshToken);
      
      res.status(200).json({
        status: 'success',
        message: 'Token başarıyla yenilendi',
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            department: user.department,
            position: user.position
          },
          token
        }
      });
    } catch (error) {
      // Özel hata durumları için HTTP status kodlarını ayarla
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          status: 'error',
          message: error.message
        });
      }
      
      // Token hatalarını özel olarak işle
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Geçersiz veya süresi dolmuş token'
        });
      }
      
      next(error);
    }
  }
  
  /**
   * Şifre sıfırlama isteği oluşturur
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'E-posta adresi gerekli'
        });
      }
      
      await authService.forgotPassword(email);
      
      // Güvenlik için her zaman başarılı yanıt döndür
      res.status(200).json({
        status: 'success',
        message: 'Şifre sıfırlama talimatları e-posta adresinize gönderildi'
      });
    } catch (error) {
      logger.error(`Şifre sıfırlama isteği hatası: ${error.message}`);
      
      // Güvenlik için her zaman başarılı yanıt döndür
      res.status(200).json({
        status: 'success',
        message: 'Şifre sıfırlama talimatları e-posta adresinize gönderildi'
      });
    }
  }
  
  /**
   * Şifre sıfırlar
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Token ve yeni şifre gerekli'
        });
      }
      
      await authService.resetPassword(token, password);
      
      res.status(200).json({
        status: 'success',
        message: 'Şifre başarıyla sıfırlandı'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Şifre değiştirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Mevcut şifre ve yeni şifre gerekli'
        });
      }
      
      await authService.changePassword(userId, currentPassword, newPassword);
      
      res.status(200).json({
        status: 'success',
        message: 'Şifre başarıyla değiştirildi'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Mevcut kullanıcı bilgilerini döndürür
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   */
  getMe(req, res) {
    res.status(200).json({
      status: 'success',
      data: {
        user: req.user
      }
    });
  }
}

module.exports = new AuthController();
