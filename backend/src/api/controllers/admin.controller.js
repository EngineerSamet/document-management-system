const adminService = require('../services/admin.service');
const logger = require('../../config/logger');

/**
 * Admin controller sınıfı
 * Admin paneli için gerekli işlemleri yönetir
 */
class AdminController {
  /**
   * Sistem istatistiklerini getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getSystemStats(req, res, next) {
    try {
      logger.info('AdminController.getSystemStats çağrıldı');
      
      const stats = await adminService.getSystemStats();
      
      res.status(200).json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      logger.error(`Sistem istatistiklerini getirme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Tüm onay akışlarını siler
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async deleteAllApprovalFlows(req, res, next) {
    try {
      logger.info('AdminController.deleteAllApprovalFlows çağrıldı');
      
      const result = await adminService.deleteAllApprovalFlows();
      
      res.status(200).json({
        status: 'success',
        message: `${result.deletedCount} onay akışı başarıyla silindi`,
        data: { deletedCount: result.deletedCount }
      });
    } catch (error) {
      logger.error(`Tüm onay akışlarını silme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Admin tarafından yeni kullanıcı oluşturur
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async createUserByAdmin(req, res, next) {
    try {
      logger.info('AdminController.createUserByAdmin çağrıldı');
      
      const { firstName, lastName, email, password, role } = req.body;
      
      // Gerekli alanların kontrolü
      if (!firstName || !lastName || !email || !password || !role) {
        return res.status(400).json({
          status: 'error',
          message: 'Lütfen tüm zorunlu alanları doldurun (ad, soyad, e-posta, şifre, rol)'
        });
      }
      
      // Geçerli roller kontrolü
      const validRoles = ['ADMIN', 'MANAGER', 'OFFICER', 'OBSERVER'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          status: 'error',
          message: 'Geçersiz rol. Rol şunlardan biri olmalıdır: ADMIN, MANAGER, OFFICER, OBSERVER'
        });
      }
      
      // Kullanıcı oluştur
      const user = await adminService.createUserWithAdminPrivileges({
        firstName,
        lastName,
        email,
        password,
        role
      });
      
      // Şifreyi yanıttan çıkar
      user.password = undefined;
      
      res.status(201).json({
        status: 'success',
        message: 'Kullanıcı başarıyla oluşturuldu',
        data: { user }
      });
    } catch (error) {
      logger.error(`Kullanıcı oluşturma hatası: ${error.message}`);
      
      // Duplicate email hatası
      if (error.code === 11000) {
        return res.status(409).json({
          status: 'error',
          message: 'Bu e-posta adresi ile kayıtlı bir kullanıcı zaten var'
        });
      }
      
      next(error);
    }
  }
  
  /**
   * Veritabanındaki tüm kullanıcıları getirir (filtresiz, debug amaçlı)
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getAllUsersDebug(req, res, next) {
    try {
      logger.info('AdminController.getAllUsersDebug çağrıldı - Tüm kullanıcılar filtresiz getiriliyor');
      
      // Kullanıcı modelini import et
      const User = require('../../models/User');
      
      // Tüm kullanıcıları getir (filtresiz)
      const users = await User.find({}).select('-password -resetPasswordToken -resetPasswordExpire');
      
      logger.info(`Veritabanında toplam ${users.length} kullanıcı bulundu (filtresiz)`);
      
      // Kullanıcıları detaylı logla
      if (users.length > 0) {
        logger.info('Bulunan kullanıcılar:', users.map(user => ({
          id: user._id,
          email: user.email,
          isActive: user.isActive,
          isVerified: user.isVerified,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        })));
      } else {
        logger.warn('⚠️ Veritabanında hiç kullanıcı bulunamadı!');
      }
      
      res.status(200).json({
        status: 'success',
        results: users.length,
        data: { users }
      });
    } catch (error) {
      logger.error(`Kullanıcıları getirme hatası (debug): ${error.message}`);
      next(error);
    }
  }
}

module.exports = new AdminController(); 