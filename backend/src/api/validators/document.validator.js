const { body, param, query, validationResult } = require('express-validator');

/**
 * Evrak doğrulayıcısı
 */
class DocumentValidator {
  /**
   * Doğrulama hatalarını kontrol eder
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  validateRequest(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Doğrulama hataları',
        errors: errors.array()
      });
    }
    next();
  }
  
  /**
   * Evrak oluşturma doğrulama kuralları
   */
  createDocumentRules() {
    return [
      body('title')
        .notEmpty()
        .withMessage('Başlık alanı zorunludur')
        .isLength({ min: 3, max: 255 })
        .withMessage('Başlık 3-255 karakter arasında olmalıdır')
        .trim(),
      
      // Content alanı artık zorunlu değil
      body('content')
        .optional({ checkFalsy: true })
        .isLength({ min: 10 })
        .withMessage('İçerik en az 10 karakter olmalıdır')
        .trim(),
      
      body(['documentType', 'type'])
        .optional()
        .custom((value, { req }) => {
          // Eğer type veya documentType alanlarından biri varsa geçerli kabul et
          return true;
        }),
      
      body('approvalFlowId')
        .optional()
        .isMongoId()
        .withMessage('Geçersiz onay akışı ID'),
      
      body('priority')
        .optional()
        .isIn(['low', 'medium', 'high'])
        .withMessage('Öncelik değeri low, medium veya high olmalıdır'),
      
      body('dueDate')
        .optional()
        .isISO8601()
        .withMessage('Geçersiz tarih formatı'),
      
      body('attachments')
        .optional()
        .isArray()
        .withMessage('Ekler bir dizi olmalıdır'),
      
      body('attachments.*.name')
        .optional()
        .isString()
        .withMessage('Ek adı string olmalıdır'),
      
      body('attachments.*.path')
        .optional()
        .isString()
        .withMessage('Ek yolu string olmalıdır'),
      
      body('attachments.*.mimeType')
        .optional()
        .isString()
        .withMessage('Ek MIME türü string olmalıdır'),
      
      body('metadata')
        .optional()
        .isObject()
        .withMessage('Metadata bir nesne olmalıdır'),
      
      body('tags')
        .optional()
        .custom((value) => {
          // Tags alanı string olarak geliyorsa JSON parse edilerek kontrol edilecek
          if (typeof value === 'string') {
            try {
              const parsedValue = JSON.parse(value);
              if (!Array.isArray(parsedValue)) {
                throw new Error('Etiketler bir dizi olmalıdır');
              }
            } catch (error) {
              throw new Error('Etiketler geçerli bir JSON dizisi olmalıdır');
            }
          } else if (value !== undefined && !Array.isArray(value)) {
            throw new Error('Etiketler bir dizi olmalıdır');
          }
          return true;
        }),
      
      body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Açıklama en fazla 1000 karakter olabilir')
        .trim(),
      
      this.validateRequest
    ];
  }
  
  /**
   * Evrak güncelleme doğrulama kuralları
   */
  updateDocumentRules() {
    return [
      param('id')
        .isMongoId()
        .withMessage('Geçersiz evrak ID'),
      
      body('title')
        .optional()
        .isLength({ min: 3, max: 255 })
        .withMessage('Başlık 3-255 karakter arasında olmalıdır'),
      
      body('content')
        .optional(),
      
      body('documentType')
        .optional(),
      
      body('approvalFlowId')
        .optional()
        .isMongoId()
        .withMessage('Geçersiz onay akışı ID'),
      
      body('priority')
        .optional()
        .isIn(['low', 'medium', 'high'])
        .withMessage('Öncelik değeri low, medium veya high olmalıdır'),
      
      body('dueDate')
        .optional()
        .isISO8601()
        .withMessage('Geçersiz tarih formatı'),
      
      body('attachments')
        .optional()
        .isArray()
        .withMessage('Ekler bir dizi olmalıdır'),
      
      body('metadata')
        .optional()
        .isObject()
        .withMessage('Metadata bir nesne olmalıdır'),
      
      this.validateRequest
    ];
  }
  
  /**
   * Evrak ID doğrulama kuralları
   */
  documentIdRules() {
    return [
      param('id')
        .isMongoId()
        .withMessage('Geçersiz evrak ID'),
      
      this.validateRequest
    ];
  }
  
  /**
   * Evrak onaylama/reddetme doğrulama kuralları
   */
  approveOrRejectDocumentRules() {
    return [
      param('id')
        .isMongoId()
        .withMessage('Geçersiz evrak ID'),
      
      body('isApproved')
        .isBoolean()
        .withMessage('isApproved alanı boolean olmalıdır'),
      
      body('comment')
        .optional()
        .isString()
        .withMessage('Yorum string olmalıdır'),
      
      this.validateRequest
    ];
  }
  
  /**
   * Evrak listeleme doğrulama kuralları
   */
  listDocumentsRules() {
    return [
      query('status')
        .optional()
        .isIn(['draft', 'pending', 'approved', 'rejected', 'completed'])
        .withMessage('Geçersiz durum değeri'),
      
      query('documentType')
        .optional(),
      
      query('search')
        .optional()
        .isString()
        .withMessage('Arama sorgusu string olmalıdır'),
      
      query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Geçersiz başlangıç tarihi formatı'),
      
      query('endDate')
        .optional()
        .isISO8601()
        .withMessage('Geçersiz bitiş tarihi formatı'),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit 1-100 arasında olmalıdır')
        .toInt(),
      
      this.validateRequest
    ];
  }
}

module.exports = new DocumentValidator();
