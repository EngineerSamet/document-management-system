const express = require('express');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const { ROLES, checkRole } = require('../../middleware/role.middleware');
const logger = require('../../utils/logger');
const User = require('../../models/User');

const router = express.Router();

/**
 * Kullanıcı rotaları
 */

// Test endpoint - API'nin çalışıp çalışmadığını kontrol etmek için
router.get('/test', (req, res) => {
  logger.info('User API test endpoint çağrıldı');
  res.status(200).json({
    status: 'success',
    message: 'User API çalışıyor',
    timestamp: new Date().toISOString()
  });
});

/**
 * Debug endpoint - Tüm kullanıcıları filtresiz getirmek için
 * Kimlik doğrulama gerektirmeyen public endpoint
 * YAGNI: Sadece geliştirme ortamında kullanılacak, üretimde kaldırılabilir
 */
router.get('/debug/all', async (req, res) => {
  try {
    logger.info('Debug: Tüm kullanıcılar filtresiz getiriliyor');
    
    // Tüm kullanıcıları getir (filtresiz)
    const users = await User.find({}).select('-password -resetPasswordToken -resetPasswordExpire');
    
    logger.info(`Debug: Toplam ${users.length} kullanıcı bulundu (filtresiz)`);
    
    // Kullanıcıları detaylı logla
    if (users.length > 0) {
      logger.info('Debug: Bulunan kullanıcılar:', users.map(user => ({
        id: user._id,
        email: user.email,
        isActive: user.isActive,
        isVerified: user.isVerified,
        role: user.role
      })));
    } else {
      logger.warn('Debug: Veritabanında hiç kullanıcı bulunamadı!');
    }
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      data: { users }
    });
  } catch (error) {
    logger.error(`Debug: Kullanıcıları getirme hatası: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Kullanıcıları getirirken bir hata oluştu',
      error: error.message
    });
  }
});

// Public rotalar (kimlik doğrulama gerektirmeyen)
router.get('/verify-email', userController.verifyEmail);
router.post('/set-password', userController.setPassword);

// Tüm rotalarda kimlik doğrulama gerekli
router.use(authMiddleware.protect);

/**
 * ÖNEMLİ: Express.js route'ları tanımlandıkları sırayla değerlendirir.
 * Bu nedenle, özel endpoint'leri (örneğin '/profile') dinamik route'lardan (örneğin '/:id') ÖNCE tanımlamalıyız.
 * Aksi takdirde, Express.js '/profile' isteğini '/:id' route'una yönlendirir ve 'id' parametresini 'profile' olarak alır.
 * Bu da MongoDB'nin 'profile' string'ini bir ObjectId olarak yorumlamaya çalışmasına ve hata vermesine neden olur.
 */

// ÖNEMLİ: Özel endpoint'leri dinamik route'lardan ÖNCE tanımla
// Kullanıcı profili güncelleme - özel endpoint
router.put('/profile', async (req, res, next) => {
  try {
    // İstek yapan kullanıcının ID'sini kullan
    const userId = req.user._id;
    const updateData = req.body;
    
    logger.info(`Kullanıcı profili güncelleniyor: ${userId} (${req.user.email})`);
    logger.debug(`Profil güncelleme verileri:`, updateData);
    
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
    
    logger.debug(`İşlenmiş profil güncelleme verileri:`, updateData);
    
    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true
    }).select('-password -resetPasswordToken -resetPasswordExpire');
    
    if (!user) {
      logger.error(`Profil güncellenirken kullanıcı bulunamadı: ${userId}`);
      return res.status(404).json({
        status: 'error',
        message: 'Kullanıcı bulunamadı'
      });
    }
    
    logger.info(`Profil başarıyla güncellendi: ${userId} (${user.email})`);
    
    res.status(200).json({
      status: 'success',
      message: 'Profil bilgileri güncellendi',
      data: { user }
    });
  } catch (error) {
    logger.error(`Profil güncelleme hatası: ${error.message}`);
    next(error);
  }
});

// Şifre değiştirme endpoint'i - kullanıcının kendi şifresini değiştirmesi için
router.post('/change-password', userController.changePassword);

// Tüm kullanıcıları getirme (kimlik doğrulaması yeterli)
router.get('/', userController.getAllUsers);

// Kullanıcı arama
router.get('/search', userController.searchUsers);

// Departmana göre kullanıcıları getirme
router.get('/department/:department', userController.getUsersByDepartment);

// Admin rotaları
// Tüm kullanıcıları getirme (sadece admin)
router.get(
  '/admin/all',
  checkRole([ROLES.ADMIN]),
  userController.getAllUsers
);

// Yeni kullanıcı oluşturma (sadece admin)
router.post(
  '/admin/create',
  checkRole([ROLES.ADMIN]),
  userController.createUser
);

// Test kullanıcılarını toplu aktifleştirme (sadece admin)
router.post(
  '/admin/bulk-activate-dummy',
  checkRole([ROLES.ADMIN]),
  userController.bulkActivateDummyUsers
);

// ÖNEMLİ: Dinamik route'lar en sonda tanımlanmalıdır
// Kullanıcı detaylarını getirme
router.get('/:id', userController.getUserById);

// Kullanıcı bilgilerini güncelleme
router.put('/:id', userController.updateUser);

// Kullanıcı rolünü güncelleme (sadece admin)
router.patch(
  '/:id/role',
  checkRole([ROLES.ADMIN]),
  userController.updateUserRole
);

// Kullanıcıyı aktif/pasif yapma (sadece admin)
router.patch(
  '/:id/status',
  checkRole([ROLES.ADMIN]),
  userController.toggleUserStatus
);

// Kullanıcıyı silme (sadece admin)
router.delete(
  '/:id',
  checkRole([ROLES.ADMIN]),
  userController.deleteUser
);

module.exports = router;
