const fs = require('fs');
const path = require('path');
const documentService = require('../services/document.service');
const approvalService = require('../services/approval.service');
const logger = require('../../config/logger');
const { ROLES } = require('../../middleware/role.middleware');
const Log = require('../../models/Log');
const Document = require('../../models/Document'); // Document modelini import et
const { DocumentStatus } = require('../../interfaces/IDocument');
const mime = require('mime-types');
const mongoose = require('mongoose');
const User = require('../../models/User');
const { NotFoundError, PermissionError } = require('../../utils/errors'); // Hata sınıflarını import et
const ApprovalFlow = require('../../models/ApprovalFlow'); // ApprovalFlow modelini import et

/**
 * Belge kontrolcüsü
 */
class DocumentController {
  /**
   * Yeni belge oluşturur
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async createDocument(req, res, next) {
    try {
      logger.info('createDocument controller çağrıldı');
      logger.info(`Kullanıcı bilgileri: ${JSON.stringify({
        id: req.user.id,
        role: req.user.role,
        email: req.user.email
      })}`);
      
      // 1. Validasyon hatalarını toplamak için dizi
      const validationErrors = {};
      
      // 2. Dosyaları işle
      // upload.any() kullanıldığında, tüm dosyalar req.files dizisinde gelir
      const files = req.files || [];
      
      // Ana dosyayı bul (file alanı)
      const mainFile = files.find(f => f.fieldname === 'file');
      
      // Ek dosyaları bul (additionalFiles alanı)
      const additionalFiles = files.filter(f => f.fieldname === 'additionalFiles');
      
      logger.info(`Yüklenen dosya sayısı: Ana dosya: ${mainFile ? 1 : 0}, Ek dosyalar: ${additionalFiles.length}`);
      
      // 3. Ana dosya kontrolü
      if (!mainFile) {
        validationErrors.file = 'Ana dosya yüklemek zorunludur';
        logger.error('Belge oluşturma hatası: Ana dosya yok');
      } else {
        // Dosya tipi kontrolü
        const allowedMimeTypes = ['application/pdf'];
        if (!allowedMimeTypes.includes(mainFile.mimetype)) {
          validationErrors.file = 'Ana dosya olarak sadece PDF dosyaları yüklenebilir';
          logger.error(`Belge oluşturma hatası: Geçersiz ana dosya türü (${mainFile.mimetype})`);
        }
        
        // Dosya boyutu kontrolü (10MB)
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        if (mainFile.size > maxFileSize) {
          validationErrors.file = 'Ana dosya boyutu 10MB\'dan küçük olmalıdır';
          logger.error(`Belge oluşturma hatası: Ana dosya boyutu çok büyük (${mainFile.size} bytes)`);
        }
      }
      
      // 4. Ek dosyaların kontrolü
      if (additionalFiles.length > 0) {
        // Ek dosya sayısı kontrolü
        if (additionalFiles.length > 5) {
          validationErrors.additionalFiles = 'En fazla 5 ek dosya yüklenebilir';
          logger.error(`Belge oluşturma hatası: Çok fazla ek dosya (${additionalFiles.length})`);
        }
        
        // Her bir ek dosyanın boyut kontrolü (5MB)
        const maxAdditionalFileSize = 5 * 1024 * 1024; // 5MB
        const oversizedFiles = additionalFiles.filter(file => file.size > maxAdditionalFileSize);
        if (oversizedFiles.length > 0) {
          validationErrors.additionalFiles = 'Ek dosyaların boyutu 5MB\'dan küçük olmalıdır';
          logger.error(`Belge oluşturma hatası: Ek dosya boyutu çok büyük (${oversizedFiles.map(f => f.originalname).join(', ')})`);
        }
      }
      
      // 5. Başlık kontrolü
      if (!req.body.title) {
        validationErrors.title = 'Başlık alanı zorunludur';
        logger.error('Belge oluşturma hatası: Başlık yok');
      } else if (req.body.title.trim() === '') {
        validationErrors.title = 'Başlık boş olamaz';
        logger.error('Belge oluşturma hatası: Başlık boş');
      } else {
        // Başlık uzunluk kontrolü
        const trimmedTitle = req.body.title.trim();
        if (trimmedTitle.length < 3) {
          validationErrors.title = 'Başlık en az 3 karakter olmalıdır';
          logger.error(`Belge oluşturma hatası: Başlık çok kısa (${trimmedTitle.length} karakter)`);
        } else if (trimmedTitle.length > 200) {
          validationErrors.title = 'Başlık en fazla 200 karakter olabilir';
          logger.error(`Belge oluşturma hatası: Başlık çok uzun (${trimmedTitle.length} karakter)`);
        }
      }
      
      // 6. Onaylayıcıları işle (varsa)
      let approvers = [];
      if (req.body.approvers) {
        try {
          approvers = JSON.parse(req.body.approvers);
          
          // Onaylayıcıların geçerli ID'ler olduğunu kontrol et
          if (!Array.isArray(approvers)) {
            validationErrors.approvers = 'Onaylayıcılar bir dizi olmalıdır';
            logger.error('Belge oluşturma hatası: Onaylayıcılar dizi değil');
          } else {
            const invalidIds = approvers.filter(id => !mongoose.Types.ObjectId.isValid(id));
            if (invalidIds.length > 0) {
              validationErrors.approvers = 'Geçersiz onaylayıcı ID formatı';
              logger.error(`Belge oluşturma hatası: Geçersiz onaylayıcı ID'leri: ${invalidIds.join(', ')}`);
            } else {
              // Onaylayıcıların varlığını kontrol et
              for (const approverId of approvers) {
                const approver = await User.findById(approverId);
                if (!approver) {
                  validationErrors.approvers = `Onaylayıcı bulunamadı: ${approverId}`;
                  logger.error(`Belge oluşturma hatası: Onaylayıcı bulunamadı: ${approverId}`);
                  break;
                }
              }
            }
          }
        } catch (error) {
          validationErrors.approvers = 'Onaylayıcılar geçerli bir JSON formatında olmalıdır';
          logger.error(`Belge oluşturma hatası: Onaylayıcıları ayrıştırma hatası: ${error.message}`);
        }
      }
      
      // 7. Etiketleri işle (varsa)
      let tags = [];
      if (req.body.tags) {
        try {
          // Etiketleri JSON olarak parse et
          const tagsValue = req.body.tags;
          
          // Etiketlerin dizi olduğunu kontrol et
          try {
            tags = JSON.parse(tagsValue);
            
            if (!Array.isArray(tags)) {
              validationErrors.tags = 'Etiketler bir dizi olmalıdır';
              logger.error('Belge oluşturma hatası: Etiketler dizi değil');
            } else {
              // Etiketleri temizle
              tags = tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
              logger.info(`Etiketler başarıyla ayrıştırıldı: ${JSON.stringify(tags)}`);
            }
          } catch (parseError) {
            // JSON parse hatası - string olarak geldiyse virgülle ayır
            logger.warn(`Etiketler JSON olarak ayrıştırılamadı, string olarak işleniyor: ${parseError.message}`);
            
            // Virgülle ayrılmış string olarak gelmiş olabilir
            if (typeof tagsValue === 'string') {
              tags = tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
              logger.info(`Etiketler string olarak işlendi: ${JSON.stringify(tags)}`);
            } else {
              validationErrors.tags = 'Etiketler geçerli bir JSON dizisi veya virgülle ayrılmış string olmalıdır';
              logger.error(`Belge oluşturma hatası: Etiketler geçersiz format: ${typeof tagsValue}`);
            }
          }
        } catch (error) {
          validationErrors.tags = 'Etiketler işlenirken hata oluştu';
          logger.error(`Belge oluşturma hatası: Etiketleri işleme hatası: ${error.message}`);
        }
      }
      
      // 8. Validasyon hataları varsa hemen dön
      if (Object.keys(validationErrors).length > 0) {
        logger.error(`Belge oluşturma validasyon hataları: ${JSON.stringify(validationErrors)}`);
        return res.status(400).json({
          status: 'error',
          message: 'Doğrulama hataları',
          errors: validationErrors
        });
      }
      
      // 9. Detaylı bilgileri logla
      if (files) {
        logger.info(`Dosya bilgileri: ${JSON.stringify({
          mainFile: mainFile ? {
            originalname: mainFile.originalname,
            size: mainFile.size,
            mimetype: mainFile.mimetype,
            path: mainFile.path
          } : 'YOK',
          additionalFiles: additionalFiles.map(f => ({
            originalname: f.originalname,
            size: f.size,
            mimetype: f.mimetype,
            path: f.path
          }))
        })}`);
      }
      
      logger.info(`Form verileri: ${JSON.stringify({
        ...req.body,
        // Hassas verileri gizle
        file: files ? 'DOSYALAR_VAR' : 'DOSYA_YOK'
      })}`);
      
      logger.info(`Onaylayıcılar: ${approvers.length > 0 ? approvers.join(', ') : 'Yok'}`);
      logger.info(`Etiketler: ${tags.length > 0 ? tags.join(', ') : 'Yok'}`);
      
      // 10. Belge oluştur
      const documentData = {
        ...req.body,
        title: req.body.title.trim(),
        description: req.body.description ? req.body.description.trim() : '',
        // Content alanı opsiyonel, minimum 10 karakter olacak şekilde varsayılan değer
        content: req.body.content || 'Bu belge için varsayılan içerik metnidir. Minimum karakter sınırını sağlamak için oluşturulmuştur.',
        tags: tags
      };
      
      const document = await documentService.createDocument(
        documentData,
        mainFile, // Ana dosyayı gönder
        req.user.id,
        approvers,
        additionalFiles // Ek dosyaları gönder
      );
      
      logger.info(`Belge başarıyla oluşturuldu: ${document._id}`);
      
      // 11. Başarılı yanıt döndür
      res.status(201).json({
        status: 'success',
        message: 'Belge başarıyla oluşturuldu',
        data: { document }
      });
    } catch (error) {
      logger.error(`Belge oluşturma hatası: ${error.message}, Stack: ${error.stack}`);
      
      // Mongoose validasyon hatası
      if (error.name === 'ValidationError') {
        const validationErrors = {};
        
        // Her bir hata alanını işle
        Object.keys(error.errors).forEach(field => {
          validationErrors[field] = error.errors[field].message;
        });
        
        return res.status(400).json({
          status: 'error',
          message: 'Doğrulama hataları',
          errors: validationErrors
        });
      }
      
      // Diğer validasyon hataları
      if (error.message.includes('validation failed')) {
        return res.status(400).json({
          status: 'error',
          message: 'Doğrulama hataları',
          errors: { general: error.message }
        });
      }
      
      // Disk hatası
      if (error.code === 'ENOSPC') {
        logger.error('Disk alanı yetersiz');
        return res.status(500).json({
          status: 'error',
          message: 'Sunucu disk alanı yetersiz, lütfen daha sonra tekrar deneyin',
        });
      }
      
      // Dosya sistemi hataları
      if (error.code && ['EACCES', 'EPERM', 'ENOENT'].includes(error.code)) {
        logger.error(`Dosya sistemi hatası: ${error.code}`);
        return res.status(500).json({
          status: 'error',
          message: 'Dosya işleme hatası, lütfen daha sonra tekrar deneyin',
        });
      }
      
      // Diğer hatalar için genel hata işleyiciye yönlendir
      next(error);
    }
  }
  
  /**
   * Belge detaylarını getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getDocument(req, res, next) {
    try {
      const { id } = req.params;
      
      logger.info(`Belge detayı isteği: ID=${id}, Kullanıcı=${req.user.id}, Rol=${req.user.role}`);
      
      try {
        // Belgeyi direkt olarak veritabanından getir ve erişim kontrolünü manuel yap
        const document = await Document.findById(id)
          .populate('createdBy', 'firstName lastName email department position')
          .populate('approvers', 'firstName lastName email department position')
          .populate({
            path: 'approvalHistory.userId',
            select: 'firstName lastName email department position',
            strictPopulate: false
          })
          .lean();
        
        if (!document) {
          logger.error(`Belge bulunamadı: ${id}`);
          return res.status(404).json({
            status: 'error',
            message: 'Belge bulunamadı'
          });
        }
        
        // Belge sahibi bilgisini logla
        if (document.createdBy) {
          const createdById = typeof document.createdBy === 'object' ? 
            document.createdBy._id ? document.createdBy._id.toString() : 'N/A' : 
            document.createdBy.toString();
            
          logger.info(`Belge sahibi: ${createdById}, İstek yapan kullanıcı: ${req.user.id}, Eşleşme: ${createdById === req.user.id}`);
        } else {
          logger.warn(`Belgenin createdBy alanı eksik: ${id}`);
        }
        
        // Kullanıcı rolünü logla
        logger.info(`Kullanıcı rolü: ${req.user.role}`);
        
        // Erişim kontrolü
        try {
          await documentService.checkDocumentAccess(document, req.user);
        } catch (error) {
          logger.error(`Belge erişim hatası: ${error.message}, Kullanıcı: ${req.user.id}, Belge: ${id}`);
          
          // Daha açıklayıcı hata mesajı
          let errorMessage = 'Bu belgeye erişim yetkiniz bulunmuyor';
          
          // Kullanıcı belgenin sahibi mi kontrol et
          if (document.createdBy && typeof document.createdBy === 'object' && 
              document.createdBy._id && document.createdBy._id.toString() === req.user.id) {
            // Kullanıcı belgenin sahibi ama yine de erişim hatası alıyorsa, bu bir sistem hatasıdır
            logger.error(`Tutarsızlık: Kullanıcı (${req.user.id}) belgenin sahibi olmasına rağmen erişim hatası aldı`);
            errorMessage = 'Sistem hatası: Belge sahibi olmanıza rağmen erişim sağlanamadı. Lütfen sistem yöneticisiyle iletişime geçin.';
          }
          
          return res.status(403).json({
            status: 'error',
            message: errorMessage
          });
        }
        
        logger.info(`Belge başarıyla getirildi: ${id}`);
        res.status(200).json({
          status: 'success',
          data: { document }
        });
      } catch (error) {
        logger.error(`Belge getirme işlem hatası: ${error.message}, Stack: ${error.stack}`);
        throw error;
      }
    } catch (error) {
      logger.error(`Belge getirme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Belgeyi günceller
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async updateDocument(req, res, next) {
    try {
      const { id } = req.params;
      
      // Dosyaları işle
      const files = req.files || [];
      
      // Ana dosyayı bul (file alanı)
      const mainFile = files.find(f => f.fieldname === 'file');
      
      // Ek dosyaları bul (additionalFiles alanı)
      const additionalFiles = files.filter(f => f.fieldname === 'additionalFiles');
      
      logger.info(`Belge güncelleme - Yüklenen dosya sayısı: Ana dosya: ${mainFile ? 1 : 0}, Ek dosyalar: ${additionalFiles.length}`);
      
      // Belgeyi güncelle
      const updatedDocument = await documentService.updateDocument(
        id, 
        req.body, 
        req.user.id,
        mainFile,
        additionalFiles
      );
      
      res.status(200).json({
        status: 'success',
        data: {
          document: updatedDocument
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Belgeyi siler
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async deleteDocument(req, res, next) {
    try {
      const { id } = req.params;
      
      await documentService.deleteDocument(id, req.user.id);
      
      res.status(200).json({
        status: 'success',
        message: 'Belge başarıyla silindi'
      });
    } catch (error) {
      logger.error(`Belge silme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Kullanıcının belgelerini getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getUserDocuments(req, res, next) {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10
      };
      
      const result = await documentService.getUserDocuments(req.user.id, options);
      
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      logger.error(`Kullanıcı belgeleri getirme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Tüm belgeleri getirir (sadece admin ve yöneticiler için)
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getAllDocuments(req, res, next) {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        filters: req.query.filters ? JSON.parse(req.query.filters) : {}
      };
      
      const result = await documentService.getAllDocuments(options);
      
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      logger.error(`Tüm belgeleri getirme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Onay bekleyen evrakları getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getPendingDocuments(req, res, next) {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      };
      
      logger.info(`Onay bekleyen belgeler isteği: Kullanıcı: ${req.user.id}, Sayfa: ${options.page}, Limit: ${options.limit}`);
      
      const result = await documentService.getPendingApprovals(req.user.id, options);
      
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      logger.error(`Onay bekleyen belgeleri getirme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Belgeyi onaya gönderir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async submitForApproval(req, res, next) {
    try {
      const { id } = req.params;
      const { approvers, approvalFlowId, flowType } = req.body;
      
      logger.info(`Belgeyi onaya gönderme isteği: Belge: ${id}, Kullanıcı: ${req.user.id}, Rol: ${req.user.role}, Tür: ${flowType || 'standard'}`);
      
      // Belge ID kontrolü
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        logger.error(`Geçersiz belge ID: ${id}`);
        return res.status(400).json({
          status: 'error',
          message: 'Geçersiz belge ID formatı'
        });
      }
      
      // Onay akışı türü kontrolü - hem frontend hem de backend değerlerini kabul et
      const validFlowTypes = ['quick', 'standard', 'sequential'];
      if (flowType && !validFlowTypes.includes(flowType)) {
        logger.error(`Geçersiz onay akışı türü: ${flowType}`);
        return res.status(400).json({
          status: 'error',
          message: `Geçersiz onay akışı türü. Geçerli değerler: ${validFlowTypes.join(', ')}`
        });
      }
      
      // approvalFlowId veya approvers kontrolü
      if (!approvalFlowId && (!approvers || !Array.isArray(approvers) || approvers.length === 0)) {
        logger.error('Onaylayıcılar veya onay akışı şablonu belirtilmemiş');
        return res.status(400).json({
          status: 'error',
          message: 'Onaylayıcılar veya onay akışı şablonu belirtilmelidir'
        });
      }
      
      // approvalFlowId kontrolü
      if (approvalFlowId && !mongoose.Types.ObjectId.isValid(approvalFlowId)) {
        logger.error(`Geçersiz onay akışı şablon ID: ${approvalFlowId}`);
        return res.status(400).json({
          status: 'error',
          message: 'Geçersiz onay akışı şablon ID formatı'
        });
      }
      
      // approvers kontrolü
      if (approvers && Array.isArray(approvers)) {
        const invalidIds = approvers.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
          logger.error(`Geçersiz onaylayıcı ID'leri: ${invalidIds.join(', ')}`);
          return res.status(400).json({
            status: 'error',
            message: 'Geçersiz onaylayıcı ID formatı'
          });
        }
      }
      
      // Belgeyi getir ve erişim kontrolü yap
      try {
        // Belgeyi getir - populate etme, sadece ID'ye ihtiyacımız var
        const document = await Document.findById(id).select('+createdBy');
        if (!document) {
          logger.error(`Belge bulunamadı: ${id}`);
          return res.status(404).json({
            status: 'error',
            message: 'Belge bulunamadı'
          });
        }
        
        // Belge durumunu kontrol et
        if (document.status !== DocumentStatus.DRAFT && document.status !== DocumentStatus.REJECTED) {
          logger.warn(`Belge zaten onay sürecinde veya onaylanmış: ${id}, Durum: ${document.status}`);
          return res.status(400).json({
            status: 'error',
            message: `Bu belge zaten onay sürecinde veya onaylanmış (${document.status})`
          });
        }
        
        // Debug logları ekle
        const createdByType = typeof document.createdBy;
        const createdByStr = document.createdBy ? 
          (createdByType === 'object' && document.createdBy._id ? document.createdBy._id.toString() : document.createdBy.toString()) : 
          'undefined';
        
        logger.debug(`[SUBMIT-CONTROLLER] Belge sahibi kontrolü - UserId: ${req.user.id}, CreatedBy: ${createdByStr}, CreatedByType: ${createdByType}, UserRole: ${req.user.role}`);
        
        // Erişim kontrolü için yardımcı modülü kullan
        const accessControl = require('../../utils/accessControl');
        
        // Kullanıcının belgeyi onaya gönderme yetkisi var mı kontrol et
        const canSubmit = accessControl.canSubmitForApproval(req.user, document);
        logger.debug(`[SUBMIT-CONTROLLER] canSubmitForApproval sonucu: ${canSubmit}`);
        
        // Yetki kontrolü
        if (!canSubmit) {
          logger.warn(`Yetkisiz işlem: Kullanıcı=${req.user.id}, Rol=${req.user.role} belgeyi onaya göndermeye çalışıyor, ancak yetkisi yok`);
          return res.status(403).json({
            status: 'error',
            message: 'Bu belge için onay akışı başlatma yetkiniz bulunmuyor. Sadece belge sahibi veya admin kullanıcılar belgeyi onaya gönderebilir.'
          });
        }
        
        logger.info(`Belge erişim kontrolü başarılı: Kullanıcı=${req.user.id}, Belge=${id}, İşlem=onaya gönderme`);
      } catch (documentError) {
        logger.error(`Belge kontrol hatası: ${documentError.message}, Stack: ${documentError.stack}`);
        return res.status(500).json({
          status: 'error',
          message: 'Belge kontrolü sırasında bir hata oluştu'
        });
      }
      
      // approvalFlowId varsa, şablon olarak kullan
      // approvers varsa, doğrudan onaylayıcılar olarak kullan
      let approvalFlow;
      
      try {
        if (approvalFlowId) {
          logger.info(`Şablon ID ile onaya gönderiliyor: ${approvalFlowId}`);
          approvalFlow = await documentService.submitForApproval(id, req.user.id, approvalFlowId, flowType || 'standard');
        } else if (approvers) {
          logger.info(`Onaylayıcılar ile onaya gönderiliyor: ${approvers.length} kişi`);
          approvalFlow = await documentService.submitForApproval(id, req.user.id, approvers, flowType || 'standard');
        }
        
        logger.info(`Belge başarıyla onaya gönderildi: ${id}, Onay Akışı: ${approvalFlow._id}`);
        
        // Log kaydı oluştur
        try {
          const Log = require('../../models/Log');
          const document = await Document.findById(id).select('title');
          
          await Log.logDocumentAction(
            req.user.id,
            'submit_for_approval',
            `Belge onaya gönderildi: ${document?.title || id}`,
            {
              documentId: id,
              documentTitle: document?.title || 'Belge',
              approvalFlowId: approvalFlow._id,
              flowType: approvalFlow.flowType,
              approverCount: approvers?.length || 'Şablon kullanıldı'
            },
            req.ip,
            req.get('User-Agent')
          );
          
          logger.info(`Belge onaya gönderme log kaydı oluşturuldu: ${id}`);
        } catch (logError) {
          logger.error(`Log kaydı oluşturma hatası: ${logError.message}`);
          // Log hatası ana işlemi etkilemesin
        }
        
        res.status(200).json({
          status: 'success',
          message: 'Belge başarıyla onaya gönderildi',
          data: { approvalFlow }
        });
      } catch (error) {
        logger.error(`Onaya gönderme işlem hatası: ${error.message}, Stack: ${error.stack}`);
        
        // Hata türüne göre uygun yanıtlar
        if (error.name === 'ValidationError' || error.message.includes('geçersiz') || error.message.includes('Geçersiz')) {
          return res.status(400).json({
            status: 'error',
            message: error.message
          });
        }
        
        if (error.name === 'NotFoundError' || error.message.includes('bulunamadı')) {
          return res.status(404).json({
            status: 'error',
            message: error.message
          });
        }
        
        if (error.name === 'PermissionError' || error.message.includes('yetki') || error.message.includes('erişim')) {
          return res.status(403).json({
            status: 'error',
            message: error.message
          });
        }
        
        // Diğer hatalar için
        return res.status(500).json({
          status: 'error',
          message: 'Belgeyi onaya gönderirken bir hata oluştu'
        });
      }
    } catch (error) {
      logger.error(`Belgeyi onaya gönderme hatası: ${error.message}, Stack: ${error.stack}`);
      next(error);
    }
  }
  
  /**
   * Belgeyi onaylar veya reddeder
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async approveOrRejectDocument(req, res, next) {
    try {
      const { id } = req.params;
      const { action, comment } = req.body;
      
      let result;
      
      if (action === 'approve') {
        result = await documentService.approveDocument(id, req.user.id, comment);
        res.status(200).json({
          status: 'success',
          message: 'Belge onaylandı',
          data: result
        });
      } else if (action === 'reject') {
        result = await documentService.rejectDocument(id, req.user.id, comment);
        res.status(200).json({
          status: 'success',
          message: 'Belge reddedildi',
          data: result
        });
      } else {
        res.status(400).json({
          status: 'error',
          message: 'Geçersiz işlem. "approve" veya "reject" olmalıdır.'
        });
      }
    } catch (error) {
      logger.error(`Belge onaylama/reddetme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Belge için PDF oluşturur
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async generatePDF(req, res, next) {
    try {
      const { id } = req.params;
      
      const pdfBuffer = await documentService.generatePDF(id);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="document-${id}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      logger.error(`PDF oluşturma hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Belgeyi onaylar
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async approveDocument(req, res, next) {
    try {
      const { documentId } = req.params;
      const { comment } = req.body || {};
      
      logger.info(`Belge onaylama isteği - Belge ID: ${documentId}, Kullanıcı: ${req.user.id}`);
      
      // Belge ID doğrulama
      if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
        logger.error(`Geçersiz belge ID formatı: ${documentId}`);
        return res.status(400).json({
          status: 'error',
          message: 'Geçersiz belge ID formatı'
        });
      }
      
      // Belgeyi getir
      const document = await Document.findById(documentId).populate('createdBy');
      if (!document) {
        logger.error(`Belge bulunamadı: ${documentId}`);
        return res.status(404).json({
          status: 'error',
          message: 'Belge bulunamadı'
        });
      }
      
      // Onay akışını getir
      const approvalFlow = await ApprovalFlow.findOne({ documentId }).populate('steps.userId');
      if (!approvalFlow) {
        logger.error(`Onay akışı bulunamadı: ${documentId}`);
        return res.status(404).json({
          status: 'error',
          message: 'Belge için onay akışı bulunamadı'
        });
      }
      
      // Kullanıcının rolünü ve belge sahibinin rolünü belirle
      const userRole = req.user.role ? req.user.role.toUpperCase() : '';
      const documentOwnerRole = document.createdBy && document.createdBy.role ? document.createdBy.role.toUpperCase() : '';
      
      logger.debug(`Onay isteği - Kullanıcı rolü: ${userRole}, Belge sahibi rolü: ${documentOwnerRole}`);
      logger.debug(`Onay akışı bilgileri - ID: ${approvalFlow._id}, Tür: ${approvalFlow.flowType}, Durum: ${approvalFlow.status}, Mevcut Adım: ${approvalFlow.currentStep}`);
      
      // Onay akışı adımlarını detaylı logla
      if (approvalFlow.steps && Array.isArray(approvalFlow.steps)) {
        logger.debug(`Onay akışı adımları (${approvalFlow.steps.length}):`);
        approvalFlow.steps.forEach((step, index) => {
          const stepUserId = step.userId && (typeof step.userId === 'object' ? 
            (step.userId._id ? step.userId._id.toString() : 'null') : 
            step.userId.toString());
          
          const isCurrentUser = stepUserId === req.user.id;
          const isCurrentStep = step.order === approvalFlow.currentStep;
          
          logger.debug(`Adım ${step.order}: userId=${stepUserId}, status=${step.status}, isCurrentUser=${isCurrentUser}, isCurrentStep=${isCurrentStep}`);
        });
      }
      
      // MANAGER rolündeki kullanıcı ADMIN'in belgesini onaylıyor mu?
      const isManagerApprovingAdminDocument = 
        userRole === 'MANAGER' && 
        documentOwnerRole === 'ADMIN';
      
      // Kullanıcının belge sahibi olup olmadığını kontrol et
      const userIdStr = req.user.id.toString();
      const documentOwnerId = document.createdBy._id ? document.createdBy._id.toString() : document.createdBy.toString();
      const isOwner = userIdStr === documentOwnerId;
      
      // Belge sahibi kendisi ise onaylayamaz
      if (isOwner) {
        logger.warn(`Kullanıcı ${userIdStr} kendi belgesini onaylayamaz`);
        return res.status(403).json({
          status: 'error',
          message: 'Kendi belgenizi onaylayamazsınız'
        });
      }
      
      // Kullanıcının onay akışında yer alıp almadığını kontrol et
      const isUserInApprovalFlow = approvalFlow.steps.some(step => {
        if (!step.userId) return false;
        
        let stepUserId;
        if (typeof step.userId === 'object') {
          stepUserId = step.userId._id ? step.userId._id.toString() : null;
        } else {
          stepUserId = step.userId.toString();
        }
        
        return stepUserId === userIdStr;
      });
      
      logger.debug(`Kullanıcı onay akışında yer alıyor mu? ${isUserInApprovalFlow}`);
      
      // Kullanıcının mevcut adımda olup olmadığını kontrol et
      const currentStep = approvalFlow.steps.find(step => step.order === approvalFlow.currentStep);
      let isCurrentApprover = false;
      
      if (currentStep) {
        const currentStepUserId = typeof currentStep.userId === 'object' ? 
          (currentStep.userId._id ? currentStep.userId._id.toString() : null) : 
          currentStep.userId.toString();
        
        isCurrentApprover = currentStepUserId === userIdStr;
        
        logger.debug(`Mevcut adım kontrolü - Adım: ${currentStep.order}, Durum: ${currentStep.status}, Kullanıcı: ${currentStepUserId}, Eşleşme: ${isCurrentApprover}`);
      } else {
        logger.warn(`Mevcut adım (${approvalFlow.currentStep}) bulunamadı`);
      }
      
      // MANAGER, ADMIN'in belgesini onaylıyor ve onay akışında yer alıyorsa izin ver
      if (isManagerApprovingAdminDocument && isUserInApprovalFlow) {
        logger.debug(`MANAGER rolündeki kullanıcı ${userIdStr}, ADMIN'in oluşturduğu belgeyi onaylayabilir (özel durum)`);
        
        // Onay akışı adımlarını detaylı logla
        logger.debug(`Onay akışı adımları (${approvalFlow.steps.length}):`);
        approvalFlow.steps.forEach((step, index) => {
          const stepUserId = step.userId._id ? step.userId._id.toString() : step.userId.toString();
          logger.debug(`Adım ${index+1}: userId=${stepUserId}, order=${step.order}, status=${step.status}, isCurrentUser=${stepUserId === userIdStr}`);
        });
        
        // ÖZEL KONTROL NOKTASI: Bu satır mutlaka loglanmalı
        logger.warn(`ÖZEL KONTROL: MANAGER (${userIdStr}) ADMIN (${documentOwnerId}) belgesini onaylıyor, onay akışında yer alıyor`);
        
        // Doğrudan onay işlemini gerçekleştir
        const result = await approvalService.processApprovalAction(
          documentId,
          req.user.id,
          'approve',
          comment && typeof comment === 'string' ? comment.trim() : ''
        );
        
        // Log kaydı oluştur
        try {
          const Log = require('../../models/Log');
          await Log.logDocumentAction(
            req.user.id,
            'approve',
            `Belge onaylandı: ${document.title || documentId}`,
            {
              documentId: documentId,
              documentTitle: document.title || 'Belge',
              approvalFlowId: approvalFlow._id,
              comment: comment || '',
              currentStep: approvalFlow.currentStep,
              isLastStep: approvalFlow.currentStep >= approvalFlow.steps.length
            },
            req.ip,
            req.get('User-Agent')
          );
        } catch (logError) {
          logger.error(`Log kaydı oluşturma hatası: ${logError.message}`);
        }
        
        // Başarılı yanıt
        logger.info(`MANAGER kullanıcısı ${userIdStr}, ADMIN'in belgesini başarıyla onayladı`);
        return res.status(200).json({
          status: 'success',
          message: 'Belge başarıyla onaylandı',
          data: { approvalFlow: result }
        });
      }
      
      // Standart izin kontrolü
      const accessControl = require('../../utils/accessControl');
      const canApprove = accessControl.canApproveDocument(req.user, document, approvalFlow);
      logger.debug(`Standart izin kontrolü sonucu: ${canApprove}`);
      
      // Onay yetkisi yoksa hata döndür
      if (!canApprove) {
        logger.warn(`Yetkisiz onaylama: Kullanıcı=${req.user.id}, Rol=${req.user.role}, Belge=${documentId}`);
        return res.status(403).json({
          status: 'error',
          message: 'Bu belgeyi onaylama yetkiniz bulunmuyor'
        });
      }
      
      // Onaylama işlemini gerçekleştir
      const result = await approvalService.processApprovalAction(
        documentId,
        req.user.id,
        'approve',
        comment && typeof comment === 'string' ? comment.trim() : ''
      );
      
      // Log kaydı oluştur
      try {
        const Log = require('../../models/Log');
        await Log.logDocumentAction(
          req.user.id,
          'approve',
          `Belge onaylandı: ${document.title || documentId}`,
          {
            documentId: documentId,
            documentTitle: document.title || 'Belge',
            approvalFlowId: approvalFlow._id,
            comment: comment || '',
            currentStep: approvalFlow.currentStep,
            isLastStep: approvalFlow.currentStep >= approvalFlow.steps.length
          },
          req.ip,
          req.get('User-Agent')
        );
        logger.info(`Belge onaylama log kaydı oluşturuldu: ${documentId}`);
      } catch (logError) {
        logger.error(`Log kaydı oluşturma hatası: ${logError.message}`);
        // Log hatası ana işlemi etkilemesin
      }
      
      // Başarılı yanıt
      logger.info(`Belge başarıyla onaylandı - Belge ID: ${documentId}, Kullanıcı: ${req.user.id}`);
      res.status(200).json({
        status: 'success',
        message: 'Belge başarıyla onaylandı',
        data: { approvalFlow: result }
      });
    } catch (error) {
      logger.error(`Belge onaylama hatası: ${error.message}, Stack: ${error.stack}`);
      
      // Hata kodlarına göre uygun yanıtlar
      if (error.message.includes('bulunamadı')) {
        return res.status(404).json({
          status: 'error',
          message: error.message
        });
      }
      
      // Yetki veya durum hataları
      if (error.message.includes('onay yetkiniz') || 
          error.message.includes('zaten onaylanmış') ||
          error.message.includes('zaten işlenmiş') ||
          error.message.includes('zaten onayladınız')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      // Diğer validasyon hataları
      if (error.message.includes('Geçersiz')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      
      // Beklenmeyen hatalar için
      next(error);
    }
  }
  
  /**
   * Belgeyi reddeder
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async rejectDocument(req, res, next) {
    try {
      const { documentId } = req.params;
      const { comment } = req.body || {};
      
      logger.info(`Belge reddetme isteği - Belge ID: ${documentId}, Kullanıcı: ${req.user.id}`);
      
      // Belge ID doğrulama
      if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
        logger.error(`Geçersiz belge ID formatı: ${documentId}`);
        return res.status(400).json({
          status: 'error',
          message: 'Geçersiz belge ID formatı'
        });
      }
      
      // Yorum zorunlu
      if (!comment || comment.trim() === '') {
        logger.error('Reddetme işlemi için açıklama gerekli');
        return res.status(400).json({
          status: 'error',
          message: 'Reddetme işlemi için açıklama gereklidir'
        });
      }
      
      // Belgeyi getir
      const document = await Document.findById(documentId).populate('createdBy');
      if (!document) {
        logger.error(`Belge bulunamadı: ${documentId}`);
        return res.status(404).json({
          status: 'error',
          message: 'Belge bulunamadı'
        });
      }
      
      // Onay akışını getir
      const approvalFlow = await ApprovalFlow.findOne({ documentId }).populate('steps.userId');
      if (!approvalFlow) {
        logger.error(`Onay akışı bulunamadı: ${documentId}`);
        return res.status(404).json({
          status: 'error',
          message: 'Belge için onay akışı bulunamadı'
        });
      }
      
      // Kullanıcının rolünü ve belge sahibinin rolünü belirle
      const userRole = req.user.role ? req.user.role.toUpperCase() : '';
      const documentOwnerRole = document.createdBy && document.createdBy.role ? document.createdBy.role.toUpperCase() : '';
      
      logger.debug(`Red isteği - Kullanıcı rolü: ${userRole}, Belge sahibi rolü: ${documentOwnerRole}`);
      
      // MANAGER rolündeki kullanıcı ADMIN'in belgesini reddediyor mu?
      const isManagerRejectingAdminDocument = 
        userRole === 'MANAGER' && 
        documentOwnerRole === 'ADMIN';
      
      // Kullanıcının belge sahibi olup olmadığını kontrol et
      const userIdStr = req.user.id.toString();
      const documentOwnerId = document.createdBy._id ? document.createdBy._id.toString() : document.createdBy.toString();
      const isOwner = userIdStr === documentOwnerId;
      
      // Belge sahibi kendisi ise reddedemez
      if (isOwner) {
        logger.warn(`Kullanıcı ${userIdStr} kendi belgesini reddedemez`);
        return res.status(403).json({
          status: 'error',
          message: 'Kendi belgenizi reddedemezsiniz'
        });
      }
      
      // Kullanıcının onay akışında yer alıp almadığını kontrol et
      const isUserInApprovalFlow = approvalFlow.steps.some(step => {
        if (!step.userId) return false;
        
        let stepUserId;
        if (typeof step.userId === 'object') {
          stepUserId = step.userId._id ? step.userId._id.toString() : null;
        } else {
          stepUserId = step.userId.toString();
        }
        
        return stepUserId === userIdStr;
      });
      
      logger.debug(`Kullanıcı onay akışında yer alıyor mu? (red) ${isUserInApprovalFlow}`);
      
      // MANAGER, ADMIN'in belgesini reddediyor ve onay akışında yer alıyorsa izin ver
      if (isManagerRejectingAdminDocument && isUserInApprovalFlow) {
        logger.debug(`MANAGER rolündeki kullanıcı ${userIdStr}, ADMIN'in oluşturduğu belgeyi reddedebilir (özel durum)`);
        
        // Doğrudan reddetme işlemini gerçekleştir
        const result = await approvalService.processApprovalAction(
          documentId,
          req.user.id,
          'reject',
          comment.trim()
        );
        
        // Log kaydı oluştur
        try {
          const Log = require('../../models/Log');
          await Log.logDocumentAction(
            req.user.id,
            'reject',
            `Belge reddedildi: ${document.title || documentId}`,
            {
              documentId: documentId,
              documentTitle: document.title || 'Belge',
              approvalFlowId: approvalFlow._id,
              comment: comment,
              currentStep: approvalFlow.currentStep,
              reason: comment
            },
            req.ip,
            req.get('User-Agent')
          );
        } catch (logError) {
          logger.error(`Log kaydı oluşturma hatası: ${logError.message}`);
        }
        
        // Başarılı yanıt
        logger.info(`MANAGER kullanıcısı ${userIdStr}, ADMIN'in belgesini başarıyla reddetti`);
        return res.status(200).json({
          status: 'success',
          message: 'Belge başarıyla reddedildi',
          data: { approvalFlow: result }
        });
      }
      
      // Standart izin kontrolü
      const accessControl = require('../../utils/accessControl');
      const canReject = accessControl.canApproveDocument(req.user, document, approvalFlow);
      logger.debug(`Standart izin kontrolü sonucu (red): ${canReject}`);
      
      // Reddetme yetkisi yoksa hata döndür
      if (!canReject) {
        logger.warn(`Yetkisiz reddetme: Kullanıcı=${req.user.id}, Rol=${req.user.role}, Belge=${documentId}`);
        return res.status(403).json({
          status: 'error',
          message: 'Bu belgeyi reddetme yetkiniz bulunmuyor'
        });
      }
      
      // Reddetme işlemini gerçekleştir
      const result = await approvalService.processApprovalAction(
        documentId,
        req.user.id,
        'reject',
        comment.trim()
      );
      
      // Log kaydı oluştur
      try {
        const Log = require('../../models/Log');
        await Log.logDocumentAction(
          req.user.id,
          'reject',
          `Belge reddedildi: ${document.title || documentId}`,
          {
            documentId: documentId,
            documentTitle: document.title || 'Belge',
            approvalFlowId: approvalFlow._id,
            comment: comment,
            currentStep: approvalFlow.currentStep,
            reason: comment
          },
          req.ip,
          req.get('User-Agent')
        );
        logger.info(`Belge reddetme log kaydı oluşturuldu: ${documentId}`);
      } catch (logError) {
        logger.error(`Log kaydı oluşturma hatası: ${logError.message}`);
        // Log hatası ana işlemi etkilemesin
      }
      
      // Başarılı yanıt
      logger.info(`Belge başarıyla reddedildi - Belge ID: ${documentId}, Kullanıcı: ${req.user.id}`);
      res.status(200).json({
        status: 'success',
        message: 'Belge başarıyla reddedildi',
        data: { approvalFlow: result }
      });
    } catch (error) {
      logger.error(`Belge reddetme hatası: ${error.message}, Stack: ${error.stack}`);
      
      // Hata kodlarına göre uygun yanıtlar
      if (error.message.includes('bulunamadı')) {
        return res.status(404).json({
          status: 'error',
          message: error.message
        });
      }
      
      // Yetki veya durum hataları
      if (error.message.includes('yetkiniz') || 
          error.message.includes('zaten onaylanmış') ||
          error.message.includes('zaten işlenmiş') ||
          error.message.includes('zaten reddedilmiş')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      // Diğer validasyon hataları
      if (error.message.includes('Geçersiz')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      
      // Beklenmeyen hatalar için
      next(error);
    }
  }
  
  /**
   * Belgeyi PDF olarak indirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async downloadDocument(req, res, next) {
    try {
      const { documentId } = req.params;
      
      logger.info(`Belge indirme isteği başladı: ${documentId}, Kullanıcı: ${req.user.id}`);
      
      // Belge ID kontrolü
      if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
        logger.error(`Geçersiz belge ID: ${documentId}`);
        return res.status(400).json({
          status: 'error',
          message: 'Geçersiz belge ID formatı'
        });
      } 
      // Belgeyi getir
      const document = await Document.findById(documentId);
      if (!document) {
        logger.error(`Belge bulunamadı: ${documentId}`);
        return res.status(404).json({
          status: 'error',
          message: 'Belge bulunamadı'
        });
      }
      
      // Kullanıcının erişim yetkisi var mı kontrol et
      try {
        documentService.checkDocumentAccess(document, req.user);
      } catch (error) {
        logger.error(`Belge erişim hatası: ${error.message}`);
        return res.status(403).json({
          status: 'error',
          message: 'Bu belgeye erişim yetkiniz bulunmuyor'
        });
      }
      
      // Dosya yolu kontrolü
      let filePath = null;
      let fileName = 'document.pdf';
      
      // Belgenin dosya yolunu belirle
      if (document.filePath) {
        filePath = document.filePath;
        logger.info(`Dosya yolu 'filePath' alanından alındı: ${filePath}`);
      } else if (document.fileName) {
        // Dosya adı var ama yolu yoksa uploads klasöründe ara
        filePath = path.join(__dirname, '../../../uploads', document.fileName);
        logger.info(`Dosya yolu 'fileName' alanından oluşturuldu: ${filePath}`);
      } else {
        logger.error(`Belge için dosya yolu bulunamadı: ${documentId}`);
        return res.status(404).json({
          status: 'error',
          message: 'Belge dosyası bulunamadı'
        });
      }
      
      // Dosya adını belirle
      if (document.fileName) {
        fileName = document.fileName;
      } else if (document.originalName) {
        fileName = document.originalName;
      }
      
      // Dosyanın varlığını kontrol et
      try {
        await fs.promises.access(filePath, fs.constants.F_OK);
      } catch (error) {
        logger.error(`Dosya bulunamadı: ${filePath}, Hata: ${error.message}`);
        return res.status(404).json({
          status: 'error',
          message: 'Belge dosyası bulunamadı'
        });
      }
      
      // MIME tipini belirle
      const mimeType = document.mimeType || mime.lookup(filePath) || 'application/pdf';
      
      // Dosyayı gönder
      logger.info(`Dosya indiriliyor: ${filePath}, dosya adı: ${fileName}, tip: ${mimeType}`);
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      // Güvenli dosya gönderimi için res.download kullan
      res.download(filePath, fileName, (err) => {
        if (err) {
          logger.error(`Dosya indirme hatası: ${err.message}`);
          if (!res.headersSent) {
            return res.status(500).json({
              status: 'error',
              message: 'Dosya indirilirken bir hata oluştu'
            });
          }
        }
        logger.info(`Dosya başarıyla indirildi: ${filePath}`);
      });
    } catch (error) {
      logger.error(`Belge indirme hatası: ${error.message}, Stack: ${error.stack}`);
      if (!res.headersSent) {
        next(error);
      }
    }
  }
 
  /**
   * Kullanıcının onay bekleyen belgelerini getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getPendingApprovals(req, res, next) {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10
      };
      
      // SOLID prensibi: Single Responsibility - Sadece debug logları ekleme sorumluluğu
      // Debug için ekstra bilgileri logla
      logger.info(`Onay bekleyen belgeler isteği: Kullanıcı: ${req.user.id}, Sayfa: ${options.page}, Limit: ${options.limit}`);
      
      // Kullanıcının rolünü logla
      logger.debug(`Kullanıcı rolü: ${req.user.role}, İsim: ${req.user.firstName} ${req.user.lastName}, Email: ${req.user.email}`);
      
      // Onay akışı modelini import edelim (veritabanını incelemek için)
      const ApprovalFlow = require('../../models/ApprovalFlow');
      const mongoose = require('mongoose');
      
      // Direkt onay akışlarını bul (kısıtlama olmadan)
      // YAGNI prensibi: Sadece debug amaçlı veritabanı sorgusu yapıyoruz
      try {
        // Tüm onay akışlarını getir
        const allFlows = await ApprovalFlow.find({status: 'pending', isTemplate: { $ne: true }})
          .populate('steps.userId', 'firstName lastName email')
          .lean();
        
        logger.debug(`Tüm onay akışları (${allFlows.length}): ${JSON.stringify(allFlows.map(flow => ({
          _id: flow._id,
          status: flow.status,
          currentStep: flow.currentStep,
          flowType: flow.flowType,
          stepsCount: flow.steps ? flow.steps.length : 0
        })))}`);
        
        // Kullanıcının olduğu adımları logla
        const userFlows = allFlows.filter(flow => 
          flow.steps && flow.steps.some(step => 
            step.userId && step.userId._id && step.userId._id.toString() === req.user.id
          )
        );
        
        if (userFlows.length > 0) {
          logger.debug(`Kullanıcının adımlarında olduğu akışlar (${userFlows.length}):`);
          userFlows.forEach(flow => {
            // Kullanıcının adımını bul
            const userStep = flow.steps.find(step => 
              step.userId && step.userId._id && step.userId._id.toString() === req.user.id
            );
            
            // Mevcut adımı bul
            const currentStep = flow.steps.find(step => step.order === flow.currentStep);
            
            logger.debug(`- Akış ${flow._id}: Adım: ${userStep ? userStep.order : 'Bilinmiyor'}, Mevcut Adım: ${flow.currentStep}, Eşleşiyor mu: ${userStep && currentStep && userStep.order === currentStep.order}`);
          });
        } else {
          logger.debug('Kullanıcının adımlarında olduğu akış bulunamadı');
        }
      } catch (dbError) {
        logger.error(`Onay akışlarını sorgulama hatası: ${dbError.message}`);
      }
      
      // Asıl işlev - onay bekleyen belgeleri getir
      // DRY prensibi: Servis katmanındaki fonksiyonu tekrar kullanıyoruz
      const result = await documentService.getPendingApprovals(req.user.id, options);
      
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      logger.error(`Onay bekleyen belgeleri getirme hatası: ${error.message}`);
      next(error);
    }
  }

  /**
   * Dashboard için istatistikleri getirir (rol tabanlı)
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getDashboardStats(req, res, next) {
    try {
      const { role, id, department } = req.user;
      
      logger.info(`Dashboard istatistikleri isteği: Kullanıcı: ${id}, Rol: ${role}, Departman: ${department || 'Belirtilmemiş'}`);
      
      // Rol büyük harfe çevrilerek gönderilmeli
      const upperCaseRole = typeof role === 'string' ? role.toUpperCase() : role;
      
      // Rol tabanlı istatistikleri al
      const stats = await documentService.getDashboardStats(id, upperCaseRole, department);
      
      res.status(200).json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      logger.error(`Dashboard istatistikleri getirme hatası: ${error.message}`);
      next(error);
    }
  }

  /**
   * Belge onay akışını getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getDocumentApprovalFlow(req, res, next) {
    try {
      const { documentId } = req.params;
      
      logger.info(`Belge onay akışı isteği: ID=${documentId}, Kullanıcı=${req.user.id}`);
      
      // Belge ID kontrolü
      if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
        logger.error(`Geçersiz belge ID: ${documentId}`);
        return res.status(400).json({
          status: 'error',
          message: 'Geçersiz belge ID formatı'
        });
      }
      
      // Belgeyi getir
      const document = await Document.findById(documentId);
      if (!document) {
        logger.error(`Belge bulunamadı: ${documentId}`);
        return res.status(404).json({
          status: 'error',
          message: 'Belge bulunamadı'
        });
      }
      
      // Kullanıcının erişim yetkisi var mı kontrol et
      try {
        documentService.checkDocumentAccess(document, req.user);
      } catch (error) {
        logger.error(`Belge erişim hatası: ${error.message}`);
        return res.status(403).json({
          status: 'error',
          message: 'Bu belgeye erişim yetkiniz bulunmuyor'
        });
      }
      
      // Onay akışını getir
      try {
        // Önce belgenin approvalFlowId'si varsa direkt olarak getir
        let approvalFlow = null;
        
        if (document.approvalFlowId) {
          approvalFlow = await ApprovalFlow.findById(document.approvalFlowId)
            .populate('steps.userId', 'firstName lastName email department position')
            .populate('createdBy', 'firstName lastName email department position');
        }
        
        // approvalFlowId yoksa veya geçersizse, belge ID'sine göre ara
        if (!approvalFlow) {
          approvalFlow = await approvalService.getApprovalFlow(documentId);
        }
        
        if (approvalFlow) {
          logger.info(`Belge onay akışı başarıyla getirildi: ${documentId}`);
          return res.status(200).json({
            status: 'success',
            data: { approvalFlow }
          });
        } else {
          // Onay akışı bulunamadı ama hata fırlatmak yerine null döndür
          logger.warn(`Belge için onay akışı bulunamadı: ${documentId}`);
          return res.status(200).json({
            status: 'success',
            data: { 
              approvalFlow: null, 
              message: 'Bu belge için onay akışı henüz oluşturulmamış',
              documentStatus: document.status
            }
          });
        }
      } catch (error) {
        // Onay akışı bulunamadı hatası
        if (error.name === 'NotFoundError' || error.message.includes('bulunamadı')) {
          logger.warn(`Belge için onay akışı bulunamadı: ${documentId}`);
          
          // Belge durumu tutarsız mı kontrol et
          if (document.status === 'pending' || document.status === 'in_review') {
            logger.warn(`Tutarsızlık tespit edildi: Belge durumu ${document.status} ama onay akışı yok`);
            
            // Belge durumunu düzelt
            document.status = 'draft';
            await document.save();
            logger.info(`Belge durumu 'draft' olarak düzeltildi: ${documentId}`);
            
            return res.status(200).json({
              status: 'success',
              data: { 
                approvalFlow: null, 
                message: 'Belge durumu tutarsızdı ve düzeltildi. Lütfen belgeyi tekrar onaya gönderin.',
                documentStatus: 'draft'
              }
            });
          }
          
          // 404 yerine boş bir onay akışı döndür
          return res.status(200).json({
            status: 'success',
            data: { 
              approvalFlow: null, 
              message: 'Bu belge için onay akışı henüz oluşturulmamış',
              documentStatus: document.status
            }
          });
        }
        
        // Diğer hatalar
        throw error;
      }
    } catch (error) {
      logger.error(`Belge onay akışı getirme hatası: ${error.message}, Stack: ${error.stack}`);
      next(error);
    }
  }

  /**
   * Onay akışı şablonlarını getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getApprovalTemplates(req, res, next) {
    try {
      const templates = await documentService.getApprovalTemplates();
      
      res.status(200).json({
        status: 'success',
        data: { templates }
      });
    } catch (error) {
      logger.error(`Onay şablonları getirme hatası: ${error.message}`);
      next(error);
    }
  }

  /**
   * Onay akışı şablonu oluşturur
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async createApprovalTemplate(req, res, next) {
    try {
      const template = await documentService.createApprovalTemplate(req.body, req.user.id);
      
      res.status(201).json({
        status: 'success',
        message: 'Onay akışı şablonu oluşturuldu',
        data: { template }
      });
    } catch (error) {
      logger.error(`Onay şablonu oluşturma hatası: ${error.message}`);
      next(error);
    }
  }

  /**
   * Tüm onay akışı şablonlarını getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getAllApprovalTemplates(req, res, next) {
    try {
      const templates = await approvalService.getApprovalTemplates();
      
      res.status(200).json({
        status: 'success',
        data: { templates }
      });
    } catch (error) {
      logger.error(`Onay akışı şablonları getirme hatası: ${error.message}`);
      next(error);
    }
  }

  /**
   * Tüm onay akışlarını getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getAllApprovalFlows(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const result = await approvalService.getAllApprovalFlows({ page, limit });
      
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      logger.error(`Onay akışları getirme hatası: ${error.message}`);
      next(error);
    }
  }

  /**
   * Tüm belgeleri siler (sadece admin için)
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async deleteAllDocuments(req, res, next) {
    try {
      const result = await documentService.deleteAllDocuments(req.user.id);
      
      res.status(200).json({
        status: 'success',
        message: `Tüm belgeler başarıyla silindi. Silinen belge sayısı: ${result.deletedCount}`,
        data: result
      });
    } catch (error) {
      logger.error(`Tüm belgeleri silme hatası: ${error.message}`);
      next(error);
    }
  }

  /**
   * Belgeye not ekler
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async addNoteToDocument(req, res, next) {
    try {
      const { documentId } = req.params;
      const { note } = req.body;
      
      if (!note || note.trim() === '') {
        return res.status(400).json({
          status: 'error',
          message: 'Not içeriği boş olamaz'
        });
      }
      
      // Belgeyi bul
      const document = await Document.findById(documentId);
      if (!document) {
        return res.status(404).json({
          status: 'error',
          message: 'Belge bulunamadı'
        });
      }
      
      // Belgeye not ekle
      if (!document.notes) {
        document.notes = [];
      }
      
      document.notes.push({
        content: note.trim(),
        createdBy: req.user.id,
        createdAt: new Date()
      });
      
      await document.save();
      
      // Log oluştur
      await Log.create({
        user: req.user.id,
        action: 'add_note',
        document: documentId,
        details: { note: note.trim() },
        timestamp: new Date()
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Not başarıyla eklendi',
        data: {
          document
        }
      });
    } catch (error) {
      logger.error(`Not ekleme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Belgeye ek dosya ekler
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async addFileToDocument(req, res, next) {
    try {
      const { documentId } = req.params;
      
      // Dosya kontrolü
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Dosya yüklenmelidir'
        });
      }
      
      // Belgeyi bul
      const document = await Document.findById(documentId);
      if (!document) {
        return res.status(404).json({
          status: 'error',
          message: 'Belge bulunamadı'
        });
      }
      
      // Dosya bilgilerini hazırla
      const files = req.files.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      }));
      
      // Belgeye dosyaları ekle
      if (!document.additionalFiles) {
        document.additionalFiles = [];
      }
      
      document.additionalFiles.push(...files);
      await document.save();
      
      // Log oluştur
      await Log.create({
        user: req.user.id,
        action: 'add_files',
        document: documentId,
        details: { files: files.map(f => f.originalname) },
        timestamp: new Date()
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Dosyalar başarıyla eklendi',
        data: {
          files,
          document
        }
      });
    } catch (error) {
      logger.error(`Dosya ekleme hatası: ${error.message}`);
      next(error);
    }
  }

  /**
   * Belgeye etiket ekler
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async addTagsToDocument(req, res, next) {
    try {
      const { documentId } = req.params;
      const { tags } = req.body;
      
      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Etiketler dizi olarak ve boş olmamalıdır'
        });
      }
      
      // Belgeyi bul
      const document = await Document.findById(documentId);
      if (!document) {
        return res.status(404).json({
          status: 'error',
          message: 'Belge bulunamadı'
        });
      }
      
      // Etiketleri normalize et
      const normalizedTags = tags.map(tag => 
        tag.trim().toLowerCase()
      ).filter(tag => tag !== '');
      
      // Belgeye etiketleri ekle
      if (!document.tags) {
        document.tags = [];
      }
      
      // Var olan etiketleri kontrol et ve yeni etiketleri ekle
      normalizedTags.forEach(tag => {
        if (!document.tags.includes(tag)) {
          document.tags.push(tag);
        }
      });
      
      await document.save();
      
      // Log oluştur
      await Log.create({
        user: req.user.id,
        action: 'add_tags',
        document: documentId,
        details: { tags: normalizedTags },
        timestamp: new Date()
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Etiketler başarıyla eklendi',
        data: {
          tags: document.tags,
          document
        }
      });
    } catch (error) {
      logger.error(`Etiket ekleme hatası: ${error.message}`);
      next(error);
    }
  }

  /**
   * Onay akışında adım atlatır (override)
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async overrideApprovalFlow(req, res, next) {
    try {
      const { documentId } = req.params;
      const { targetStep, action, reason } = req.body;
      
      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          status: 'error',
          message: 'Override işlemi için gerekçe belirtilmelidir'
        });
      }
      
      if (!['approve', 'reject', 'skip'].includes(action)) {
        return res.status(400).json({
          status: 'error',
          message: 'Geçersiz işlem. Geçerli değerler: approve, reject, skip'
        });
      }
      
      // Belgeyi bul
      const document = await Document.findById(documentId);
      if (!document) {
        return res.status(404).json({
          status: 'error',
          message: 'Belge bulunamadı'
        });
      }
      
      // Onay akışını bul
      const approvalFlow = await ApprovalFlow.findOne({ documentId });
      if (!approvalFlow) {
        return res.status(404).json({
          status: 'error',
          message: 'Belge için onay akışı bulunamadı'
        });
      }
      
      // Hedef adımı bul
      let step;
      if (targetStep) {
        step = approvalFlow.steps.find(s => s.order === parseInt(targetStep));
        if (!step) {
          return res.status(404).json({
            status: 'error',
            message: `${targetStep} numaralı adım bulunamadı`
          });
        }
      } else {
        // Hedef adım belirtilmemişse mevcut adımı kullan
        step = approvalFlow.steps.find(s => s.order === approvalFlow.currentStep);
      }
      
      // İşlemi uygula
      if (action === 'approve') {
        step.status = 'approved';
        step.actionDate = new Date();
        step.actionBy = req.user.id;
        step.comment = `Admin tarafından override edildi: ${reason}`;
        
        // Son adım mı kontrol et
        const isLastStep = step.order === approvalFlow.steps.length;
        
        if (isLastStep) {
          approvalFlow.status = 'approved';
          approvalFlow.completedAt = new Date();
          document.status = 'approved';
        } else {
          // Sonraki adıma geç
          approvalFlow.currentStep = step.order + 1;
        }
      } else if (action === 'reject') {
        step.status = 'rejected';
        step.actionDate = new Date();
        step.actionBy = req.user.id;
        step.comment = `Admin tarafından override edildi: ${reason}`;
        
        approvalFlow.status = 'rejected';
        approvalFlow.completedAt = new Date();
        document.status = 'rejected';
      } else if (action === 'skip') {
        step.status = 'skipped';
        step.actionDate = new Date();
        step.actionBy = req.user.id;
        step.comment = `Admin tarafından atlandı: ${reason}`;
        
        // Son adım mı kontrol et
        const isLastStep = step.order === approvalFlow.steps.length;
        
        if (isLastStep) {
          approvalFlow.status = 'approved';
          approvalFlow.completedAt = new Date();
          document.status = 'approved';
        } else {
          // Sonraki adıma geç
          approvalFlow.currentStep = step.order + 1;
        }
      }
      
      // Değişiklikleri kaydet
      await approvalFlow.save();
      await document.save();
      
      // Log oluştur
      await Log.create({
        user: req.user.id,
        action: `override_${action}`,
        document: documentId,
        details: { 
          step: step.order, 
          reason,
          previousStatus: document.status
        },
        timestamp: new Date()
      });
      
      res.status(200).json({
        status: 'success',
        message: `Onay akışı başarıyla override edildi: ${action}`,
        data: {
          approvalFlow,
          document
        }
      });
    } catch (error) {
      logger.error(`Onay akışı override hatası: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new DocumentController();
