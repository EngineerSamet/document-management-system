const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../../middleware/auth.middleware');
const {
  registerValidationRules,
  loginValidationRules,
  refreshTokenValidationRules,
  forgotPasswordValidationRules,
  resetPasswordValidationRules,
  changePasswordValidationRules
} = require('../validators/auth.validator');
const { checkRole, ROLES } = require('../../middleware/role.middleware');

/**
 * @route POST /api/auth/register
 * @desc Kullanıcı kaydı
 * @access Public
 */
router.post('/register', registerValidationRules, authController.register);

/**
 * @route POST /api/auth/login
 * @desc Kullanıcı girişi
 * @access Public
 */
router.post('/login', loginValidationRules, authController.login);

/**
 * @route POST /api/auth/refresh-token
 * @desc Token yenileme
 * @access Public
 */
router.post('/refresh-token', refreshTokenValidationRules, authController.refreshToken);

/**
 * @route POST /api/auth/forgot-password
 * @desc Şifre sıfırlama isteği
 * @access Public
 */
router.post('/forgot-password', forgotPasswordValidationRules, authController.forgotPassword);

/**
 * @route POST /api/auth/reset-password
 * @desc Şifre sıfırlama
 * @access Public
 */
router.post('/reset-password', resetPasswordValidationRules, authController.resetPassword);

/**
 * @route POST /api/auth/change-password
 * @desc Şifre değiştirme
 * @access Private
 */
router.post(
  '/change-password',
  protect,
  changePasswordValidationRules,
  authController.changePassword
);

/**
 * @route GET /api/auth/me
 * @desc Mevcut kullanıcı bilgilerini döndürür
 * @access Private
 */
router.get('/me', protect, authController.getMe);

/**
 * @route POST /api/auth/logout
 * @desc Kullanıcı çıkışı
 * @access Private
 */
router.post('/logout', protect, authController.logout);

/**
 * @route POST /api/auth/admin/register
 * @desc Yönetici tarafından kullanıcı kaydı
 * @access Private/Admin
 */
router.post(
  '/admin/register',
  protect,
  checkRole([ROLES.ADMIN]),
  registerValidationRules,
  authController.register
);

module.exports = router;
