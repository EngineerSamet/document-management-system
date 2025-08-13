const User = require('../../models/User');
const userService = require('../services/user.service');
const logger = require('../../utils/logger');
const Log = require('../../models/Log');

/**
 * Kullanıcı kontrolcüsü
 */
class UserController {
  /**
   * Tüm kullanıcıları getirir (sadece admin)
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getAllUsers(req, res, next) {
    try {
      // Test ortamında tüm kullanıcıları getir, production'da sadece aktif olanları
      const isTestEnvironment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
      
      // ÖNEMLİ: Filtre kaldırıldı - tüm kullanıcıları getir
      // const filter = isTestEnvironment ? {} : { isActive: true };
      const filter = {}; // Tüm kullanıcıları getir, filtre yok
      
      logger.info(`Tüm kullanıcılar getiriliyor. Test ortamı: ${isTestEnvironment}, Filtre: ${JSON.stringify(filter)}`);
      
      // Veritabanındaki tüm kullanıcı sayısını kontrol et (filtresiz)
      const totalUserCount = await User.countDocuments({});
      logger.info(`Veritabanında toplam ${totalUserCount} kullanıcı bulundu`);
      
      // Hiç kullanıcı yoksa uyarı ver
      if (totalUserCount === 0) {
        logger.warn('⚠️ Veritabanında hiç kullanıcı bulunamadı!');
      }
      
      // Filtreli kullanıcıları getir
      const users = await User.find(filter).select('-password -resetPasswordToken -resetPasswordExpire');
      
      logger.info(`Filtrelenmiş ${users.length} kullanıcı bulundu`);
      
      // Kullanıcı listesini detaylı logla
      if (users.length > 0) {
        logger.info('Bulunan kullanıcılar:', users.map(user => ({
          id: user._id,
          email: user.email,
          isActive: user.isActive,
          isVerified: user.isVerified,
          role: user.role
        })));
      } else {
        logger.warn('⚠️ Hiç kullanıcı bulunamadı! Veritabanını kontrol edin.');
      }
      
      res.status(200).json({
        status: 'success',
        results: users.length,
        data: { users }
      });
    } catch (error) {
      logger.error(`Kullanıcıları getirme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Kullanıcı detaylarını getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      
      const user = await User.findById(id).select('-password -resetPasswordToken -resetPasswordExpire');
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Kullanıcı bulunamadı'
        });
      }
      
      res.status(200).json({
        status: 'success',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Kullanıcı bilgilerini günceller
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Güvenlik için hassas alanları kaldır
      delete updateData.password;
      delete updateData.role; // Rol değişikliği ayrı bir endpoint üzerinden yapılmalı
      delete updateData.resetPasswordToken;
      delete updateData.resetPasswordExpire;
      
      // Departman ve pozisyon alanlarını kontrol et
      if (updateData.department === '') {
        updateData.department = null;
      }
      
      if (updateData.position === '') {
        updateData.position = null;
      }
      
      logger.info(`Kullanıcı güncelleniyor: ${id}, veri:`, updateData);
      
      const user = await User.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true
      }).select('-password -resetPasswordToken -resetPasswordExpire');
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Kullanıcı bulunamadı'
        });
      }
      
      res.status(200).json({
        status: 'success',
        message: 'Kullanıcı bilgileri güncellendi',
        data: { user }
      });
    } catch (error) {
      logger.error(`Kullanıcı güncelleme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Kullanıcı rolünü günceller (sadece admin)
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async updateUserRole(req, res, next) {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      if (!role) {
        return res.status(400).json({
          status: 'error',
          message: 'Rol belirtilmedi'
        });
      }
      
      const user = await User.findByIdAndUpdate(id, { role }, {
        new: true,
        runValidators: true
      }).select('-password -resetPasswordToken -resetPasswordExpire');
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Kullanıcı bulunamadı'
        });
      }
      
      res.status(200).json({
        status: 'success',
        message: 'Kullanıcı rolü güncellendi',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Kullanıcıyı aktif/pasif yapar
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async toggleUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      
      const user = await User.findById(id);
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Kullanıcı bulunamadı'
        });
      }
      
      // Durumu tersine çevir
      user.isActive = !user.isActive;
      await user.save();
      
      const status = user.isActive ? 'aktif' : 'pasif';
      
      res.status(200).json({
        status: 'success',
        message: `Kullanıcı durumu ${status} olarak güncellendi`,
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            department: user.department,
            position: user.position,
            isActive: user.isActive
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Departmana göre kullanıcıları getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getUsersByDepartment(req, res, next) {
    try {
      const { department } = req.params;
      
      const users = await User.find({ 
        department,
        isActive: true 
      }).select('-password -resetPasswordToken -resetPasswordExpire');
      
      res.status(200).json({
        status: 'success',
        results: users.length,
        data: { users }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Kullanıcı arama
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async searchUsers(req, res, next) {
    try {
      const { query } = req.query;
      
      if (!query) {
        return res.status(400).json({
          status: 'error',
          message: 'Arama sorgusu gerekli'
        });
      }
      
      const users = await User.find({
        $or: [
          { firstName: { $regex: query, $options: 'i' } },
          { lastName: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
          { department: { $regex: query, $options: 'i' } },
          { position: { $regex: query, $options: 'i' } }
        ],
        isActive: true
      }).select('-password -resetPasswordToken -resetPasswordExpire');
      
      res.status(200).json({
        status: 'success',
        results: users.length,
        data: { users }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Yeni kullanıcı oluşturur (admin tarafından)
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async createUser(req, res, next) {
    try {
      const userData = req.body;
      
      // Test ortamında mı çalışıyoruz?
      const isTestEnvironment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
      const isTestEmail = userData.email && userData.email.endsWith('@example.com');
      
      const user = await userService.createUser(userData);
      
      // Yanıt hazırla
      const responseData = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        department: user.department,
        position: user.position,
        isVerified: user.isVerified,
        isActive: user.isActive
      };
      
      // Test kullanıcısı için şifre bilgisini ekle (sadece test ortamında)
      if (isTestEnvironment && isTestEmail && user._testPassword) {
        responseData.testPassword = user._testPassword;
        logger.info(`Test kullanıcısı için şifre bilgisi yanıta eklendi: ${user.email}`);
      }
      
      res.status(201).json({
        status: 'success',
        message: 'Kullanıcı başarıyla oluşturuldu. Doğrulama e-postası gönderildi.',
        data: {
          user: responseData
        }
      });
    } catch (error) {
      logger.error(`Kullanıcı oluşturma controller hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * E-posta doğrulama token'ını kontrol eder
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.query;
      
      if (!token) {
        return res.status(400).json({
          status: 'error',
          message: 'Doğrulama token\'ı gerekli'
        });
      }
      
      const user = await userService.verifyEmail(token);
      
      res.status(200).json({
        status: 'success',
        message: 'E-posta doğrulandı. Şimdi şifrenizi belirleyebilirsiniz.',
        data: {
          userId: user._id,
          email: user.email
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Kullanıcı şifresini belirler ve hesabı aktifleştirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async setPassword(req, res, next) {
    try {
      const { userId, password } = req.body;
      
      if (!userId || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Kullanıcı ID ve şifre gerekli'
        });
      }
      
      await userService.setPassword(userId, password);
      
      res.status(200).json({
        status: 'success',
        message: 'Şifreniz başarıyla belirlendi. Artık giriş yapabilirsiniz.'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Kullanıcı şifresini değiştirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async changePassword(req, res, next) {
    try {
      const userId = req.user._id; // Oturum açmış kullanıcının ID'si
      const { currentPassword, newPassword } = req.body;
      
      // Gerekli alanları kontrol et
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Mevcut şifre ve yeni şifre gereklidir'
        });
      }
      
      // Şifre kurallarını kontrol et
      if (newPassword.length < 8) {
        return res.status(400).json({
          status: 'error',
          message: 'Yeni şifre en az 8 karakter uzunluğunda olmalıdır'
        });
      }
      
      // Şifre karmaşıklık kurallarını kontrol et
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({
          status: 'error',
          message: 'Yeni şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir'
        });
      }
      
      // Kullanıcıyı bul ve şifresini getir
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Kullanıcı bulunamadı'
        });
      }
      
      // Mevcut şifreyi kontrol et
      const isPasswordCorrect = await user.comparePassword(currentPassword);
      
      if (!isPasswordCorrect) {
        return res.status(401).json({
          status: 'error',
          message: 'Mevcut şifre yanlış'
        });
      }
      
      // Yeni şifre eskisiyle aynı olmamalı
      const isSamePassword = await user.comparePassword(newPassword);
      
      if (isSamePassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Yeni şifre mevcut şifre ile aynı olamaz'
        });
      }
      
      // Şifreyi güncelle
      user.password = newPassword;
      await user.save();
      
      logger.info(`Kullanıcı şifresi değiştirildi: ${user.email}`);
      
      // İşlemi logla
      // Log modeli eklendiği için bu kısım aktif hale getirilebilir
      await Log.logUserAction(
        user._id,
        'change-password',
        `Kullanıcı şifresini değiştirdi: ${user.email}`,
        { userId: user._id }
      );
      
      res.status(200).json({
        status: 'success',
        message: 'Şifreniz başarıyla değiştirildi'
      });
    } catch (error) {
      logger.error(`Şifre değiştirme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Test kullanıcılarını toplu olarak aktifleştirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async bulkActivateDummyUsers(req, res, next) {
    try {
      const result = await userService.bulkActivateDummyUsers();
      
      res.status(200).json({
        status: 'success',
        message: result.message,
        data: {
          count: result.count,
          users: result.users
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Kullanıcıyı siler (sadece admin)
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          status: 'error',
          message: 'Kullanıcı ID\'si gerekli'
        });
      }
      
      // Kendini silmeyi engelle
      if (id === req.user.id) {
        return res.status(400).json({
          status: 'error',
          message: 'Kendi hesabınızı silemezsiniz'
        });
      }
      
      logger.info(`Kullanıcı silme isteği: ${id}, İsteyen: ${req.user.email}`);
      
      const result = await userService.deleteUser(id);
      
      res.status(200).json({
        status: 'success',
        message: result.message
      });
    } catch (error) {
      logger.error(`Kullanıcı silme hatası: ${error.message}`);
      
      if (error.message === 'Kullanıcı bulunamadı') {
        return res.status(404).json({
          status: 'error',
          message: error.message
        });
      }
      
      if (error.message === 'Ana admin hesabı silinemez') {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      next(error);
    }
  }
}

module.exports = new UserController();
