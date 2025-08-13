/**
 * Kullanılabilir roller
 */
const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  OFFICER: 'OFFICER',
  OBSERVER: 'OBSERVER',
};

/**
 * Rol tabanlı yetkilendirme middleware'i
 * Belirli rollere sahip kullanıcıların erişimine izin verir
 * @param  {...String} roles İzin verilen roller
 * @returns {Function} Middleware fonksiyonu
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    // authMiddleware'den gelen kullanıcı bilgisini kontrol et
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Yetkilendirme gerekli',
      });
    }
    
    // Kullanıcının rolünü kontrol et
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Bu işlem için yetkiniz yok',
      });
    }
    
    next();
  };
};

// Model importlarını dosyanın üstüne taşıyalım
const Document = require('../models/Document');
const ApprovalFlow = require('../models/ApprovalFlow');
const logger = require('../utils/logger');

/**
 * Belge erişim kontrolü middleware'i
 * Kullanıcının belgeye erişim yetkisini kontrol eder
 * @param {Object} options Erişim kontrolü seçenekleri
 * @returns {Function} Middleware fonksiyonu
 */
const documentAccessControl = (options = {}) => {
  return async (req, res, next) => {
    try {
      // Parametrelerden belge ID'sini al
      const documentId = req.params.id || req.params.documentId;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Belge ID kontrolü
      if (!documentId) {
        logger.error('Belge erişim kontrolü: Belge ID parametresi bulunamadı');
        return res.status(400).json({
          status: 'error',
          message: 'Belge ID parametresi gereklidir'
        });
      }
      
      // Belgeyi bul
      const document = await Document.findById(documentId);
      
      if (!document) {
        logger.warn(`Belge bulunamadı: ${documentId}`);
        return res.status(404).json({
          status: 'error',
          message: 'Belge bulunamadı'
        });
      }
      
      // Erişim kontrolü için yardımcı modülü kullan
      const accessControl = require('../utils/accessControl');
      
      // Görüntüleme mi yoksa düzenleme/onaya gönderme mi?
      const isViewOperation = options.allowViewBeforeApproval === true;
      
      if (isViewOperation) {
        // Görüntüleme erişimi kontrolü
        const canView = accessControl.canViewDocument(req.user, document);
        if (!canView) {
          logger.warn(`Yetkisiz görüntüleme: Kullanıcı=${userId}, Rol=${userRole}, Belge=${documentId}`);
          return res.status(403).json({
            status: 'error',
            message: 'Bu belgeyi görüntüleme yetkiniz bulunmuyor'
          });
        }
      } else {
        // İşlem türünü belirle
        const operation = req.path.includes('/submit') ? 'submit' : 
                         req.path.includes('/approve') ? 'approve' :
                         req.path.includes('/reject') ? 'reject' :
                         req.path.includes('/notes') ? 'addNotes' :
                         req.path.includes('/files') ? 'addFiles' :
                         req.path.includes('/tags') ? 'addTags' :
                         req.path.includes('/override') ? 'override' : 'edit';
        
        if (operation === 'submit') {
          // Onaya gönderme erişimi kontrolü
          const canSubmit = accessControl.canSubmitForApproval(req.user, document);
          if (!canSubmit) {
            logger.warn(`Yetkisiz onaya gönderme: Kullanıcı=${userId}, Rol=${userRole}, Belge=${documentId}`);
            return res.status(403).json({
              status: 'error',
              message: 'Bu belgeyi onaya gönderme yetkiniz bulunmuyor'
            });
          }
        } else if (operation === 'approve' || operation === 'reject') {
          // Onay akışını getir
          const approvalFlow = await ApprovalFlow.findOne({ documentId });
          if (!approvalFlow) {
            logger.error(`Onay akışı bulunamadı: ${documentId}`);
            return res.status(404).json({
              status: 'error',
              message: 'Belge için onay akışı bulunamadı'
            });
          }
          
          // Onaylama/reddetme erişimi kontrolü
          const canApprove = accessControl.canApproveDocument(req.user, document, approvalFlow);
          if (!canApprove) {
            const action = operation === 'approve' ? 'onaylama' : 'reddetme';
            logger.warn(`Yetkisiz ${action}: Kullanıcı=${userId}, Rol=${userRole}, Belge=${documentId}`);
            return res.status(403).json({
              status: 'error',
              message: `Bu belgeyi ${action} yetkiniz bulunmuyor`
            });
          }
        } else if (operation === 'addNotes' || operation === 'addFiles') {
          // Not/dosya ekleme erişimi kontrolü
          const canAddNotes = accessControl.canAddNotesOrFiles(req.user, document);
          if (!canAddNotes) {
            logger.warn(`Yetkisiz not/dosya ekleme: Kullanıcı=${userId}, Rol=${userRole}, Belge=${documentId}`);
            return res.status(403).json({
              status: 'error',
              message: 'Bu belgeye not/dosya ekleme yetkiniz bulunmuyor'
            });
          }
        } else if (operation === 'addTags') {
          // Etiket ekleme erişimi kontrolü
          const canTag = accessControl.canAddTags(req.user);
          if (!canTag) {
            logger.warn(`Yetkisiz etiket ekleme: Kullanıcı=${userId}, Rol=${userRole}, Belge=${documentId}`);
            return res.status(403).json({
              status: 'error',
              message: 'Bu belgeye etiket ekleme yetkiniz bulunmuyor'
            });
          }
        } else if (operation === 'override') {
          // Onay akışı adım atlatma erişimi kontrolü
          const canOverride = accessControl.canOverrideApprovalFlow(req.user);
          if (!canOverride) {
            logger.warn(`Yetkisiz onay akışı adım atlatma: Kullanıcı=${userId}, Rol=${userRole}, Belge=${documentId}`);
            return res.status(403).json({
              status: 'error',
              message: 'Onay akışında adım atlatma yetkiniz bulunmuyor'
            });
          }
        } else {
          // Düzenleme erişimi kontrolü
          const canEdit = accessControl.canEditDocument(req.user, document);
          if (!canEdit) {
            logger.warn(`Yetkisiz erişim: Kullanıcı=${userId}, Rol=${userRole}, Belge=${documentId}`);
            return res.status(403).json({
              status: 'error',
              message: 'Bu belgeye erişim yetkiniz bulunmuyor'
            });
          }
        }
      }
      
      // Erişim yetkisi var, devam et
      return next();
    } catch (error) {
      logger.error(`Belge erişim kontrolü hatası: ${error.message}, Stack: ${error.stack}`);
      return res.status(500).json({
        status: 'error',
        message: 'Belge erişim kontrolü sırasında bir hata oluştu'
      });
    }
  };
};

module.exports = {
  checkRole,
  documentAccessControl,
  ROLES,
};
