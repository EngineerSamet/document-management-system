const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const Document = require('../../models/Document');
const User = require('../../models/User');
const ApprovalFlow = require('../../models/ApprovalFlow');
const { DocumentStatus } = require('../../interfaces/IDocument');
const logger = require('../../config/logger');
const { ValidationError, NotFoundError, PermissionError } = require('../../utils/errors');
const { ROLES } = require('../../middleware/role.middleware'); // ROLES'u doğru konumdan import et

/**
 * Belge Servisi
 * SOLID prensiplerine uygun olarak tasarlanmıştır:
 * - Single Responsibility: Her metot tek bir iş yapar
 * - Open/Closed: Yeni özellikler eklenebilir, mevcut kod değiştirilmeden
 * - Liskov Substitution: Alt sınıflar üst sınıfların yerine geçebilir
 * - Interface Segregation: Kullanıcılar kullanmadıkları metotlara bağımlı değil
 * - Dependency Inversion: Yüksek seviye modüller düşük seviye modüllere bağımlı değil
 */
class DocumentService {
  /**
   * Yeni belge oluşturur
   * @param {Object} documentData - Belge verileri
   * @param {Object} file - Yüklenen ana dosya bilgisi
   * @param {String} userId - Belgeyi oluşturan kullanıcı ID'si
   * @param {Array} approvers - Onaylayıcıların ID listesi (opsiyonel)
   * @param {Array} additionalFiles - Ek dosyaların listesi (opsiyonel)
   * @returns {Promise<Object>} Oluşturulan belge
   */
  async createDocument(documentData, file, userId, approvers = [], additionalFiles = []) {
    try {
      logger.info(`DocumentService.createDocument çağrıldı: userId=${userId}`);
      
      // Kullanıcı kontrolü
      const user = await this.validateUser(userId);
      
      // Ana dosya bilgilerini hazırla
      const fileInfo = this.extractFileInfo(file);
      
      // Dosya bilgilerini kontrol et
      if (!fileInfo) {
        throw new ValidationError('Ana dosya bilgileri eksik veya geçersiz');
      }
      
      // Ek dosya bilgilerini hazırla
      let attachments = [];
      if (additionalFiles && additionalFiles.length > 0) {
        // Ek dosyaları işle
        attachments = additionalFiles
          .map(additionalFile => {
            // Dosya bilgilerini çıkar
            const additionalFileInfo = this.extractFileInfo(additionalFile);
            if (!additionalFileInfo) {
              logger.warn(`Geçersiz ek dosya: ${additionalFile.originalname || 'İsimsiz dosya'}`);
              return null;
            }
            
            // Ek dosya bilgilerini döndür
            return {
              filename: additionalFileInfo.filename,
              originalName: additionalFile.originalname,
              path: additionalFileInfo.path,
              mimetype: additionalFile.mimetype,
              size: additionalFile.size,
              uploadedBy: userId,
              uploadedAt: new Date()
            };
          })
          .filter(attachment => attachment !== null); // null değerleri filtrele
        
        logger.info(`${attachments.length} ek dosya işlendi`);
      }
      
      const documentToCreate = {
        title: documentData.title,
        description: documentData.description || '',
        createdBy: userId,
        // Ana dosya bilgilerini doğrudan Document modeline uygun şekilde ekle
        filePath: fileInfo.path,
        fileName: fileInfo.filename,
        fileSize: fileInfo.size,
        mimeType: fileInfo.mimetype,
        // Belge ilk oluşturulduğunda varsayılan durum 'draft' olmalıdır
        // Sadece onay akışı oluşturulduktan sonra 'pending' veya 'in_review' durumuna geçmeli
        status: DocumentStatus.DRAFT,
        tags: this.parseTags(documentData.tags),
        metadata: this.extractMetadata(documentData),
        content: documentData.content || 'Bu belge için varsayılan içerik metnidir. Minimum karakter sınırını sağlamak için oluşturulmuştur.',
        // Ek dosyaları ekle
        attachments: attachments
      };
      
      // Belge oluştur
      const document = await Document.create(documentToCreate);
      logger.info(`Belge oluşturuldu: ${document._id}, durum: ${document.status}, ek dosya sayısı: ${attachments.length}`);
      
      // Onaylayıcılar varsa ekle
      if (approvers && approvers.length > 0) {
        document.approvers = approvers;
        await document.save();
        logger.info(`Belgeye onaylayıcılar eklendi: ${approvers.join(', ')}`);
      }
      
      return document;
    } catch (error) {
      logger.error(`Belge oluşturma servisi hatası: ${error.message}`);
      
      // Mongoose validasyon hatalarını daha anlaşılır hale getir
      if (error.name === 'ValidationError') {
        const validationErrors = {};
        Object.keys(error.errors).forEach(field => {
          validationErrors[field] = error.errors[field].message;
        });
        
        throw new ValidationError('Belge verileri geçerli değil', validationErrors);
      }
      
      throw error;
    }
  }
  
  /**
   * Belge listesini getirir
   * @param {Object} filters - Filtreleme kriterleri
   * @param {Object} options - Sayfalama ve sıralama seçenekleri
   * @param {String} userId - İsteği yapan kullanıcı ID'si
   * @returns {Promise<Object>} Belgeler ve sayfalama bilgisi
   */
  async getDocuments(filters = {}, options = {}, userId) {
    try {
      logger.info(`DocumentService.getDocuments çağrıldı: userId=${userId}`);
      
      // Kullanıcı kontrolü
      const user = await this.validateUser(userId);
      
      // Sayfalama seçeneklerini ayarla
      const page = parseInt(options.page, 10) || 1;
      const limit = parseInt(options.limit, 10) || 10;
      const skip = (page - 1) * limit;
      
      // Sıralama seçeneklerini ayarla
      const sort = {};
      if (options.sortBy) {
        sort[options.sortBy] = options.sortOrder === 'desc' ? -1 : 1;
      } else {
        sort.createdAt = -1; // Varsayılan: en yeni en üstte
      }
      
      // Kullanıcı rolüne göre filtreleri ayarla
      const query = this.buildQueryByUserRole(filters, user);
      
      // Toplam belge sayısını al
      const total = await Document.countDocuments(query);
      
      // Belgeleri getir
      const documents = await Document.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email')
        .populate('approvers', 'name email')
        .lean();
      
      // Sayfalama bilgilerini hazırla
      const pagination = {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1
      };
      
      logger.info(`${documents.length} belge bulundu`);
      return { documents, pagination };
    } catch (error) {
      logger.error(`Belge listesi getirme servisi hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Belge detaylarını getirir
   * @param {String} documentId - Belge ID'si
   * @param {String} userId - İsteği yapan kullanıcı ID'si
   * @returns {Promise<Object>} Belge detayları
   */
  async getDocumentById(documentId, userId) {
    try {
      logger.info(`DocumentService.getDocumentById çağrıldı: documentId=${documentId}, userId=${userId}`);
      
      // ID formatını kontrol et
      this.validateObjectId(documentId, 'Belge');
      
      // Kullanıcı kontrolü
      const user = await this.validateUser(userId);
      
      // Belgeyi getir
      const document = await Document.findById(documentId)
        .populate('createdBy', 'firstName lastName email department position')
        .populate('approvers', 'firstName lastName email department position')
        .populate({
          path: 'approvalHistory.userId', 
          select: 'firstName lastName email department position',
          strictPopulate: false
        })
        .populate('approvalFlowId')
        .lean();
      
      // Belge bulunamadıysa hata fırlat
      if (!document) {
        throw new NotFoundError(`${documentId} ID'li belge bulunamadı`);
      }
      
      // Kullanıcının belgeye erişim yetkisi var mı?
      try {
        this.checkDocumentAccess(document, user);
      } catch (error) {
        logger.error(`Belge erişim hatası: ${error.message}, Stack: ${error.stack}`);
        throw new PermissionError('Bu belgeye erişim yetkiniz bulunmuyor');
      }
      
      logger.info(`Belge bulundu: ${documentId}`);
      return document;
    } catch (error) {
      logger.error(`Belge detayı getirme servisi hatası: ${error.message}, Stack: ${error.stack}`);
      throw error;
    }
  }
  
  /**
   * Belgeyi günceller
   * @param {String} documentId - Belge ID
   * @param {Object} updateData - Güncelleme verileri
   * @param {String} userId - Güncelleyen kullanıcı ID'si
   * @param {Object} file - Yüklenen yeni ana dosya (opsiyonel)
   * @param {Array} additionalFiles - Yüklenen yeni ek dosyalar (opsiyonel)
   * @returns {Promise<Object>} Güncellenen belge
   */
  async updateDocument(documentId, updateData, userId, file = null, additionalFiles = []) {
    try {
      logger.info(`DocumentService.updateDocument çağrıldı: documentId=${documentId}, userId=${userId}`);
      
      // ObjectId kontrolü
      this.validateObjectId(documentId, 'Belge');
      
      // Kullanıcı kontrolü
      const user = await this.validateUser(userId);
      
      // Belgeyi bul
      const document = await Document.findById(documentId);
      if (!document) {
        throw new NotFoundError(`${documentId} ID'li belge bulunamadı`);
      }
      
      // Erişim kontrolü
      this.checkDocumentUpdatePermission(document, user);
      
      // Güncellenecek alanları belirle
      const updateFields = { ...updateData };
      delete updateFields.file; // Dosya alanını kaldır, ayrıca işlenecek
      
      // Yeni ana dosya varsa işle
      if (file) {
        const fileInfo = this.extractFileInfo(file);
        if (fileInfo) {
          // Eski dosyayı sil (varsa)
          if (document.filePath) {
            try {
              await fs.unlink(document.filePath);
              logger.info(`Eski dosya silindi: ${document.filePath}`);
            } catch (error) {
              logger.warn(`Eski dosya silinirken hata: ${error.message}`);
            }
          }
          
          // Yeni dosya bilgilerini güncelle
          updateFields.filePath = fileInfo.path;
          updateFields.fileName = fileInfo.filename;
          updateFields.fileSize = fileInfo.size;
          updateFields.mimeType = fileInfo.mimetype;
          
          logger.info(`Belge dosyası güncellendi: ${fileInfo.filename}`);
        }
      }
      
      // Yeni ek dosyalar varsa işle
      if (additionalFiles && additionalFiles.length > 0) {
        // Ek dosyaları işle
        const newAttachments = additionalFiles
          .map(additionalFile => {
            const additionalFileInfo = this.extractFileInfo(additionalFile);
            if (!additionalFileInfo) {
              logger.warn(`Geçersiz ek dosya: ${additionalFile.originalname || 'İsimsiz dosya'}`);
              return null;
            }
            
            return {
              filename: additionalFileInfo.filename,
              originalName: additionalFile.originalname,
              path: additionalFileInfo.path,
              mimetype: additionalFile.mimetype,
              size: additionalFile.size,
              uploadedBy: userId,
              uploadedAt: new Date()
            };
          })
          .filter(attachment => attachment !== null);
        
        // Mevcut ek dosyalara yeni ek dosyaları ekle
        if (newAttachments.length > 0) {
          // Mevcut ek dosyalar varsa birleştir, yoksa yeni dizi oluştur
          if (document.attachments && document.attachments.length > 0) {
            updateFields.attachments = [...document.attachments, ...newAttachments];
          } else {
            updateFields.attachments = newAttachments;
          }
          
          logger.info(`${newAttachments.length} ek dosya eklendi`);
        }
      }
      
      // Etiketleri işle (varsa)
      if (updateData.tags) {
        updateFields.tags = this.parseTags(updateData.tags);
      }
      
      // Belgeyi güncelle
      const updatedDocument = await Document.findByIdAndUpdate(
        documentId,
        { $set: updateFields },
        { new: true, runValidators: true }
      );
      
      logger.info(`Belge güncellendi: ${documentId}`);
      
      return updatedDocument;
    } catch (error) {
      logger.error(`Belge güncelleme servisi hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Belgeyi siler
   * @param {String} documentId - Belge ID'si
   * @param {String} userId - İsteği yapan kullanıcı ID'si
   * @returns {Promise<Boolean>} Silme işlemi başarılı mı?
   */
  async deleteDocument(documentId, userId) {
    try {
      logger.info(`DocumentService.deleteDocument çağrıldı: documentId=${documentId}, userId=${userId}`);
      
      // ID formatını kontrol et
      this.validateObjectId(documentId, 'Belge');
      
      // Kullanıcı kontrolü
      const user = await this.validateUser(userId);
      
      // Belgeyi getir
      const document = await Document.findById(documentId);
      
      // Belge bulunamadıysa hata fırlat
      if (!document) {
        throw new NotFoundError(`${documentId} ID'li belge bulunamadı`);
      }
      
      // Kullanıcının belgeyi silme yetkisi var mı?
      this.checkDocumentDeletePermission(document, user);
      
      // Belgeyi sil
      await Document.findByIdAndDelete(documentId);
      logger.info(`Belge silindi: ${documentId}`);
      
      // İlişkili dosyayı sil
      if (document.fileInfo && document.fileInfo.path) {
        try {
          await fs.unlink(document.fileInfo.path);
          logger.info(`Belge dosyası silindi: ${document.fileInfo.path}`);
        } catch (fileError) {
          logger.error(`Belge dosyası silinemedi: ${fileError.message}`);
        }
      }
      
      return true;
    } catch (error) {
      logger.error(`Belge silme servisi hatası: ${error.message}`);
      throw error;
    }
  }
  
  // Yardımcı metotlar
  
  /**
   * Kullanıcı ID'sini doğrular ve kullanıcıyı getirir
   * @param {String} userId - Kullanıcı ID'si
   * @returns {Promise<Object>} Kullanıcı
   * @private
   */
  async validateUser(userId) {
    // ID formatını kontrol et
    this.validateObjectId(userId, 'Kullanıcı');
    
    // Kullanıcıyı getir
    const user = await User.findById(userId);
    
    // Kullanıcı bulunamadıysa hata fırlat
    if (!user) {
      throw new NotFoundError(`${userId} ID'li kullanıcı bulunamadı`);
    }
    
    return user;
  }
  
  /**
   * ObjectId formatını doğrular
   * @param {String} id - Doğrulanacak ID
   * @param {String} entityName - Varlık adı (hata mesajı için)
   * @private
   */
  validateObjectId(id, entityName = 'Kayıt') {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError(`Geçersiz ${entityName.toLowerCase()} ID formatı: ${id}`);
    }
  }
  
  /**
   * Dosya bilgilerini çıkarır
   * @param {Object} file - Multer dosya nesnesi
   * @returns {Object|null} Dosya bilgileri veya null
   */
  extractFileInfo(file) {
    // Dosya yoksa null döndür
    if (!file) {
      return null;
    }
    
    try {
      return {
        filename: file.filename,
        originalname: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size
      };
    } catch (error) {
      logger.error(`Dosya bilgileri çıkarılırken hata: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Etiketleri ayrıştırır
   * @param {String|Array} tags - Etiketler (JSON string veya dizi)
   * @returns {Array} Ayrıştırılmış etiketler
   * @private
   */
  parseTags(tags) {
    if (!tags) return [];
    
    try {
      // Zaten dizi ise doğrudan kullan
      if (Array.isArray(tags)) {
        return tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
      }
      
      // String ise JSON olarak ayrıştır
      if (typeof tags === 'string') {
        const parsedTags = JSON.parse(tags);
        if (Array.isArray(parsedTags)) {
          return parsedTags.map(tag => tag.trim()).filter(tag => tag.length > 0);
        }
      }
      
      return [];
    } catch (error) {
      logger.error(`Etiketleri ayrıştırma hatası: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Metadata bilgilerini çıkarır
   * @param {Object} documentData - Belge verileri
   * @returns {Object} Metadata bilgileri
   * @private
   */
  extractMetadata(documentData) {
    const metadata = {};
    
    // Metadata alanlarını belirle
    const metadataFields = ['category', 'department', 'expiryDate', 'priority'];
    
    // Metadata alanlarını ekle
    metadataFields.forEach(field => {
      if (documentData[field]) {
        metadata[field] = documentData[field];
      }
    });
    
    // Özel metadata varsa ekle
    if (documentData.metadata) {
      try {
        const customMetadata = typeof documentData.metadata === 'string' 
          ? JSON.parse(documentData.metadata) 
          : documentData.metadata;
          
        Object.assign(metadata, customMetadata);
      } catch (error) {
        logger.error(`Özel metadata ayrıştırma hatası: ${error.message}`);
      }
    }
    
    return metadata;
  }
  
  /**
   * Kullanıcı rolüne göre sorgu oluşturur
   * @param {Object} filters - Filtreleme kriterleri
   * @param {Object} user - Kullanıcı
   * @returns {Object} MongoDB sorgusu
   * @private
   */
  buildQueryByUserRole(filters, user) {
    const query = { ...filters };
    
    // Admin tüm belgeleri görebilir
    if (user.role === 'ADMIN') {
      return query;
    }
    
    // Normal kullanıcılar sadece kendi belgeleri ve onaylayıcısı oldukları belgeleri görebilir
    return {
      ...query,
      $or: [
        { createdBy: user._id },
        { approvers: user._id }
      ]
    };
  }
  
  /**
   * Kullanıcının belgeye erişim yetkisi olup olmadığını kontrol eder
   * @param {Object} document - Belge
   * @param {Object} user - Kullanıcı
   * @private
   */
  async checkDocumentAccess(document, user) {
    try {
      if (!document) {
        logger.error('checkDocumentAccess: Belge parametresi null veya undefined');
        throw new ValidationError('Belge bilgisi eksik');
      }

      if (!user) {
        logger.error('checkDocumentAccess: Kullanıcı parametresi null veya undefined');
        throw new ValidationError('Kullanıcı bilgisi eksik');
      }

      // Kullanıcı rolünü büyük harfe çevir ve kontrol et
      // Büyük-küçük harf duyarsız karşılaştırma için
      const userRole = user.role ? user.role.toUpperCase() : '';
      
      // Admin tüm belgelere erişebilir
      if (userRole === 'ADMIN') {
        logger.debug(`Admin kullanıcısı (${user._id || user.id}) belgeye erişim sağladı: ${document._id}`);
        return;
      }
      
      // Observer rolü tüm belgeleri görüntüleyebilir
      if (userRole === 'OBSERVER') {
        logger.debug(`Observer kullanıcısı (${user._id || user.id}) belgeyi görüntüledi: ${document._id}`);
        return;
      }
      
      // Kullanıcı ID'sini string'e çevir - user._id veya user.id kullanılabilir
      const userIdStr = user._id ? user._id.toString() : user.id ? user.id.toString() : '';
      if (!userIdStr) {
        logger.error('checkDocumentAccess: Kullanıcı ID bulunamadı');
        throw new ValidationError('Kullanıcı ID bilgisi eksik');
      }
      
      // Belge sahibi erişebilir - detaylı kontrol
      if (document.createdBy) {
        try {
          // document.createdBy bir ObjectId, string veya bir obje olabilir
          let createdById;
          
          if (typeof document.createdBy === 'object') {
            // Obje ise _id alanını kullan
            createdById = document.createdBy._id ? document.createdBy._id.toString() : document.createdBy.toString();
          } else {
            // String veya ObjectId ise doğrudan toString() kullan
            createdById = document.createdBy.toString();
          }
          
          // Belge sahibi kontrolü - hem _id hem de id alanlarını kontrol et
          if (createdById === userIdStr) {
            logger.debug(`Belge sahibi (${userIdStr}) belgeye erişim sağladı: ${document._id}`);
            return;
          }
          
          // Belge sahibi kontrolü başarısız olduğunda detaylı logla
          logger.debug(`Belge sahibi kontrolü: createdById=${createdById}, userIdStr=${userIdStr}, eşleşme=${createdById === userIdStr}`);
          
        } catch (createdByError) {
          logger.warn(`Belge sahibi dönüşüm hatası: ${createdByError.message}, createdBy: ${JSON.stringify(document.createdBy)}, user._id: ${user._id}, user.id: ${user.id}`);
          // Hata durumunda diğer kontrollere devam et
        }
      } else {
        logger.warn(`Belgenin createdBy alanı eksik: ${document._id}`);
      }
      
      // Onaylayıcı erişebilir
      if (document.approvers && Array.isArray(document.approvers)) {
        for (const approver of document.approvers) {
          // Null veya undefined kontrolü
          if (!approver) continue;
          
          try {
            // approver bir ObjectId, string veya bir obje olabilir
            let approverId;
            
            if (typeof approver === 'object') {
              // Obje ise _id alanını kullan
              approverId = approver._id ? approver._id.toString() : approver.toString();
            } else {
              // String veya ObjectId ise doğrudan toString() kullan
              approverId = approver.toString();
            }
            
            if (approverId === userIdStr) {
              logger.debug(`Onaylayıcı (${userIdStr}) belgeye erişim sağladı: ${document._id}`);
              return;
            }
          } catch (approverError) {
            logger.warn(`Onaylayıcı dönüşüm hatası: ${approverError.message}, approver: ${JSON.stringify(approver)}`);
            // Hata durumunda bu onaylayıcıyı atla ve diğerlerine devam et
            continue;
          }
        }
      } else {
        logger.debug(`Belgenin onaylayıcı listesi yok veya dizi değil: ${document._id}`);
      }
      
      // Manager rolü departman belgelerine erişebilir
      if (userRole === 'MANAGER' && document.department && user.department) {
        if (document.department === user.department) {
          logger.debug(`Departman yöneticisi (${userIdStr}) departman belgesine erişim sağladı: ${document._id}, Departman: ${document.department}`);
          return;
        }
      }
      
      // Belgenin onay akışını kontrol et
      if (document.approvalFlowId) {
        try {
          // Mevcut onaylayıcı kontrolü
          if (document.currentApprover) {
            const currentApproverId = document.currentApprover.toString();
            if (currentApproverId === userIdStr) {
              logger.debug(`Mevcut onaylayıcı (${userIdStr}) belgeye erişim sağladı: ${document._id}`);
              return;
            }
          }
          
          // Onay akışını asenkron olarak kontrol et
          const ApprovalFlow = require('../../models/ApprovalFlow');
          const approvalFlow = await ApprovalFlow.findById(document.approvalFlowId);
          
          if (approvalFlow) {
            // Kullanıcı onay akışında mı kontrol et
            const isInApprovalFlow = approvalFlow.steps && Array.isArray(approvalFlow.steps) && 
              approvalFlow.steps.some(step => 
                step.userId && step.userId.toString() === userIdStr
              );
            
            if (isInApprovalFlow) {
              logger.debug(`Onay akışındaki kullanıcı (${userIdStr}) belgeye erişim sağladı: ${document._id}`);
              return;
            }
          }
        } catch (error) {
          logger.warn(`Onay akışı kontrolü sırasında hata: ${error.message}`);
          // Hata durumunda diğer kontrollere devam et
        }
      }
      
      // Yetkisiz erişim
      logger.warn(`Yetkisiz erişim: Kullanıcı=${userIdStr}, Rol=${userRole}, Belge=${document._id}`);
      throw new PermissionError('Bu belgeye erişim yetkiniz bulunmuyor');
    } catch (error) {
      // Zaten PermissionError ise doğrudan ilet
      if (error instanceof PermissionError) {
        throw error;
      }
      
      logger.error(`Belge erişim kontrolü sırasında bir hata oluştu: ${error.message}, Stack: ${error.stack}`);
      throw new PermissionError(`Belge erişim kontrolü sırasında bir hata oluştu: ${error.message}`);
    }
  }
  
  /**
   * Kullanıcının belgeyi güncelleme yetkisi olup olmadığını kontrol eder
   * @param {Object} document - Belge
   * @param {Object} user - Kullanıcı
   * @private
   */
  checkDocumentUpdatePermission(document, user) {
    // Admin tüm belgeleri güncelleyebilir
    if (user.role === 'ADMIN') {
      return;
    }
    
    // Observer rolü belgeleri güncelleyemez
    if (user.role === 'OBSERVER') {
      throw new PermissionError('Observer rolü belgeleri düzenleyemez, sadece görüntüleyebilir');
    }
    
    // Sadece belge sahibi güncelleyebilir
    if (document.createdBy.toString() !== user._id.toString()) {
      throw new PermissionError('Bu belgeyi güncelleme yetkiniz bulunmuyor');
    }
    
    // Onay sürecindeki belgeler güncellenemez
    if (document.status !== DocumentStatus.DRAFT && document.status !== DocumentStatus.REJECTED) {
      throw new PermissionError('Onay sürecindeki belgeler güncellenemez');
    }
  }
  
  /**
   * Belge silme yetkisini kontrol eder
   * @param {Object} document - Belge
   * @param {Object} user - Kullanıcı
   * @throws {PermissionError} Yetki hatası
   */
  checkDocumentDeletePermission(document, user) {
    // Admin tüm belgeleri silebilir
    if (user.role === 'ADMIN') {
      return;
    }
    
    // Tabloya göre sadece ADMIN rolü belge silebilir
    throw new PermissionError('Belge silme yetkisi sadece ADMIN rolüne sahip kullanıcılara aittir');
  }
  
  /**
   * Belgeyi onaya gönderir
   * @param {String} documentId - Belge ID'si
   * @param {String} userId - Kullanıcı ID'si
   * @param {Array|String} approversOrTemplateId - Onaylayıcılar dizisi veya şablon ID'si
   * @param {String} flowType - Akış türü (standard, quick)
   * @returns {Promise<Object>} Onay akışı
   */
  async submitForApproval(documentId, userId, approversOrTemplateId, flowType = 'standard') {
    try {
      logger.info(`DocumentService.submitForApproval çağrıldı: documentId=${documentId}, userId=${userId}, flowType=${flowType}`);
      
      // ID formatını kontrol et
      this.validateObjectId(documentId, 'Belge');
      this.validateObjectId(userId, 'Kullanıcı');
      
      // Belgeyi getir
      const document = await Document.findById(documentId);
      if (!document) {
        throw new NotFoundError(`${documentId} ID'li belge bulunamadı`);
      }
      
      // Kullanıcı kontrolü
      const user = await this.validateUser(userId);
      
      // Observer rolü belgeleri onaya gönderemez
      if (user.role === 'OBSERVER') {
        throw new PermissionError('Observer rolü belgeleri onaya gönderemez, sadece görüntüleyebilir');
      }
      
      // Kullanıcının belge üzerinde yetkisi var mı?
      // Belge sahibi veya Admin rolü belgeyi onaya gönderebilir
      const userIdStr = userId.toString();
      
      // createdBy bir nesne olabilir (populate edilmiş) veya ObjectId olabilir
      let createdByStr = '';
      if (document.createdBy) {
        if (typeof document.createdBy === 'object' && document.createdBy._id) {
          // Populate edilmiş User nesnesi
          createdByStr = document.createdBy._id.toString();
        } else {
          // ObjectId
          createdByStr = document.createdBy.toString();
        }
      }
      
      // Debug logları ekle
      logger.debug(`[SUBMIT-DEBUG] userIdStr: ${userIdStr}`);
      logger.debug(`[SUBMIT-DEBUG] createdByStr: ${createdByStr}`);
      logger.debug(`[SUBMIT-DEBUG] user.role: ${user.role}`);
      logger.debug(`[SUBMIT-DEBUG] document.createdBy type: ${typeof document.createdBy}`);
      logger.debug(`[SUBMIT-DEBUG] isEqual: ${userIdStr === createdByStr}`);
      
      const isOwner = userIdStr === createdByStr;
      const isAdmin = user.role === 'ADMIN';
      const isManager = user.role === 'MANAGER';
      
      // MANAGER rolü kendi belgesini onaya gönderebilir
      if (!isOwner && !isAdmin && !(isManager && isOwner)) {
        logger.warn(`Yetkisiz işlem: Kullanıcı=${userId} belgeyi onaya göndermeye çalışıyor, ancak belgenin sahibi değil. Belge sahibi=${JSON.stringify(document.createdBy)}`);
        throw new PermissionError('Bu belge için onay akışı başlatma yetkiniz bulunmuyor. Sadece belge sahibi veya admin kullanıcılar belgeyi onaya gönderebilir.');
      }
      
      // Belge zaten onay sürecinde mi?
      // 'pending' durumundaki belgeler de onay sürecine gönderilebilir
      // Bu, yeni oluşturulan belgelerin doğrudan onay sürecine alınmasını sağlar
      if (document.status !== DocumentStatus.DRAFT && 
          document.status !== DocumentStatus.REJECTED && 
          document.status !== DocumentStatus.PENDING) {
        throw new ValidationError(`Bu belge zaten onay sürecinde veya onaylanmış (${document.status})`);
      }
      
      // ApprovalService'i kullanarak onay akışı oluştur
      const approvalService = require('./approval.service');
      const ApprovalFlow = require('../../models/ApprovalFlow');
      
      // Mevcut onay akışını kontrol et - zaten bir onay akışı varsa kullan
      const existingApprovalFlow = await ApprovalFlow.findOne({ documentId });
      if (existingApprovalFlow) {
        logger.info(`Belgenin zaten onay akışı var: ${existingApprovalFlow._id}`);
        return existingApprovalFlow;
      }
      
      // Onay akışı türünü doğrula - sadece geçerli değerler kabul edilir
      const validFlowTypes = ['standard', 'sequential', 'quick'];
      if (!validFlowTypes.includes(flowType)) {
        logger.error(`Geçersiz onay akışı türü: ${flowType}`);
        throw new ValidationError(`Geçersiz onay akışı türü: ${flowType}. Geçerli değerler: ${validFlowTypes.join(', ')}`);
      }
      
      // Onaylayıcıları hazırla
      let approvers = [];
      let templateId = null;
      
      if (Array.isArray(approversOrTemplateId)) {
        // Doğrudan onaylayıcılar dizisi
        approvers = approversOrTemplateId;
        logger.info(`Onaylayıcılar dizisi kullanılıyor: ${approvers.join(', ')}`);
        
        // Onaylayıcıların geçerli olduğunu kontrol et
        if (approvers.length === 0) {
          throw new ValidationError('En az bir onaylayıcı belirtmelisiniz');
        }
        
        // Onaylayıcıların varlığını kontrol et
        for (const approverId of approvers) {
          try {
            this.validateObjectId(approverId, 'Onaylayıcı');
            const approver = await User.findById(approverId);
            if (!approver) {
              throw new NotFoundError(`${approverId} ID'li onaylayıcı bulunamadı`);
            }
            
            // Onaylayıcı rolünü kontrol et - ADMIN ve MANAGER rolleri onaylayıcı olabilir
            if (approver.role !== 'ADMIN' && approver.role !== 'MANAGER') {
              logger.warn(`Uygun olmayan rol: ${approverId} ID'li kullanıcı ${approver.role} rolüne sahip, onaylayıcı olamaz`);
              throw new ValidationError(`${approver.firstName} ${approver.lastName} onaylayıcı olarak seçilemez. Sadece ADMIN ve MANAGER rolleri onaylayıcı olabilir.`);
            }
          } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
              throw error;
            }
            logger.error(`Onaylayıcı kontrolü hatası: ${error.message}`);
            throw new ValidationError(`Onaylayıcı kontrolü sırasında bir hata oluştu: ${error.message}`);
          }
        }
      } else if (typeof approversOrTemplateId === 'string') {
        // Şablon ID'si
        templateId = approversOrTemplateId;
        logger.info(`Şablon ID kullanılıyor: ${templateId}`);
      } else {
        throw new ValidationError('Onaylayıcılar bir dizi veya şablon ID\'si olmalıdır');
      }
      
      // Frontend ve backend akış türleri arasında eşleme yap
      // Akış türü eşleme tablosu - frontend'den gelen değerleri backend'e uygun formata dönüştür
      const flowTypeMapping = {
        'quick': 'quick',
        'standard': 'sequential',
        'sequential': 'sequential'
      };
      
      // Eşleme tablosunda varsa eşlenmiş değeri al, yoksa varsayılan olarak sequential kullan
      const mappedFlowType = flowTypeMapping[flowType] || 'sequential';
      
      logger.info(`Akış türü eşlemesi: '${flowType}' -> '${mappedFlowType}'`);
      
      // Önce mevcut onay akışını kontrol et
      const existingFlow = await ApprovalFlow.findOne({ documentId });
      
      // Eğer mevcut bir akış varsa
      if (existingFlow) {
        logger.warn(`${documentId} ID'li belge için zaten bir onay akışı mevcut: ${existingFlow._id}`);
        
        // Belge durumunu kontrol et ve gerekirse güncelle
        // 'pending' durumundaki belgeler de onay sürecine alınabilir
        if (document.status === DocumentStatus.DRAFT || 
            document.status === DocumentStatus.REJECTED || 
            document.status === DocumentStatus.PENDING) {
          // Belgeyi doğrudan güncelle, pre-save hook'unu atla
          await Document.findByIdAndUpdate(
            documentId,
            { 
              $set: { 
                status: DocumentStatus.IN_REVIEW,
                approvalFlowId: existingFlow._id,
                currentApprover: existingFlow.steps && existingFlow.steps.length > 0 ? 
                  existingFlow.steps.find(step => step.order === 1)?.userId : null,
                currentApprovalStep: 1
              } 
            },
            { new: true }
          );
          
          logger.info(`Belge durumu güncellendi: ${DocumentStatus.IN_REVIEW}`);
        }
        
        logger.info(`Mevcut onay akışı döndürülüyor: ${existingFlow._id}`);
        return existingFlow;
      } 
      
      // Belge pending/in_review durumunda ama onay akışı yoksa hata fırlat
      if (document.status === DocumentStatus.IN_REVIEW) {
        logger.error(`Tutarsızlık: ${documentId} ID'li belge onay sürecinde (${document.status}) ama onay akışı bulunamadı`);
        throw new ValidationError(`Belge '${document.title}' onay sürecinde görünüyor ama onay akışı bulunamadı. Sistem yöneticisiyle iletişime geçin.`);
      }
      
      // Yeni onay akışı oluştur
      logger.info(`Yeni onay akışı oluşturuluyor: documentId=${documentId}`);
      let approvalFlow;
      
      try {
        // Önce belge durumunu kontrol et
        // 'pending' durumundaki belgeler de onay sürecine alınabilir
        if (document.status === DocumentStatus.DRAFT || 
            document.status === DocumentStatus.REJECTED || 
            document.status === DocumentStatus.PENDING) {
          // Onay akışı oluşturmadan önce belge durumunu değiştirme
          logger.info(`Belge durumu onay öncesi kontrol edildi: ${document.status}`);
        } else {
          logger.warn(`Belge durumu onay akışı oluşturmak için uygun değil: ${document.status}`);
          throw new ValidationError(`Belge durumu '${document.status}' onay akışı oluşturmak için uygun değil. Sadece draft, pending veya rejected durumundaki belgeler onaya gönderilebilir.`);
        }
        
        // 1. ADIM: Önce onay akışını oluştur - transaction kullanmadan
        approvalFlow = await approvalService.createApprovalFlow(
          documentId, 
          userId, 
          templateId || approvers, 
          mappedFlowType
        );
        
        // Onay akışı oluşturulup oluşturulmadığını kontrol et
        if (!approvalFlow) {
          logger.error(`Onay akışı oluşturulamadı: documentId=${documentId}`);
          throw new Error("Onay akışı oluşturulamadı");
        }
        
        logger.info(`Onay akışı başarıyla oluşturuldu: ${approvalFlow._id}`);
        
        // Onay akışının veritabanına yazıldığından emin ol
        const flowCheck = await ApprovalFlow.findById(approvalFlow._id);
        if (!flowCheck) {
          logger.error(`Onay akışı veritabanına yazılamadı: ${approvalFlow._id}`);
          throw new Error("Onay akışı veritabanına yazılamadı");
        }
        logger.info(`Onay akışı veritabanında doğrulandı: ${approvalFlow._id}`);
        
        // İlk onaylayıcıyı belirle
        let currentApprover = null;
        if (approvalFlow.steps && approvalFlow.steps.length > 0) {
          const firstStep = approvalFlow.steps.find(step => step.order === 1);
          if (firstStep) {
            currentApprover = firstStep.userId;
          }
        }
        
        // 2. ADIM: Belge durumunu güncelle - pre-save hook'unu atla
        const updatedDocument = await Document.findByIdAndUpdate(
          documentId,
          { 
            $set: { 
              status: DocumentStatus.IN_REVIEW,
              approvalFlowId: approvalFlow._id,
              currentApprover: currentApprover,
              currentApprovalStep: 1,
              approvers: approvers.length > 0 && !templateId ? approvers : document.approvers
            } 
          },
          { new: true }
        );
        
        if (!updatedDocument) {
          throw new Error(`Belge güncellenemedi: ${documentId}`);
        }
        
        logger.info(`Belge başarıyla güncellendi: id=${documentId}, status=${DocumentStatus.IN_REVIEW}, approvalFlowId=${approvalFlow._id}`);
      } catch (error) {
        logger.error(`Onay akışı oluşturma veya belge güncelleme hatası: ${error.message}`);
        throw error;
      }
      
      logger.info(`Belge onaya gönderildi: ${documentId}, Onay Akışı: ${approvalFlow._id}, Durum: ${DocumentStatus.IN_REVIEW}`);
      return approvalFlow;
    } catch (error) {
      logger.error(`Belgeyi onaya gönderme servisi hatası: ${error.message}, Stack: ${error.stack}`);
      throw error;
    }
  }
  
  /**
   * Dashboard için istatistikleri getirir (rol tabanlı)
   * @param {String} userId - Kullanıcı ID'si
   * @param {String} role - Kullanıcı rolü
   * @param {String} department - Kullanıcı departmanı
   * @returns {Promise<Object>} Dashboard istatistikleri
   */
  async getDashboardStats(userId, role, department) {
    try {
      logger.info(`Dashboard istatistikleri hesaplanıyor: Kullanıcı: ${userId}, Rol: ${role}, Departman: ${department || 'Belirtilmemiş'}`);
      
      // Filtreleri hazırla
      let filter = {};
      
      // Rol tabanlı filtreleme - büyük harfli rol kontrolü
      const upperCaseRole = typeof role === 'string' ? role.toUpperCase() : role;
      
      if (upperCaseRole === 'ADMIN') {
        // Admin tüm belgeleri görebilir
        filter = {}; // Filtre yok, tüm belgeler
        logger.info('Admin rolü: Tüm belgeler görüntüleniyor');
      } else if (upperCaseRole === 'OBSERVER') {
        // Observer tüm belgeleri görebilir
        filter = {}; // Filtre yok, tüm belgeler
        logger.info('Observer rolü: Tüm belgeler görüntüleniyor');
      } else if (upperCaseRole === 'MANAGER') {
        // Yönetici kendi departmanının belgelerini görebilir
        if (department) {
          // Departman belgeleri
          filter = { 
            $or: [
              { 'createdBy.department': department }, 
              { createdBy: userId }
            ]
          };
          logger.info(`Yönetici rolü: ${department} departmanının belgeleri görüntüleniyor`);
        } else {
          // Departman bilgisi yoksa sadece kendi belgeleri
          filter = { createdBy: userId };
          logger.info('Yönetici rolü (departman bilgisi yok): Sadece kendi belgeleri görüntüleniyor');
        }
      } else {
        // Normal kullanıcı sadece kendi belgelerini ve onayladığı belgeleri görebilir
        filter = { 
          $or: [
            { createdBy: userId }, 
            { approvers: userId },
            // Kullanıcının onayladığı belgeler
            { 'approvalHistory.userId': userId }
          ]
        };
        logger.info('Normal kullanıcı rolü: Kendi belgeleri ve onayladığı belgeler görüntüleniyor');
      }
      
      // Belge sayılarını hesapla
      const totalDocuments = await Document.countDocuments(filter);
      
      // Onay bekleyen belgeler
      const pendingFilter = { ...filter, status: 'pending' };
      const pendingDocuments = await Document.countDocuments(pendingFilter);
      
      // Onaylanmış belgeler
      const approvedFilter = { ...filter, status: 'approved' };
      const approvedDocuments = await Document.countDocuments(approvedFilter);
      
      // Reddedilmiş belgeler
      const rejectedFilter = { ...filter, status: 'rejected' };
      const rejectedDocuments = await Document.countDocuments(rejectedFilter);
      
      // Kullanıcının onaylaması gereken belge sayısı
      const userPendingApprovals = await Document.countDocuments({
        status: 'pending',
        approvers: userId,
        // Henüz onaylamadığı belgeler
        'approvalHistory.userId': { $ne: userId }
      });
      
      // Son belgeleri getir (en fazla 5 adet)
      const recentDocuments = await Document.find(filter)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('createdBy', 'firstName lastName')
        .lean();
      
      // Sonuçları döndür
      const stats = {
        totalDocuments,
        pendingDocuments,
        approvedDocuments,
        rejectedDocuments,
        userPendingApprovals,
        recentDocuments,
        userRole: role,
        scope: role === 'ADMIN' ? 'system' : (role === 'MANAGER' && department ? 'department' : 'user')
      };
      
      logger.info(`Dashboard istatistikleri hesaplandı: ${JSON.stringify({
        total: totalDocuments,
        pending: pendingDocuments,
        approved: approvedDocuments,
        rejected: rejectedDocuments
      })}`);
      
      return stats;
    } catch (error) {
      logger.error(`Dashboard istatistikleri hesaplama hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kullanıcının belgelerini getirir
   * @param {String} userId - Kullanıcı ID'si
   * @param {Object} options - Sayfalama seçenekleri
   * @returns {Promise<Object>} Belgeler ve sayfalama bilgisi
   */
  async getUserDocuments(userId, options = {}) {
    try {
      logger.info(`DocumentService.getUserDocuments çağrıldı: userId=${userId}`);
      
      // Kullanıcı kontrolü
      await this.validateUser(userId);
      
      // Sayfalama seçeneklerini ayarla
      const page = parseInt(options.page, 10) || 1;
      const limit = parseInt(options.limit, 10) || 10;
      const skip = (page - 1) * limit;
      
      // Sıralama seçeneklerini ayarla
      const sort = {};
      if (options.sortBy) {
        sort[options.sortBy] = options.sortOrder === 'desc' ? -1 : 1;
      } else {
        sort.createdAt = -1; // Varsayılan: en yeni en üstte
      }
      
      // Kullanıcının belgelerini getir
      const query = { createdBy: userId };
      
      // Toplam belge sayısını al
      const total = await Document.countDocuments(query);
      
      // Belgeleri getir
      const documents = await Document.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName email department')
        .populate('approvers', 'firstName lastName email department')
        .lean();
      
      // Sayfalama bilgilerini hazırla
      const pagination = {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1
      };
      
      logger.info(`${documents.length} belge bulundu`);
      return { documents, pagination };
    } catch (error) {
      logger.error(`Kullanıcı belgeleri getirme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Tüm belgeleri getirir (admin ve yöneticiler için)
   * @param {Object} options - Filtreleme ve sayfalama seçenekleri
   * @returns {Promise<Object>} Belgeler ve sayfalama bilgisi
   */
  async getAllDocuments(options = {}) {
    try {
      logger.info(`DocumentService.getAllDocuments çağrıldı`);
      
      // Sayfalama seçeneklerini ayarla
      const page = parseInt(options.page, 10) || 1;
      const limit = parseInt(options.limit, 10) || 10;
      const skip = (page - 1) * limit;
      
      // Sıralama seçeneklerini ayarla
      const sort = {};
      if (options.sortBy) {
        sort[options.sortBy] = options.sortOrder === 'desc' ? -1 : 1;
      } else {
        sort.createdAt = -1; // Varsayılan: en yeni en üstte
      }
      
      // Filtreleri hazırla
      const filters = options.filters || {};
      const query = { ...filters };
      
      // Toplam belge sayısını al
      const total = await Document.countDocuments(query);
      
      // Belgeleri getir
      const documents = await Document.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName email department')
        .populate('approvers', 'firstName lastName email department')
        .lean();
      
      // Sayfalama bilgilerini hazırla
      const pagination = {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1
      };
      
      logger.info(`${documents.length} belge bulundu`);
      return { documents, pagination };
    } catch (error) {
      logger.error(`Tüm belgeleri getirme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Kullanıcının onay bekleyen belgelerini getirir
   * @param {String} userId - Kullanıcı ID'si
   * @param {Object} options - Sayfalama seçenekleri
   * @returns {Promise<Object>} Belgeler ve sayfalama bilgisi
   */
  async getPendingApprovals(userId, options = {}) {
    try {
      logger.info(`DocumentService.getPendingApprovals çağrıldı: userId=${userId}`);
      
      // Kullanıcı kontrolü
      await this.validateUser(userId);
      
      // Sayfalama seçenekleri
      const page = parseInt(options.page, 10) || 1;
      const limit = parseInt(options.limit, 10) || 10;
      const skip = (page - 1) * limit;
      
      // SOLID prensibi: Single Responsibility - Sadece onay bekleyen belgeleri getirme sorumluluğu
      const ApprovalFlow = require('../../models/ApprovalFlow');
      
      // DRY prensibi: Tekrarlayan kod yerine optimize edilmiş tek bir sorgu
      logger.debug(`Onay akışlarını arıyorum - Kullanıcı: ${userId}`);
      
      // 1. ADIM: Tüm onay bekleyen akışları bul
      const pendingFlows = await ApprovalFlow.find({
        'steps.userId': userId,        // Kullanıcı onay adımlarında olmalı
        status: 'pending',             // Akış durumu beklemede olmalı
        isTemplate: { $ne: true }      // Şablon olmamalı
      }).populate({
        path: 'documentId',
        select: 'title description createdBy createdAt status fileName fileSize tags metadata',
        populate: {
          path: 'createdBy',
          select: 'firstName lastName email department position'
        }
      }).populate({
        path: 'steps.userId',
        select: 'firstName lastName email department role'
      });
      
      logger.info(`${pendingFlows.length} onay bekleyen akış bulundu, detaylı kontrol yapılıyor`);
      
      // 2. ADIM: Belge listesini oluştur - şimdilik boş
      const pendingDocuments = [];
      
      // 3. ADIM: Her bir onay akışını işle
      for (const flow of pendingFlows) {
        try {
          // YAGNI prensibi: Sadece ihtiyacımız olan bilgileri kontrol edelim
          logger.debug(`Onay akışını işleme - Flow: ${flow._id}, Tür: ${flow.flowType}, Mevcut Adım: ${flow.currentStep}`);
          
          // Öncelikle belgenin var olduğundan emin ol
          const document = flow.documentId;
          if (!document) {
            logger.debug(`Belge bulunamadı - Flow: ${flow._id}`);
            continue;
          }
          
          // Kullanıcının belgeyi kendisinin oluşturup oluşturmadığını kontrol et
          let isCreator = false;
          if (document.createdBy) {
            const creatorId = document.createdBy._id ? document.createdBy._id.toString() : 
                             document.createdBy.toString();
            isCreator = creatorId === userId;
          }
          
          // Kullanıcı belgenin sahibiyse bu belgeyi gösterme
          if (isCreator) {
            logger.debug(`Kullanıcı belgenin sahibi - Document: ${document._id}, User: ${userId}`);
            continue;
          }
          
          // ÖNEMLİ: canUserApprove metodunu kullan
          // Bu metodu daha önce düzelttik, şimdi doğru çalışmalı
          const canApprove = flow.canUserApprove(userId);
          logger.debug(`canUserApprove sonucu: ${canApprove} - Flow: ${flow._id}`);
          
          if (canApprove) {
            logger.debug(`Kullanıcı onaylayabilir - Document: ${document._id}, Title: ${document.title}`);
            
            // Buraya kadar geldiyse, bu belge kullanıcının onay listesine eklenmelidir
            pendingDocuments.push({
              ...document.toObject(),
              approvalFlow: {
                _id: flow._id,
                name: flow.name || 'Onay Akışı',
                currentStep: flow.currentStep,
                steps: flow.steps,
                flowType: flow.flowType,
                status: flow.status
              },
              // Ön uç tarafında kullanılan alanları ekle
              canApprove: true,
              isCurrentApprover: true,
              currentApprover: flow.getCurrentApprover()
            });
            
            logger.info(`Belge onay listesine eklendi - Document: ${document._id}, Title: ${document.title}`);
          } else {
            logger.debug(`Kullanıcı onaylayamaz - Document: ${document._id}, Title: ${document.title}`);
          }
          
        } catch (flowError) {
          logger.error(`Onay akışı işleme hatası - Flow: ${flow._id}, Error: ${flowError.message}`);
        }
      }
      
      logger.info(`${pendingDocuments.length} onay bekleyen belge bulundu`);
      
      // 4. ADIM: Belgeleri sırala ve sayfalama yap
      const sortedDocuments = pendingDocuments.sort((a, b) => {
        if (options.sortBy === 'createdAt') {
          return options.sortOrder === 'desc' 
            ? new Date(b.createdAt) - new Date(a.createdAt)
            : new Date(a.createdAt) - new Date(b.createdAt);
        } else if (options.sortBy === 'title') {
          return options.sortOrder === 'desc'
            ? b.title.localeCompare(a.title)
            : a.title.localeCompare(b.title);
        } else {
          // Varsayılan olarak oluşturma tarihine göre sırala
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
      });
      
      const paginatedDocuments = sortedDocuments.slice(skip, skip + limit);
      
      logger.info(`${pendingDocuments.length} onay bekleyen belge bulundu, ${paginatedDocuments.length} belge döndürülüyor`);
      
      return { 
        documents: paginatedDocuments,
        pagination: {
          page,
          limit,
          total: pendingDocuments.length,
          pages: Math.ceil(pendingDocuments.length / limit) || 1
        }
      };
    } catch (error) {
      logger.error(`Onay bekleyen belgeleri getirme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kullanıcının onay bekleyen belgelerini getirir
   * @param {String} userId - Kullanıcı ID'si
   * @param {Object} options - Sayfalama seçenekleri
   * @returns {Promise<Object>} Belgeler ve sayfalama bilgisi
   */
  async getPendingDocuments(userId, options = {}) {
    try {
      logger.info(`DocumentService.getPendingApprovals çağrıldı: userId=${userId}`);
      
      // Kullanıcı kontrolü
      await this.validateUser(userId);
      
      // ApprovalFlow modelini import et
      const ApprovalFlow = require('../../models/ApprovalFlow');
      
      // Sayfalama seçeneklerini ayarla
      const page = parseInt(options.page, 10) || 1;
      const limit = parseInt(options.limit, 10) || 10;
      const skip = (page - 1) * limit;
      
      // Sıralama seçeneklerini ayarla
      const sort = {};
      if (options.sortBy) {
        sort[options.sortBy] = options.sortOrder === 'desc' ? -1 : 1;
      } else {
        sort.createdAt = -1; // Varsayılan: en yeni en üstte
      }
      
      // Performans iyileştirmesi: Sadece gerekli alanları seç
      // Onay akışlarını bul - sadece aktif ve kullanıcıya atanmış olanları
      const approvalFlows = await ApprovalFlow.find({
        'steps.userId': userId,
        status: 'pending',
        isTemplate: { $ne: true }
      }).populate({
        path: 'documentId',
        select: 'title description createdBy createdAt status fileName fileSize approvers',
        populate: {
          path: 'createdBy',
          select: 'firstName lastName email department position'
        }
      }).populate({
        path: 'steps.userId',
        select: 'firstName lastName email department role'
      });
      
      logger.info(`${approvalFlows.length} onay akışı bulundu`);
      
      // Kullanıcının onaylayabileceği belgeleri filtrele
      const pendingDocuments = [];
      
      for (const flow of approvalFlows) {
        try {
          // Onay akışı türüne göre kontrol
          const canApprove = flow.canUserApprove(userId);
          
          if (canApprove) {
            const document = flow.documentId;
            if (document) {
              // Belge ve onay akışı bilgilerini birleştir
              pendingDocuments.push({
                ...document.toObject(),
                approvalFlow: flow,
                canUserApprove: true,
                currentApprover: flow.getCurrentApprover()
              });
            }
          }
        } catch (error) {
          // Bir akışın işlenmesinde hata olursa, diğerlerini etkilememesi için hata yakala
          logger.error(`Onay akışı işlenirken hata: ${error.message}, Flow ID: ${flow._id}`);
          continue;
        }
      }
      
      // Sayfalama
      const paginatedDocuments = pendingDocuments.slice(skip, skip + limit);
      
      logger.info(`${pendingDocuments.length} onay bekleyen belge bulundu, ${paginatedDocuments.length} belge döndürülüyor`);
      return { 
        documents: paginatedDocuments,
        pagination: {
          page,
          limit,
          total: pendingDocuments.length,
          pages: Math.ceil(pendingDocuments.length / limit) || 1
        }
      };
    } catch (error) {
      logger.error(`Onay bekleyen belgeleri getirme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Onay şablonlarını getirir
   * @returns {Promise<Array>} Onay şablonları listesi
   */
  async getApprovalTemplates() {
    try {
      logger.info('DocumentService.getApprovalTemplates çağrıldı');
      
      // ApprovalTemplate modelini kullanarak şablonları getir
      const ApprovalTemplate = require('../../models/ApprovalTemplate');
      const templates = await ApprovalTemplate.find()
        .sort({ name: 1 })
        .populate('createdBy', 'firstName lastName email')
        .lean();
      
      logger.info(`${templates.length} onay şablonu bulundu`);
      return templates;
    } catch (error) {
      logger.error(`Onay şablonları getirme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Belgeyi indirir
   * @param {String} documentId - Belge ID'si
   * @returns {Promise<Object>} Dosya bilgileri
   */
  async downloadDocument(documentId) {
    try {
      logger.info(`DocumentService.downloadDocument çağrıldı: documentId=${documentId}`);
      
      // ID formatını kontrol et
      this.validateObjectId(documentId, 'Belge');
      
      // Belgeyi getir
      const document = await Document.findById(documentId);
      
      // Belge bulunamadıysa hata fırlat
      if (!document) {
        throw new NotFoundError(`${documentId} ID'li belge bulunamadı`);
      }
      
      // Dosya yolunu kontrol et - belge modelindeki farklı alanlara bakalım
      let filePath = null;
      
      // Olası dosya yolu alanları
      if (document.filePath) {
        filePath = document.filePath;
        logger.info(`Dosya yolu 'filePath' alanından alındı: ${filePath}`);
      } else if (document.fileInfo && document.fileInfo.path) {
        filePath = document.fileInfo.path;
        logger.info(`Dosya yolu 'fileInfo.path' alanından alındı: ${filePath}`);
      } else if (document.file && document.file.path) {
        filePath = document.file.path;
        logger.info(`Dosya yolu 'file.path' alanından alındı: ${filePath}`);
      }
      
      if (!filePath) {
        logger.error(`Belge için dosya yolu bulunamadı. Belge ID: ${documentId}, Belge alanları: ${JSON.stringify({
          hasFilePath: !!document.filePath,
          hasFileInfo: !!document.fileInfo,
          hasFile: !!document.file
        })}`);
        throw new NotFoundError('Belge dosyası bulunamadı');
      }
      
      // Dosya adını belirle
      let filename = 'document.pdf';
      if (document.fileName) {
        filename = document.fileName;
      } else if (document.fileInfo && document.fileInfo.originalname) {
        filename = document.fileInfo.originalname;
      } else if (document.file && document.file.originalname) {
        filename = document.file.originalname;
      }
      
      // MIME tipini belirle
      let mimeType = 'application/pdf';
      if (document.mimeType) {
        mimeType = document.mimeType;
      } else if (document.fileInfo && document.fileInfo.mimetype) {
        mimeType = document.fileInfo.mimetype;
      } else if (document.file && document.file.mimetype) {
        mimeType = document.file.mimetype;
      }
      
      // Dosya bilgilerini döndür
      return {
        path: filePath,
        filename: filename,
        mimeType: mimeType
      };
    } catch (error) {
      logger.error(`Belge indirme servisi hatası: ${error.message}, Stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Tüm belgeleri siler (Sadece ADMIN rolü için)
   * @param {String} userId - İsteği yapan kullanıcı ID'si
   * @returns {Promise<Object>} Silinen belge sayısı
   */
  async deleteAllDocuments(userId) {
    try {
      logger.info(`DocumentService.deleteAllDocuments çağrıldı: userId=${userId}`);
      
      // Kullanıcı kontrolü
      const user = await this.validateUser(userId);
      
      // Sadece ADMIN rolü bu işlemi yapabilir
      if (user.role !== ROLES.ADMIN) {
        throw new PermissionError('Bu işlemi sadece yöneticiler yapabilir');
      }
      
      // Tüm belgeleri bul
      const documents = await Document.find({});
      
      // İlişkili dosyaları sil
      for (const doc of documents) {
        if (doc.fileInfo && doc.fileInfo.path) {
          try {
            await fs.unlink(doc.fileInfo.path);
            logger.info(`Belge dosyası silindi: ${doc.fileInfo.path}`);
          } catch (fileError) {
            logger.error(`Belge dosyası silinemedi: ${fileError.message}`);
          }
        }
      }
      
      // Tüm belgeleri sil
      const result = await Document.deleteMany({});
      logger.info(`Tüm belgeler silindi. Silinen belge sayısı: ${result.deletedCount}`);
      
      return {
        deletedCount: result.deletedCount
      };
    } catch (error) {
      logger.error(`Tüm belgeleri silme servisi hatası: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new DocumentService();
