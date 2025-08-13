const mongoose = require('mongoose');
const Document = require('../../models/Document');
const User = require('../../models/User');
const ApprovalFlow = require('../../models/ApprovalFlow');
const ApprovalTemplate = require('../../models/ApprovalTemplate');
const { DocumentStatus } = require('../../interfaces/IDocument');
const logger = require('../../config/logger');
const { ValidationError, NotFoundError, PermissionError } = require('../../utils/errors');

/**
 * Onay Akışı Servisi
 * SOLID prensiplerine uygun olarak tasarlanmıştır:
 * - Single Responsibility: Her metot tek bir iş yapar
 * - Open/Closed: Yeni özellikler eklenebilir, mevcut kod değiştirilmeden
 * - Liskov Substitution: Alt sınıflar üst sınıfların yerine geçebilir
 * - Interface Segregation: Kullanıcılar kullanmadıkları metotlara bağımlı değil
 * - Dependency Inversion: Yüksek seviye modüller düşük seviye modüllere bağımlı değil
 */
class ApprovalService {
  /**
   * Onay akışı oluşturur
   * @param {String} documentId - Belge ID'si
   * @param {String} userId - Oluşturan kullanıcı ID'si
   * @param {Array|String} approversOrTemplateId - Onaylayıcılar dizisi veya şablon ID'si
   * @param {String} flowType - Akış türü (sequential, quick)
   * @returns {Promise<Object>} Oluşturulan onay akışı
   */
  async createApprovalFlow(documentId, userId, approversOrTemplateId, flowType = 'sequential') {
    try {
      logger.info(`ApprovalService.createApprovalFlow çağrıldı: documentId=${documentId}, userId=${userId}`);
      
      // ID formatlarını kontrol et
      this.validateObjectId(documentId, 'Belge');
      this.validateObjectId(userId, 'Kullanıcı');
      
      // Belge kontrolü
      const document = await Document.findById(documentId);
      if (!document) {
        throw new NotFoundError(`${documentId} ID'li belge bulunamadı`);
      }
      
      // Kullanıcı kontrolü
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError(`${userId} ID'li kullanıcı bulunamadı`);
      }
      
      // Observer rolü onay akışı oluşturamaz
      if (user.role === 'OBSERVER') {
        throw new PermissionError('Observer rolü onay akışı oluşturamaz, sadece görüntüleyebilir');
      }
      
      // Kullanıcının yetkisi var mı?
      const isAdmin = user.role === 'ADMIN';
      const isManager = user.role === 'MANAGER';
      
      // createdBy bir nesne olabilir (populate edilmiş) veya ObjectId olabilir
      let createdById = '';
      if (document.createdBy) {
        if (typeof document.createdBy === 'object' && document.createdBy._id) {
          // Populate edilmiş User nesnesi
          createdById = document.createdBy._id.toString();
        } else {
          // ObjectId
          createdById = document.createdBy.toString();
        }
      }
      
      const userId_str = userId.toString();
      const isOwner = createdById === userId_str;
      
      // Debug log ekle
      logger.debug(`[APPROVAL-DEBUG] userId: ${userId_str}, createdById: ${createdById}, userRole: ${user.role}, isEqual: ${isOwner}`);
      
      // ADMIN her zaman onay akışı oluşturabilir
      // MANAGER kendi belgesine onay akışı oluşturabilir
      if (!isOwner && !isAdmin && !(isManager && isOwner)) {
        logger.warn(`Yetkisiz işlem: Kullanıcı=${userId} (${user.role}) onay akışı oluşturmaya çalışıyor, ancak belgenin sahibi değil. Belge sahibi=${createdById}`);
        throw new PermissionError('Bu belge için onay akışı oluşturma yetkiniz bulunmuyor');
      }
      
      // Zaten onay akışı var mı?
      const ApprovalFlow = require('../../models/ApprovalFlow');
      const existingFlow = await ApprovalFlow.findOne({ documentId });
      if (existingFlow) {
        logger.info(`${documentId} ID'li belge için zaten bir onay akışı mevcut: ${existingFlow._id}`);
        
        // Belge ile onay akışı arasındaki ilişkiyi kontrol et ve gerekirse güncelle
        if (!document.approvalFlowId || document.approvalFlowId.toString() !== existingFlow._id.toString()) {
          logger.warn(`Belge ve onay akışı arasında tutarsızlık tespit edildi. Belge güncelleniyor: documentId=${documentId}`);
          document.approvalFlowId = existingFlow._id;
          document.status = 'in_review'; // Belge durumunu güncelle
          
          // İlk onaylayıcıyı belgeye ekle
          if (existingFlow.steps && existingFlow.steps.length > 0) {
            const firstStep = existingFlow.steps.find(step => step.order === 1);
            if (firstStep) {
              document.currentApprover = firstStep.userId;
              document.currentApprovalStep = 1;
            }
          }
          
          await document.save();
          logger.info(`Belge-onay akışı ilişkisi düzeltildi: documentId=${documentId}, approvalFlowId=${existingFlow._id}`);
        }
        
        return existingFlow; // Mevcut akışı döndür
      }
      
      // Belge durumu ile onay akışı tutarlılığını kontrol et
      if (document.status === 'in_review') {
        logger.warn(`Tutarsızlık: ${documentId} ID'li belge onay sürecinde (${document.status}) ama onay akışı bulunamadı`);
        // Hata fırlatmak yerine yeni akış oluşturmaya devam et - document.service.js'de kontrol var
      }
      
      // Onaylayıcıları hazırla
      let approvers = [];
      let isTemplate = false;
      
      if (Array.isArray(approversOrTemplateId)) {
        // Doğrudan onaylayıcılar dizisi
        approvers = approversOrTemplateId;
        
        // Onaylayıcıların geçerli olduğunu kontrol et
        if (approvers.length === 0) {
          throw new ValidationError('En az bir onaylayıcı belirtmelisiniz');
        }
        
        // Onaylayıcıların varlığını kontrol et
        for (const approverId of approvers) {
          this.validateObjectId(approverId, 'Onaylayıcı');
          const approver = await User.findById(approverId);
          if (!approver) {
            throw new NotFoundError(`${approverId} ID'li onaylayıcı bulunamadı`);
          }
        }
      } else if (typeof approversOrTemplateId === 'string') {
        // Şablon ID'si
        const templateId = approversOrTemplateId;
        this.validateObjectId(templateId, 'Şablon');
        
        // Şablonu getir
        const ApprovalTemplate = require('../../models/ApprovalTemplate');
        const template = await ApprovalTemplate.findById(templateId);
        if (!template) {
          throw new NotFoundError(`${templateId} ID'li onay şablonu bulunamadı`);
        }
        
        // Şablon onaylayıcılarını kullan
        approvers = template.approvers;
        flowType = template.flowType || flowType;
        isTemplate = true;
        
        logger.info(`Şablon kullanılıyor: ${template.name}, onaylayıcı sayısı: ${approvers.length}`);
      } else {
        throw new ValidationError('Onaylayıcılar bir dizi veya şablon ID\'si olmalıdır');
      }
      
      // Akış türünü kontrol et
      const validFlowTypes = ['sequential', 'quick', 'standard'];
      if (!validFlowTypes.includes(flowType)) {
        throw new ValidationError(`Geçersiz onay akışı türü: ${flowType}. Geçerli değerler: ${validFlowTypes.join(', ')}`);
      }
      
      // Onay adımlarını oluştur
      const steps = [];
      
      for (let i = 0; i < approvers.length; i++) {
        const approverId = approvers[i];
        
        // Adım sırasını belirle
        const order = i + 1;
        
        // Adım durumunu belirle
        // Tüm adımlar başlangıçta 'pending' durumunda olmalı
        // Hiçbir adım 'approved' veya 'rejected' olarak başlamamalı
        const stepStatus = order === 1 ? 'pending' : 'waiting';
        
        steps.push({
          userId: approverId,
          order,
          status: stepStatus,
          actionDate: null,
          comment: ''
        });
      }
      
      // Belge başlığından onay akışı adı oluştur
      const flowName = document.title ? `${document.title} Onay Akışı` : `Belge #${documentId} Onay Akışı`;
      
      try {
        // Onay akışı oluştur
        const approvalFlow = await ApprovalFlow.create({
          name: flowName, // Zorunlu name alanını ekle
          documentId,
          createdBy: userId,
          flowType,
          status: 'pending',
          steps,
          currentStep: 1,
          isTemplate,
          completedAt: null
        });
        
        // Belgeyi güncelle - onay akışı ID'sini belgeye ekle
        document.approvalFlowId = approvalFlow._id;
        document.status = 'in_review'; // Belge durumunu güncelle
        
        // İlk onaylayıcıyı belgeye ekle
        if (steps.length > 0) {
          const firstStep = steps.find(step => step.order === 1);
          if (firstStep) {
            document.currentApprover = firstStep.userId;
            document.currentApprovalStep = 1;
          }
        }
        
        await document.save();
        
        logger.info(`Onay akışı oluşturuldu: ${approvalFlow._id}, adım sayısı: ${steps.length}`);
        return approvalFlow;
      } catch (error) {
        logger.error(`Onay akışı oluşturma hatası: ${error.message}`);
        throw error;
      }
    } catch (error) {
      logger.error(`Onay akışı oluşturma servisi hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Onay akışını getirir
   * @param {String} documentId - Belge ID'si
   * @returns {Promise<Object>} Onay akışı
   */
  async getApprovalFlow(documentId) {
    try {
      logger.info(`ApprovalService.getApprovalFlow çağrıldı: documentId=${documentId}`);
      
      // ID formatını kontrol et
      this.validateObjectId(documentId, 'Belge');
      
      // Onay akışını getir
      const approvalFlow = await ApprovalFlow.findOne({ documentId })
        .populate('steps.userId', 'firstName lastName email department')
        .populate('createdBy', 'firstName lastName email department position');
      
      // Belgeyi de getir
      const document = await Document.findById(documentId);
      
      if (!approvalFlow) {
        // Belge durumu kontrol et ve gerekirse düzelt
        if (document && (document.status === 'pending' || document.status === 'in_review')) {
          logger.warn(`Tutarsızlık tespit edildi: Belge durumu ${document.status} ama onay akışı yok. Belge durumu düzeltiliyor.`);
          
          // Belge durumunu draft'a çevir
          document.status = 'draft';
          await document.save();
          logger.info(`Belge durumu 'draft' olarak düzeltildi: documentId=${documentId}`);
        }
        
        throw new NotFoundError(`${documentId} ID'li belge için onay akışı bulunamadı`);
      }
      
      // Belge ve onay akışı arasındaki tutarlılığı kontrol et
      if (document && (!document.approvalFlowId || document.approvalFlowId.toString() !== approvalFlow._id.toString())) {
        logger.warn(`Belge ve onay akışı arasında tutarsızlık tespit edildi. Belge güncelleniyor: documentId=${documentId}`);
        
        // Belgeyi güncelle
        document.approvalFlowId = approvalFlow._id;
        
        // İlk onaylayıcıyı belgeye ekle
        if (approvalFlow.steps && approvalFlow.steps.length > 0) {
          const firstStep = approvalFlow.steps.find(step => step.order === 1);
          if (firstStep) {
            document.currentApprover = firstStep.userId;
            document.currentApprovalStep = 1;
          }
        }
        
        await document.save();
        logger.info(`Belge-onay akışı ilişkisi düzeltildi: documentId=${documentId}, approvalFlowId=${approvalFlow._id}`);
      }
      
      logger.info(`Onay akışı bulundu: ${approvalFlow._id}`);
      return approvalFlow;
    } catch (error) {
      logger.error(`Onay akışı getirme servisi hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Onay işlemini gerçekleştirir
   * @param {String} documentId - Belge ID'si
   * @param {String} userId - İşlemi yapan kullanıcı ID'si
   * @param {String} action - İşlem (approve, reject)
   * @param {String} comment - Yorum
   * @returns {Promise<Object>} Güncellenmiş onay akışı
   */
  async processApprovalAction(documentId, userId, action, comment) {
    try {
      logger.info(`ApprovalService.processApprovalAction çağrıldı: documentId=${documentId}, userId=${userId}, action=${action}`);
      
      // Girdi doğrulama
      this.validateObjectId(documentId, 'Belge');
      this.validateObjectId(userId, 'Kullanıcı');
      
      // Kullanıcı bilgilerini al
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError(`${userId} ID'li kullanıcı bulunamadı`);
      }
      
      // Observer rolü onay işlemi yapamaz
      if (user.role === 'OBSERVER') {
        throw new PermissionError('Observer rolü belgeleri onaylayamaz veya reddedemez, sadece görüntüleyebilir');
      }
      
      // Geçerli işlem mi?
      const validActions = ['approve', 'reject'];
      if (!validActions.includes(action)) {
        throw new ValidationError(`Geçersiz onay işlemi: ${action}. Geçerli değerler: ${validActions.join(', ')}`);
      }
      
      // Reddetme işlemi için yorum zorunlu
      if (action === 'reject' && (!comment || comment.trim() === '')) {
        throw new ValidationError('Reddetme işlemi için yorum zorunludur');
      }
      
      // Belgeyi getir
      const document = await Document.findById(documentId).populate('createdBy');
      if (!document) {
        throw new NotFoundError(`${documentId} ID'li belge bulunamadı`);
      }
      
      // Onay akışını getir
      const approvalFlow = await ApprovalFlow.findOne({ documentId });
      if (!approvalFlow) {
        logger.error(`${documentId} ID'li belge için onay akışı bulunamadı. Belge durumu: ${document.status}`);
        
        // Belge durumu tutarsız mı kontrol et
        if (document.status === DocumentStatus.IN_REVIEW || document.status === DocumentStatus.PENDING) {
          logger.error(`Tutarsızlık tespit edildi: Belge durumu ${document.status} ama onay akışı yok`);
          
          // Belgeyi düzelt - durumu draft'a çevir
          document.status = DocumentStatus.DRAFT;
          await document.save();
          logger.info(`Belge durumu 'draft' olarak düzeltildi: documentId=${documentId}`);
          
          throw new ValidationError(`${documentId} ID'li belge için onay akışı bulunamadı. Belge durumu '${document.status}' olmasına rağmen onay akışı yok. Bu bir sistem tutarsızlığıdır. Lütfen sistem yöneticisiyle iletişime geçin.`);
        }
        
        throw new NotFoundError(`${documentId} ID'li belge için onay akışı bulunamadı`);
      }
      
      // Belge ve onay akışı arasındaki tutarlılığı kontrol et
      if (!document.approvalFlowId || document.approvalFlowId.toString() !== approvalFlow._id.toString()) {
        logger.warn(`Belge ve onay akışı arasında tutarsızlık tespit edildi. Belge düzeltiliyor: documentId=${documentId}`);
        
        // Belgeyi güncelle
        document.approvalFlowId = approvalFlow._id;
        
        // İlk onaylayıcıyı belgeye ekle
        if (approvalFlow.steps && approvalFlow.steps.length > 0) {
          const firstStep = approvalFlow.steps.find(step => step.order === 1);
          if (firstStep) {
            document.currentApprover = firstStep.userId;
            document.currentApprovalStep = 1;
          }
        }
        
        // Belge durumunu da kontrol et
        if (document.status === DocumentStatus.DRAFT) {
          document.status = DocumentStatus.IN_REVIEW;
          logger.info(`Belge durumu 'in_review' olarak güncellendi: documentId=${documentId}`);
        }
        
        await document.save();
        logger.info(`Belge-onay akışı ilişkisi düzeltildi: documentId=${documentId}, approvalFlowId=${approvalFlow._id}`);
      }
      
      // Kullanıcı ID'sini string'e çevir
      const userIdStr = userId.toString();
      
      // Kullanıcı rolünü ve belge sahibi rolünü kontrol et
      const userRole = user.role ? user.role.toUpperCase() : '';
      const documentOwnerRole = document.createdBy && document.createdBy.role ? document.createdBy.role.toUpperCase() : '';
      const documentOwnerId = document.createdBy && document.createdBy._id ? document.createdBy._id.toString() : '';
      
      // Belge sahibi kendisi mi kontrol et
      const isOwner = documentOwnerId === userIdStr;
      if (isOwner) {
        logger.warn(`Kullanıcı ${userIdStr} kendi belgesini ${action} edemez`);
        throw new PermissionError(`Kendi belgenizi ${action === 'approve' ? 'onaylayamazsınız' : 'reddedemezsiniz'}`);
      }
      
      // MANAGER rolündeki kullanıcı ADMIN'in belgesini onaylıyor mu?
      const isManagerApprovingAdminDocument = 
        userRole === 'MANAGER' && 
        documentOwnerRole === 'ADMIN';
      
      logger.debug(`[APPROVAL-DEBUG] userId: ${userIdStr}, userRole: ${userRole}, documentOwnerRole: ${documentOwnerRole}, isManagerApprovingAdminDocument: ${isManagerApprovingAdminDocument}, isOwner: ${isOwner}`);
      
      // Özel durum: MANAGER rolündeki kullanıcı ADMIN'in belgesini onaylıyor
      if (isManagerApprovingAdminDocument) {
        logger.info(`MANAGER rolündeki kullanıcı ${userId}, ADMIN'in oluşturduğu belgeyi işliyor: ${action}`);
        
        // Kullanıcı onay akışında yer alıyor mu?
        const userSteps = approvalFlow.steps.filter(step => {
          if (!step.userId) return false;
          
          let stepUserId;
          if (typeof step.userId === 'object') {
            stepUserId = step.userId._id ? step.userId._id.toString() : null;
          } else {
            stepUserId = step.userId.toString();
          }
          
          return stepUserId === userIdStr;
        });
        
        // Kullanıcının adımlarını logla
        if (userSteps.length > 0) {
          logger.debug(`MANAGER kullanıcısının adımları (${userSteps.length}):`);
          userSteps.forEach((step, index) => {
            logger.debug(`Adım ${index+1}: order=${step.order}, status=${step.status}`);
          });
        } else {
          logger.warn(`MANAGER kullanıcısı ${userId} onay akışında yer almıyor`);
        }
        
        if (userSteps.length > 0) {
          logger.info(`MANAGER kullanıcısı ${userId}, onay akışında yer alıyor ve ADMIN'in belgesini ${action} işlemi yapabilir`);
          
          // İşlemi gerçekleştir - Onay akışında herhangi bir adımda yer alıyorsa işleme izin ver
          let result;
          let stepToProcess;
          
          // Akış türüne göre işlem yap
          if (approvalFlow.flowType === 'quick') {
            // Hızlı onayda herhangi bir adımda işlem yapabilir
            stepToProcess = userSteps.find(step => 
              step.status === 'pending' || step.status === 'waiting'
            );
            
            if (!stepToProcess) {
              // Eğer bekleyen adım bulunamadıysa, ilk adımı al
              stepToProcess = userSteps[0];
            }
            
            logger.debug(`[APPROVAL-DEBUG] Hızlı onay akışında MANAGER için adım bulundu: ${stepToProcess ? stepToProcess.order : 'bulunamadı'}`);
          } else if (approvalFlow.flowType === 'sequential' || approvalFlow.flowType === 'standard') {
            // Sıralı onayda mevcut adımın onaylayıcısı mı?
            const currentStep = approvalFlow.steps.find(step => step.order === approvalFlow.currentStep);
            
            // Adım kullanıcı ID'sini string olarak al
            let currentStepUserId = null;
            if (currentStep && currentStep.userId) {
              if (typeof currentStep.userId === 'object') {
                currentStepUserId = currentStep.userId._id ? currentStep.userId._id.toString() : null;
              } else {
                currentStepUserId = currentStep.userId.toString();
              }
            }
            
            const isCurrentStepUser = currentStepUserId === userIdStr;
            
            if (currentStep && isCurrentStepUser && currentStep.status === 'pending') {
              stepToProcess = currentStep;
              logger.debug(`[APPROVAL-DEBUG] Sıralı onay akışında MANAGER mevcut adımın onaylayıcısı: adım=${currentStep.order}`);
            } else {
              // Özel durum: MANAGER kullanıcısı onay akışında yer alıyor ama sırası henüz gelmemiş
              // ADMIN'in belgeleri için MANAGER'lar için özel izin - ilgili adımı bul
              
              // Önce bekleyen adımları kontrol et
              const pendingUserStep = userSteps.find(step => step.status === 'pending' || step.status === 'waiting');
              
              if (pendingUserStep) {
                stepToProcess = pendingUserStep;
                logger.debug(`[APPROVAL-DEBUG] MANAGER için bekleyen adım bulundu: ${pendingUserStep.order}`);
              } else {
                // Bekleyen adım yoksa ilk adımı al
                stepToProcess = userSteps[0];
                logger.debug(`[APPROVAL-DEBUG] MANAGER için bekleyen adım bulunamadı, ilk adım kullanılıyor: ${stepToProcess ? stepToProcess.order : 'bulunamadı'}`);
              }
            }
          }
          
          if (stepToProcess) {
            logger.info(`MANAGER kullanıcısı ${userId}, ${approvalFlow.flowType} akışında ADMIN'in belgesini ${action} işlemi yapabilir`);
            logger.debug(`[APPROVAL-DEBUG] İşlenecek adım: ${stepToProcess.order}, durumu: ${stepToProcess.status}`);
            
            // İşlemi gerçekleştir
            if (action === 'approve') {
              result = await this.approveStep(approvalFlow, stepToProcess, userId, comment);
            } else {
              result = await this.rejectStep(approvalFlow, stepToProcess, userId, comment);
            }
            
            // Belge durumunu güncelle
            if (approvalFlow.status === 'approved') {
              document.status = DocumentStatus.APPROVED;
              document.currentApprover = null;
              logger.debug(`[APPROVAL-DEBUG] Belge durumu 'approved' olarak güncellendi`);
            } else if (approvalFlow.status === 'rejected') {
              document.status = DocumentStatus.REJECTED;
              document.currentApprover = null;
              logger.debug(`[APPROVAL-DEBUG] Belge durumu 'rejected' olarak güncellendi`);
            } else {
              // Bir sonraki onaylayıcıyı belirle (sıralı akış için)
              if (approvalFlow.flowType === 'sequential' || approvalFlow.flowType === 'standard') {
                const nextStep = approvalFlow.steps.find(step => step.order === approvalFlow.currentStep);
                if (nextStep) {
                  document.currentApprover = nextStep.userId;
                  document.currentApprovalStep = approvalFlow.currentStep;
                  logger.debug(`[APPROVAL-DEBUG] Bir sonraki onaylayıcı belirlendi: adım=${approvalFlow.currentStep}, kullanıcı=${nextStep.userId}`);
                }
              }
            }
            
            // Onay geçmişine ekle
            document.approvalHistory.push({
              userId,
              action: action === 'approve' ? 'approved' : 'rejected',
              comment: comment || '',
              timestamp: new Date(),
              stepOrder: stepToProcess.order,
              flowType: approvalFlow.flowType
            });
            
            await document.save();
            
            logger.info(`MANAGER kullanıcısı ${userId}, ADMIN'in belgesini ${action} işlemi başarıyla tamamlandı`);
            return result || approvalFlow;
          } else {
            logger.warn(`MANAGER kullanıcısı ${userId} için uygun adım bulunamadı`);
            throw new PermissionError(`Bu belgeyi ${action === 'approve' ? 'onaylama' : 'reddetme'} yetkiniz bulunmuyor`);
          }
        }
      }
      
      // Standart yetki kontrolü
      const canApprove = await this.canUserApprove(approvalFlow, userId);
      logger.debug(`[APPROVAL-DEBUG] Standart yetki kontrolü sonucu: ${canApprove}`);
      
      if (!canApprove) {
        logger.warn(`Yetki hatası: ${userId} ID'li kullanıcı belgeyi onaylama/reddetme yetkisine sahip değil`);
        throw new PermissionError('Bu belgeyi onaylama veya reddetme yetkiniz bulunmuyor');
      }
      
      // Kullanıcının daha önce onay verip vermediğini kontrol et
      // Bu kontrol özellikle paralel onay için önemli
      const hasAlreadyApproved = approvalFlow.steps.some(step => 
        step.userId.toString() === userIdStr && step.status === 'approved'
      );
      
      if (hasAlreadyApproved) {
        logger.warn(`${userIdStr} ID'li kullanıcı bu belgeyi zaten onayladınız`);
        throw new ValidationError('Bu belgeyi zaten onayladınız');
      }
      
      // Adım işleme
      let stepToProcess;
      
      // Sıralı akışta mevcut adımı bul
      stepToProcess = approvalFlow.steps.find(step => step.order === approvalFlow.currentStep);
      
      if (!stepToProcess) {
        throw new ValidationError(`Onay akışında ${approvalFlow.currentStep}. adım bulunamadı`);
      }
      
      // Adım durumunu kontrol et
      if (stepToProcess.status !== 'pending') {
        throw new ValidationError(`Bu adım şu anda '${stepToProcess.status}' durumunda, işlem yapılamaz`);
      }
      
      // Kullanıcı bu adımın onaylayıcısı mı?
      // Adım kullanıcı ID'sini string olarak al
      let stepUserId;
      if (typeof stepToProcess.userId === 'object') {
        stepUserId = stepToProcess.userId._id ? stepToProcess.userId._id.toString() : null;
      } else {
        stepUserId = stepToProcess.userId.toString();
      }
      
      if (stepUserId !== userIdStr) {
        logger.warn(`Yetki hatası: ${userIdStr} ID'li kullanıcı, ${stepUserId} ID'li kullanıcıya ait adımı onaylamaya çalışıyor`);
        throw new PermissionError('Bu adımın onaylayıcısı siz değilsiniz');
      }
      
      // İşlemi gerçekleştir
      let result;
      if (action === 'approve') {
        result = await this.approveStep(approvalFlow, stepToProcess, userId, comment);
      } else {
        result = await this.rejectStep(approvalFlow, stepToProcess, userId, comment);
      }
      
      // Belge durumunu güncelle
      if (approvalFlow.status === 'approved') {
        document.status = DocumentStatus.APPROVED;
        document.currentApprover = null;
      } else if (approvalFlow.status === 'rejected') {
        document.status = DocumentStatus.REJECTED;
        document.currentApprover = null;
      } else {
        // Bir sonraki onaylayıcıyı belirle (sıralı akış için)
        if (approvalFlow.flowType === 'sequential' || approvalFlow.flowType === 'standard') {
          const nextStep = approvalFlow.steps.find(step => step.order === approvalFlow.currentStep);
          if (nextStep) {
            document.currentApprover = nextStep.userId;
            document.currentApprovalStep = approvalFlow.currentStep;
          }
        }
      }
      
      // Onay geçmişine ekle
      document.approvalHistory.push({
        userId,
        action: action === 'approve' ? 'approved' : 'rejected',
        comment: comment || '',
        timestamp: new Date(),
        stepOrder: stepToProcess.order,
        flowType: approvalFlow.flowType
      });
      
      await document.save();
      
      logger.info(`Belge ${action} işlemi başarıyla tamamlandı: documentId=${documentId}, userId=${userId}`);
      return result;
    } catch (error) {
      logger.error(`Onay işlemi hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Onay adımını onaylar
   * @param {Object} approvalFlow - Onay akışı
   * @param {Object} step - Onay adımı
   * @param {String} userId - Kullanıcı ID'si
   * @param {String} comment - Yorum
   * @private
   */
  async approveStep(approvalFlow, step, userId, comment) {
    try {
      logger.info(`ApprovalService.approveStep çağrıldı: approvalFlowId=${approvalFlow._id}, stepOrder=${step.order}, userId=${userId}`);
      
      // Kullanıcı ID'sini string'e çevir
      const userIdStr = userId.toString();
      
      // Adımın kullanıcıya ait olduğunu kontrol et
      if (step.userId.toString() !== userIdStr) {
        logger.error(`Yetki hatası: ${userIdStr} ID'li kullanıcı, ${step.userId} ID'li kullanıcıya ait adımı onaylamaya çalışıyor`);
        throw new PermissionError('Bu adımın onaylayıcısı siz değilsiniz');
      }
      
      // Adım zaten onaylanmış mı kontrol et
      if (step.status === 'approved') {
        logger.warn(`${userIdStr} ID'li kullanıcı zaten onayladığı adımı tekrar onaylamaya çalışıyor`);
        throw new ValidationError('Bu adımı zaten onayladınız');
      }
      
      // Adımın durumunu güncelle
      step.status = 'approved';
      step.actionDate = new Date();
      step.comment = comment || '';
      step.actionBy = userId;
      
      // Akış türüne göre işlem yap
      if (approvalFlow.flowType === 'standard' || approvalFlow.flowType === 'sequential') {
        // Standart/sıralı akış: Sonraki adımı aktif et veya tamamla
        
        // Bu son adım mı?
        const isLastStep = step.order === approvalFlow.steps.length;
        
        if (isLastStep) {
          // Son adım onaylandı, onay akışını tamamla
          approvalFlow.status = 'approved';
          approvalFlow.completedAt = new Date();
          logger.info(`Son adım onaylandı, onay akışı tamamlandı: approvalFlowId=${approvalFlow._id}`);
        } else {
          // Sonraki adımı aktif et
          const nextStepOrder = step.order + 1;
          const nextStep = approvalFlow.steps.find(s => s.order === nextStepOrder);
          
          if (nextStep) {
            nextStep.status = 'pending';
            approvalFlow.currentStep = nextStepOrder;
            logger.info(`Sonraki adım aktif edildi: approvalFlowId=${approvalFlow._id}, nextStepOrder=${nextStepOrder}`);
          } else {
            logger.warn(`Sonraki adım bulunamadı: approvalFlowId=${approvalFlow._id}, nextStepOrder=${nextStepOrder}`);
          }
        }
      } else if (approvalFlow.flowType === 'quick') {
        // Hızlı onay: İlk onay geldiğinde tüm akış tamamlanır
        approvalFlow.status = 'approved';
        approvalFlow.completedAt = new Date();
        
        // Diğer tüm adımları atla (skip)
        approvalFlow.steps.forEach(s => {
          if (s._id.toString() !== step._id.toString() && s.status === 'pending') {
            s.status = 'skipped';
          }
        });
        
        logger.info(`Hızlı onay tamamlandı: approvalFlowId=${approvalFlow._id}`);
      }
      
      // Onay akışını kaydet
      await approvalFlow.save();
      
      logger.info(`Adım onaylandı: approvalFlowId=${approvalFlow._id}, stepOrder=${step.order}, userId=${userId}`);
      
      // Güncellenmiş onay akışını döndür
      return approvalFlow;
    } catch (error) {
      logger.error(`Adım onaylama hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Onay adımını reddeder
   * @param {Object} approvalFlow - Onay akışı
   * @param {Object} step - Onay adımı
   * @param {String} userId - Kullanıcı ID'si
   * @param {String} comment - Yorum
   * @private
   */
  async rejectStep(approvalFlow, step, userId, comment) {
    try {
      logger.info(`ApprovalService.rejectStep çağrıldı: approvalFlowId=${approvalFlow._id}, stepOrder=${step.order}, userId=${userId}`);
      
      if (!comment || comment.trim() === '') {
        throw new ValidationError('Reddetme işlemi için yorum zorunludur');
      }
      
      // Adımın durumunu güncelle
      step.status = 'rejected';
      step.actionDate = new Date();
      step.comment = comment;
      step.actionBy = userId;
      
      // Onay akışını reddet
      approvalFlow.status = 'rejected';
      approvalFlow.completedAt = new Date();
      approvalFlow.rejectionReason = comment;
      
      // Onay akışını kaydet
      await approvalFlow.save();
      
      logger.info(`Adım reddedildi: approvalFlowId=${approvalFlow._id}, stepOrder=${step.order}, userId=${userId}`);
      
      // Güncellenmiş onay akışını döndür
      return approvalFlow;
    } catch (error) {
      logger.error(`Adım reddetme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Onay şablonu oluşturur
   * @param {Object} templateData - Şablon verileri
   * @param {String} userId - Oluşturan kullanıcı ID'si
   * @returns {Promise<Object>} Oluşturulan şablon
   */
  async createApprovalTemplate(templateData, userId) {
    try {
      logger.info(`ApprovalService.createApprovalTemplate çağrıldı: userId=${userId}`);
      
      // ID formatını kontrol et
      this.validateObjectId(userId, 'Kullanıcı');
      
      // Kullanıcıyı getir
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError(`${userId} ID'li kullanıcı bulunamadı`);
      }
      
      // Observer rolü şablon oluşturamaz
      if (user.role === 'OBSERVER') {
        throw new PermissionError('Observer rolü şablon oluşturamaz, sadece görüntüleyebilir');
      }
      
      // Şablon verilerini doğrula
      if (!templateData.name || templateData.name.trim() === '') {
        throw new ValidationError('Şablon adı zorunludur');
      }
      
      if (!templateData.approvers || !Array.isArray(templateData.approvers) || templateData.approvers.length === 0) {
        throw new ValidationError('En az bir onaylayıcı belirtmelisiniz');
      }
      
      // Onaylayıcıların geçerli ID'ler olduğunu kontrol et
      for (const approverId of templateData.approvers) {
        this.validateObjectId(approverId, 'Onaylayıcı');
        
        const approver = await User.findById(approverId);
        if (!approver) {
          throw new NotFoundError(`${approverId} ID'li onaylayıcı bulunamadı`);
        }
      }
      
      // Akış türünü doğrula
      const flowType = templateData.flowType || 'sequential';
      const validFlowTypes = ['sequential', 'quick'];
      if (!validFlowTypes.includes(flowType)) {
        throw new ValidationError(`Geçersiz onay akışı türü: ${flowType}. Geçerli değerler: ${validFlowTypes.join(', ')}`);
      }
      
      // Şablon oluştur
      const template = await ApprovalTemplate.create({
        name: templateData.name.trim(),
        description: templateData.description ? templateData.description.trim() : '',
        approvers: templateData.approvers,
        flowType,
        createdBy: userId
      });
      
      logger.info(`Onay şablonu oluşturuldu: ${template._id}`);
      return template;
    } catch (error) {
      logger.error(`Onay şablonu oluşturma servisi hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Onay şablonlarını getirir
   * @param {String} userId - Kullanıcı ID'si
   * @returns {Promise<Array>} Şablonlar
   */
  async getApprovalTemplates(userId) {
    try {
      logger.info(`ApprovalService.getApprovalTemplates çağrıldı: userId=${userId}`);
      
      // ID formatını kontrol et
      this.validateObjectId(userId, 'Kullanıcı');
      
      // Kullanıcıyı getir
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError(`${userId} ID'li kullanıcı bulunamadı`);
      }
      
      // Kullanıcının rolüne göre şablonları getir
      let query = {};
      
      if (user.role !== 'ADMIN') {
        // Admin olmayan kullanıcılar sadece kendi şablonlarını görebilir
        query = { createdBy: userId };
      }
      
      // Şablonları getir
      const templates = await ApprovalTemplate.find(query)
        .populate('approvers', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
      
      logger.info(`${templates.length} onay şablonu bulundu`);
      return templates;
    } catch (error) {
      logger.error(`Onay şablonları getirme servisi hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Tüm onay akışlarını getirir
   * @param {Object} options - Sayfalama seçenekleri
   * @returns {Promise<Object>} Onay akışları
   */
  async getAllApprovalFlows(options = { page: 1, limit: 10 }) {
    try {
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Tüm onay akışlarını getir (isTemplate filtresi olmadan)
      const approvalFlows = await ApprovalFlow.find()
        .populate({
          path: 'createdBy',
          select: 'firstName lastName email'
        })
        .populate({
          path: 'steps.userId',
          select: 'firstName lastName email position department role'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      const total = await ApprovalFlow.countDocuments();
      
      return {
        approvalFlows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Onay akışları getirme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Kullanıcının onay bekleyen belgelerini getirir
   * @param {string} userId - Kullanıcı ID
   * @param {Object} options - Sayfalama seçenekleri
   * @returns {Promise<Object>} Onay bekleyen belgeler
   */
  async getPendingApprovals(userId, options = { page: 1, limit: 10 }) {
    try {
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Kullanıcının onay bekleyen adımlarını bul
      const approvalFlows = await ApprovalFlow.find({
        'steps.userId': userId,
        'steps.status': 'pending',
        status: 'pending',
        isTemplate: { $ne: true }
      }).populate({
        path: 'documentId',
        select: 'title description createdBy createdAt status'
      });
      
      // Kullanıcının onaylayabileceği belgeleri filtrele
      const pendingDocuments = [];
      
      for (const flow of approvalFlows) {
        // Onay akışı türüne göre kontrol
        const canApprove = flow.canUserApprove(userId);
        
        if (canApprove) {
          const document = flow.documentId;
          if (document) {
            pendingDocuments.push({
              document,
              approvalFlow: flow
            });
          }
        }
      }
      
      // Sayfalama
      const paginatedDocuments = pendingDocuments.slice(skip, skip + limit);
      
      return {
        documents: paginatedDocuments,
        pagination: {
          page,
          limit,
          totalItems: pendingDocuments.length,
          totalPages: Math.ceil(pendingDocuments.length / limit)
        }
      };
    } catch (error) {
      logger.error(`Onay bekleyen belgeleri getirme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * ObjectId formatını doğrular
   * @param {String} id - Doğrulanacak ID
   * @param {String} entityName - Varlık adı (hata mesajı için)
   * @private
   */
  validateObjectId(id, entityName = 'Kayıt') {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError(`Geçersiz ${entityName} ID'si: ${id}`);
    }
  }
  
  /**
   * Kullanıcının belgeyi onaylama yetkisi olup olmadığını kontrol eder
   * @param {Object} approvalFlow - Onay akışı
   * @param {String} userId - Kullanıcı ID'si
   * @returns {Promise<Boolean>} Onaylama yetkisi
   */
  async canUserApprove(approvalFlow, userId) {
    try {
      logger.info(`ApprovalService.canUserApprove çağrıldı: userId=${userId}`);
      
      // Guard clauses - Erken çıkış kontrolleri
      // 1. Kullanıcı kontrolü
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn(`Geçersiz kullanıcı ID: ${userId}`);
        return false;
      }
      
      // 2. Kullanıcı bilgilerini getir
      const user = await User.findById(userId);
      if (!user) {
        logger.warn(`${userId} ID'li kullanıcı bulunamadı`);
        return false;
      }
      
      // 3. OBSERVER rolündeki kullanıcılar onaylayamaz, sadece görüntüleyebilir
      if (user.role === 'OBSERVER') {
        logger.info(`${userId} ID'li kullanıcı OBSERVER rolünde, onaylama yetkisi yok`);
        return false;
      }
      
      // 4. Onay akışı kontrolü
      if (!approvalFlow || !approvalFlow.steps || approvalFlow.steps.length === 0) {
        logger.warn('Geçersiz onay akışı veya adımlar');
        return false;
      }
      
      // 5. Belge zaten onaylanmış veya reddedilmiş mi?
      if (approvalFlow.status === 'approved' || approvalFlow.status === 'rejected') {
        logger.info(`Onay akışı durumu: ${approvalFlow.status}, onaylama yetkisi yok`);
        return false;
      }
      
      // Kullanıcı ID'sini string'e çevir
      const userIdStr = userId.toString();
      
      // 6. Kullanıcı daha önce onaylamış mı kontrol et
      const hasAlreadyApproved = approvalFlow.steps.some(step => 
        step.userId.toString() === userIdStr && step.status === 'approved'
      );
      
      if (hasAlreadyApproved) {
        logger.info(`${userId} ID'li kullanıcı bu belgeyi zaten onaylamış`);
        return false;
      }
      
      // 7. Kullanıcı adımlarda var mı?
      const userSteps = approvalFlow.steps.filter(step => {
        if (!step.userId) return false;
        
        let stepUserId;
        if (typeof step.userId === 'object') {
          stepUserId = step.userId._id ? step.userId._id.toString() : null;
        } else {
          stepUserId = step.userId.toString();
        }
        
        return stepUserId === userIdStr;
      });
      
      if (userSteps.length === 0) {
        logger.info(`${userId} ID'li kullanıcı onay adımlarında bulunmuyor`);
        return false;
      }
      
      // 8. Admin her zaman onaylayabilir (eğer daha önce onaylamamışsa ve adımlarda varsa)
      if (user.role === 'ADMIN' && !hasAlreadyApproved && userSteps.length > 0) {
        logger.info(`${userId} ID'li kullanıcı ADMIN rolünde, onaylama yetkisi var`);
        return true;
      }
      
      // 9. Belge ve belge sahibi bilgilerini kontrol et
      if (approvalFlow.documentId) {
        try {
          // Belgeyi ve belge sahibini getir
          const document = await Document.findById(approvalFlow.documentId).populate('createdBy');
          
          if (document && document.createdBy) {
            // Belge sahibinin rolünü kontrol et
            const documentOwnerRole = document.createdBy.role ? document.createdBy.role.toUpperCase() : '';
            
            // Belge sahibi kendisi mi kontrol et
            const documentOwnerId = document.createdBy._id ? document.createdBy._id.toString() : document.createdBy.toString();
            const isOwner = documentOwnerId === userIdStr;
            
            // Debug log ekle
            logger.debug(`Belge sahibi kontrolü - Belge sahibi: ${documentOwnerId}, Kullanıcı: ${userIdStr}, Belge sahibi rolü: ${documentOwnerRole}, Kullanıcı rolü: ${user.role}, Eşleşme: ${isOwner}`);
            
            // Belge sahibi kendisi ise onaylayamaz
            if (isOwner) {
              logger.info(`Kullanıcı ${userIdStr} kendi belgesini onaylayamaz`);
              return false;
            }
            
            // MANAGER rolündeki kullanıcı ADMIN'in oluşturduğu belgeyi onaylayabilir
            if (user.role === 'MANAGER' && documentOwnerRole === 'ADMIN') {
              logger.info(`MANAGER rolündeki kullanıcı ${userId}, ADMIN'in oluşturduğu belgeyi onaylayabilir`);
              
              // MANAGER kullanıcısı onay akışında yer alıyor mu?
              if (userSteps.length > 0) {
                // Kullanıcının adımlarını logla
                userSteps.forEach((step, index) => {
                  logger.debug(`MANAGER kullanıcısının adımı ${index+1}: order=${step.order}, status=${step.status}`);
                });
                
                logger.info(`MANAGER kullanıcısı ${userId}, onay akışında yer alıyor ve ADMIN'in belgesini onaylayabilir`);
                
                // MANAGER rolündeki kullanıcılar ADMIN'in belgelerini onaylayabilir
                // Onay akışında herhangi bir adımda yer alıyorsa yeterli
                return true;
              }
            }
          }
        } catch (error) {
          logger.error(`Belge bilgisi getirme hatası: ${error.message}`);
        }
      }
      
      // 10. Akış türüne göre kontrol
      switch (approvalFlow.flowType) {
        case 'quick':
          // Hızlı onayda herhangi bir adımda onaylayabilir
          const canApproveQuick = userSteps.some(step => 
            step.status === 'pending' || step.status === 'waiting'
          );
          
          if (canApproveQuick) {
            logger.info(`Hızlı onay: ${userId} ID'li kullanıcı onaylayabilir`);
          } else {
            logger.info(`Hızlı onay: ${userId} ID'li kullanıcı onaylayamaz`);
          }
          
          return canApproveQuick;
          
        case 'sequential':
        case 'standard':
        default:
          // Sıralı onayda sadece mevcut adımın onaylayıcısı onaylayabilir
          const currentStep = approvalFlow.steps.find(step => step.order === approvalFlow.currentStep);
          if (!currentStep) {
            logger.warn(`Mevcut adım (${approvalFlow.currentStep}) bulunamadı`);
            return false;
          }
          
          // Adım kullanıcı ID'sini string olarak al
          let currentStepUserId;
          if (typeof currentStep.userId === 'object') {
            currentStepUserId = currentStep.userId._id ? currentStep.userId._id.toString() : null;
          } else {
            currentStepUserId = currentStep.userId.toString();
          }
          
          const isCurrentApprover = currentStepUserId === userIdStr;
          const isPendingStep = currentStep.status === 'pending';
          
          logger.debug(`Sıralı onay kontrolü - Mevcut adım: ${currentStep.order}, Adım durumu: ${currentStep.status}, Adım kullanıcısı: ${currentStepUserId}, Kullanıcı: ${userIdStr}, Eşleşme: ${isCurrentApprover}`);
          
          if (isCurrentApprover && isPendingStep) {
            logger.info(`Sıralı onay: ${userId} ID'li kullanıcı mevcut adımın onaylayıcısı, onaylayabilir`);
          } else {
            if (!isCurrentApprover) {
              logger.info(`Sıralı onay: ${userId} ID'li kullanıcı mevcut adımın onaylayıcısı değil`);
            } else if (!isPendingStep) {
              logger.info(`Sıralı onay: Mevcut adım '${currentStep.status}' durumunda, onaylanamaz`);
            }
          }
          
          return isCurrentApprover && isPendingStep;
      }
    } catch (error) {
      logger.error(`Onaylama yetkisi kontrolü hatası: ${error.message}`);
      return false;
    }
  }
}

module.exports = new ApprovalService();
