const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const roleMiddleware = require('../../middleware/role.middleware');
const User = require('../../models/User');
const logger = require('../../utils/logger');

/**
 * @route   GET /api/admin/stats
 * @desc    Sistem istatistiklerini getirir
 * @access  Private (Sadece ADMIN)
 */
router.get('/stats', 
  authMiddleware.protect, 
  authMiddleware.isAdmin, 
  adminController.getSystemStats
);

/**
 * @route   DELETE /api/admin/approval-flows/all
 * @desc    Tüm onay akışlarını siler
 * @access  Private (Sadece ADMIN)
 */
router.delete('/approval-flows/all',
  authMiddleware.protect,
  authMiddleware.isAdmin,
  adminController.deleteAllApprovalFlows
);

/**
 * @route   POST /api/admin/users
 * @desc    Yeni kullanıcı oluşturur (sadece admin yetkisi ile)
 * @access  Private (Sadece ADMIN)
 */
router.post('/users', 
  authMiddleware.protect, 
  authMiddleware.isAdmin, 
  adminController.createUserByAdmin
);

/**
 * @route   GET /api/admin/users/debug
 * @desc    Tüm kullanıcıları getirir (filtresiz, debug amaçlı)
 * @access  Public (Kimlik doğrulama gerektirmez)
 * YAGNI: Sadece geliştirme ortamında kullanılacak, üretimde kaldırılabilir
 */
router.get('/users/debug', async (req, res) => {
  try {
    logger.info('Admin Debug: Tüm kullanıcılar filtresiz getiriliyor');
    
    // Tüm kullanıcıları getir (filtresiz)
    const users = await User.find({}).select('-password -resetPasswordToken -resetPasswordExpire');
    
    logger.info(`Admin Debug: Toplam ${users.length} kullanıcı bulundu (filtresiz)`);
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      data: { users }
    });
  } catch (error) {
    logger.error(`Admin Debug: Kullanıcıları getirme hatası: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Kullanıcıları getirirken bir hata oluştu',
      error: error.message
    });
  }
});

module.exports = router; 