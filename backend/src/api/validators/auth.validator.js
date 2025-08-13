const { body, validationResult } = require('express-validator');
const { ROLES } = require('../../middleware/role.middleware');

/**
 * Doğrulama hatalarını kontrol eden middleware
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Doğrulama hatası',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Kullanıcı kaydı doğrulama kuralları
 */
const registerValidationRules = [
  body('firstName')
    .notEmpty().withMessage('Ad alanı zorunludur')
    .isLength({ min: 2, max: 50 }).withMessage('Ad 2-50 karakter arasında olmalıdır')
    .trim(),
  
  body('lastName')
    .notEmpty().withMessage('Soyad alanı zorunludur')
    .isLength({ min: 2, max: 50 }).withMessage('Soyad 2-50 karakter arasında olmalıdır')
    .trim(),
  
  body('email')
    .notEmpty().withMessage('E-posta alanı zorunludur')
    .isEmail().withMessage('Geçerli bir e-posta adresi giriniz')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Şifre alanı zorunludur')
    .isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalıdır')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/)
    .withMessage('Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir'),
  
  body('role')
    .optional()
    .isIn(Object.values(ROLES)).withMessage('Geçersiz rol'),
  
  body('department')
    .notEmpty().withMessage('Departman alanı zorunludur')
    .trim(),
  
  body('position')
    .notEmpty().withMessage('Pozisyon alanı zorunludur')
    .trim(),
  
  validateRequest
];

/**
 * Kullanıcı girişi doğrulama kuralları
 */
const loginValidationRules = [
  body('email')
    .notEmpty().withMessage('E-posta alanı zorunludur')
    .isEmail().withMessage('Geçerli bir e-posta adresi giriniz')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Şifre alanı zorunludur'),
  
  validateRequest
];

/**
 * Token yenileme doğrulama kuralları
 */
const refreshTokenValidationRules = [
  body('refreshToken')
    .notEmpty().withMessage('Yenileme token\'ı zorunludur'),
  
  validateRequest
];

/**
 * Şifre sıfırlama isteği doğrulama kuralları
 */
const forgotPasswordValidationRules = [
  body('email')
    .notEmpty().withMessage('E-posta alanı zorunludur')
    .isEmail().withMessage('Geçerli bir e-posta adresi giriniz')
    .normalizeEmail(),
  
  validateRequest
];

/**
 * Şifre sıfırlama doğrulama kuralları
 */
const resetPasswordValidationRules = [
  body('token')
    .notEmpty().withMessage('Token alanı zorunludur'),
  
  body('password')
    .notEmpty().withMessage('Şifre alanı zorunludur')
    .isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalıdır')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/)
    .withMessage('Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir'),
  
  validateRequest
];

/**
 * Şifre değiştirme doğrulama kuralları
 */
const changePasswordValidationRules = [
  body('currentPassword')
    .notEmpty().withMessage('Mevcut şifre alanı zorunludur'),
  
  body('newPassword')
    .notEmpty().withMessage('Yeni şifre alanı zorunludur')
    .isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalıdır')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/)
    .withMessage('Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('Yeni şifre mevcut şifreden farklı olmalıdır');
      }
      return true;
    }),
  
  validateRequest
];

module.exports = {
  registerValidationRules,
  loginValidationRules,
  refreshTokenValidationRules,
  forgotPasswordValidationRules,
  resetPasswordValidationRules,
  changePasswordValidationRules,
  validateRequest
};
