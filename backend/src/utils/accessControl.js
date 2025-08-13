/**
 * Belge erişim kontrolü yardımcı modülü
 * Basit ve anlaşılır erişim kuralları sağlar
 */

const logger = require('./logger');

// Rol sabitleri
const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  OFFICER: 'OFFICER',
  OBSERVER: 'OBSERVER',
};

/**
 * Kullanıcının belgeyi onaya gönderme yetkisini kontrol eder
 * @param {Object} user - Kullanıcı
 * @param {Object} document - Belge
 * @returns {Boolean} - Onaya gönderme izni
 */
const canSubmitForApproval = (user, document) => {
  try {
    if (!user || !document) {
      logger.error('canSubmitForApproval: Kullanıcı veya belge parametresi eksik');
      return false;
    }

    // Kullanıcı rolünü büyük harfe çevir
    const userRole = user.role ? user.role.toUpperCase() : '';
    
    // Observer hiçbir belgeyi onaya gönderemez
    if (userRole === ROLES.OBSERVER) {
      return false;
    }
    
    // Admin her belgeyi onaya gönderebilir
    if (userRole === ROLES.ADMIN) {
      return true;
    }
    
    // Belge sahibi kontrolü - Daha güvenli string karşılaştırması
    let userId = '';
    if (user._id) {
      userId = user._id.toString();
    } else if (user.id) {
      userId = user.id.toString();
    }
    
    // createdBy bir nesne olabilir (populate edilmiş) veya ObjectId olabilir
    let createdById = '';
    if (document.createdBy) {
      if (typeof document.createdBy === 'object') {
        if (document.createdBy._id) {
          // Populate edilmiş User nesnesi
          createdById = document.createdBy._id.toString();
        } else {
          // Sadece ObjectId
          createdById = document.createdBy.toString();
        }
      } else {
        // String veya diğer türler
        createdById = document.createdBy.toString();
      }
    }
    
    // Debug log ekle
    logger.debug(`[AC-DEBUG] canSubmitForApproval: userId=${userId}, createdById=${createdById}, role=${userRole}, createdByType=${typeof document.createdBy}, isEqual=${userId === createdById}`);
    
    // MANAGER ve OFFICER rolleri sadece kendi belgelerini onaya gönderebilir
    const isOwner = userId === createdById;
    
    if ((userRole === ROLES.MANAGER || userRole === ROLES.OFFICER) && isOwner) {
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Belge onaya gönderme kontrolü hatası: ${error.message}`);
    return false;
  }
};

/**
 * Kullanıcının belgeyi görüntüleme yetkisini kontrol eder
 * @param {Object} user - Kullanıcı
 * @param {Object} document - Belge
 * @returns {Boolean} - Görüntüleme izni
 */
const canViewDocument = (user, document) => {
  try {
    if (!user || !document) {
      return false;
    }

    // Kullanıcı rolünü büyük harfe çevir
    const userRole = user.role ? user.role.toUpperCase() : '';
    
    // Admin her belgeyi görüntüleyebilir
    if (userRole === ROLES.ADMIN) {
      return true;
    }
    
    // Observer tüm belgeleri görüntüleyebilir (read-only)
    if (userRole === ROLES.OBSERVER) {
      return true;
    }
    
    // Belge sahibi kontrolü
    const userIdStr = user._id ? user._id.toString() : user.id ? user.id.toString() : '';
    let createdById = '';
    
    if (document.createdBy) {
      if (typeof document.createdBy === 'object') {
        createdById = document.createdBy._id ? document.createdBy._id.toString() : document.createdBy.toString();
      } else {
        createdById = document.createdBy.toString();
      }
    }
    
    // Belge sahibi her zaman görüntüleyebilir
    const isOwner = createdById === userIdStr;
    if (isOwner) {
      return true;
    }
    
    // MANAGER ve OFFICER rolleri için: Kendi belgeleri ve onay sürecinde oldukları belgeler
    if (userRole === ROLES.MANAGER || userRole === ROLES.OFFICER) {
      // Onay akışında yetkili mi kontrol et
      // Belge onay sürecindeyse ve kullanıcı onaylayıcılardan biriyse
      if (document.approvers && Array.isArray(document.approvers)) {
        const isApprover = document.approvers.some(approver => {
          if (!approver) return false;
          
          let approverId;
          if (typeof approver === 'object') {
            approverId = approver._id ? approver._id.toString() : approver.toString();
          } else {
            approverId = approver.toString();
          }
          
          return approverId === userIdStr;
        });
        
        if (isApprover) {
          return true;
        }
      }
      
      // Onay akışında mevcut onaylayıcı mı?
      if (document.currentApprover) {
        const currentApproverId = document.currentApprover.toString();
        if (currentApproverId === userIdStr) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    logger.error(`Belge görüntüleme kontrolü hatası: ${error.message}`);
    return false;
  }
};

/**
 * Kullanıcının belgeyi düzenleme yetkisini kontrol eder
 * @param {Object} user - Kullanıcı
 * @param {Object} document - Belge
 * @returns {Boolean} - Düzenleme izni
 */
const canEditDocument = (user, document) => {
  try {
    if (!user || !document) {
      return false;
    }

    // Kullanıcı rolünü büyük harfe çevir
    const userRole = user.role ? user.role.toUpperCase() : '';
    
    // Admin her belgeyi düzenleyebilir
    if (userRole === ROLES.ADMIN) {
      return true;
    }
    
    // Observer hiçbir belgeyi düzenleyemez
    if (userRole === ROLES.OBSERVER) {
      return false;
    }
    
    // Belge sahibi kontrolü
    const userIdStr = user._id ? user._id.toString() : user.id ? user.id.toString() : '';
    let createdById = '';
    
    if (document.createdBy) {
      if (typeof document.createdBy === 'object') {
        createdById = document.createdBy._id ? document.createdBy._id.toString() : document.createdBy.toString();
      } else {
        createdById = document.createdBy.toString();
      }
    }
    
    // Belge sahibi düzenleyebilir
    return createdById === userIdStr;
  } catch (error) {
    logger.error(`Belge düzenleme kontrolü hatası: ${error.message}`);
    return false;
  }
};

/**
 * Kullanıcının belgeyi onaylama yetkisini kontrol eder
 * @param {Object} user - Kullanıcı
 * @param {Object} document - Belge
 * @param {Object} approvalFlow - Onay akışı
 * @returns {Boolean} - Onaylama izni
 */
const canApproveDocument = (user, document, approvalFlow) => {
  try {
    if (!user || !document) {
      return false;
    }

    // Kullanıcı rolünü büyük harfe çevir
    const userRole = user.role ? user.role.toUpperCase() : '';
    
    // Observer hiçbir belgeyi onaylayamaz
    if (userRole === ROLES.OBSERVER) {
      return false;
    }
    
    // Admin her belgeyi onaylayabilir
    if (userRole === ROLES.ADMIN) {
      return true;
    }
    
    // Kullanıcı ID'sini string'e çevir
    const userIdStr = user._id ? user._id.toString() : user.id ? user.id.toString() : '';
    
    // Belge sahibi rolünü belirle
    let documentOwnerRole = null;
    if (document.createdBy) {
      if (typeof document.createdBy === 'object' && document.createdBy.role) {
        documentOwnerRole = document.createdBy.role.toUpperCase();
      }
    }
    
    // Belge sahibi ID'sini belirle
    let documentOwnerId = '';
    if (document.createdBy) {
      if (typeof document.createdBy === 'object') {
        documentOwnerId = document.createdBy._id ? document.createdBy._id.toString() : document.createdBy.toString();
      } else {
        documentOwnerId = document.createdBy.toString();
      }
    }
    
    // Belge sahibi kendisi mi kontrol et
    const isOwner = documentOwnerId === userIdStr;
    
    // Belge sahibi kendisi ise onaylayamaz (kendi belgesini onaylayamaz)
    if (isOwner) {
      logger.debug(`Kullanıcı ${userIdStr} kendi belgesini onaylayamaz`);
      return false;
    }
    
    // MANAGER, ADMIN'in oluşturduğu belgeleri onaylayabilir - ÖZEL DURUM
    if (userRole === ROLES.MANAGER && documentOwnerRole === ROLES.ADMIN) {
      logger.debug(`MANAGER rolündeki kullanıcı ${userIdStr}, ADMIN'in oluşturduğu belgeyi onaylayabilir (özel durum kontrolü)`);
      
      // Onay akışı varsa ve kullanıcı onay akışında yer alıyorsa
      if (approvalFlow && approvalFlow.steps && Array.isArray(approvalFlow.steps)) {
        // Kullanıcının herhangi bir adımda olup olmadığını kontrol et
        const userInAnyStep = approvalFlow.steps.some(step => {
          if (!step.userId) return false;
          
          let stepUserId;
          if (typeof step.userId === 'object') {
            stepUserId = step.userId._id ? step.userId._id.toString() : null;
          } else {
            stepUserId = step.userId.toString();
          }
          
          const isUserStep = stepUserId === userIdStr;
          if (isUserStep) {
            logger.debug(`MANAGER kullanıcısı ${userIdStr} onay akışında adım ${step.order} için yer alıyor`);
          }
          return isUserStep;
        });
        
        if (userInAnyStep) {
          logger.debug(`MANAGER kullanıcısı ${userIdStr} onay akışında yer alıyor ve ADMIN'in belgesini onaylayabilir`);
          return true;
        }
      }
      
      // Onay akışında mevcut onaylayıcı mı?
      if (document.currentApprover) {
        const currentApproverId = document.currentApprover.toString();
        if (currentApproverId === userIdStr) {
          logger.debug(`MANAGER kullanıcısı ${userIdStr}, belgenin mevcut onaylayıcısı olarak işaretlenmiş`);
          return true;
        }
      }
    }
    
    // MANAGER ve OFFICER rolleri için: Onay sürecinde yetkiliyse onaylayabilir
    if (userRole === ROLES.MANAGER || userRole === ROLES.OFFICER) {
      // Onay akışında mevcut onaylayıcı mı?
      if (document.currentApprover) {
        const currentApproverId = document.currentApprover.toString();
        if (currentApproverId === userIdStr) {
          logger.debug(`${userRole} kullanıcısı ${userIdStr}, belgenin mevcut onaylayıcısı`);
          return true;
        }
      }
      
      // Onay akışı varsa ve kullanıcı onay akışında yer alıyorsa
      if (approvalFlow && approvalFlow.steps && Array.isArray(approvalFlow.steps)) {
        // Sıralı onay akışı için
        if (approvalFlow.flowType === 'sequential' || approvalFlow.flowType === 'standard') {
          const currentStep = approvalFlow.steps.find(step => step.order === approvalFlow.currentStep);
          if (currentStep) {
            // Adım kullanıcı ID'sini string olarak al
            let currentStepUserId;
            if (typeof currentStep.userId === 'object') {
              currentStepUserId = currentStep.userId._id ? currentStep.userId._id.toString() : null;
            } else {
              currentStepUserId = currentStep.userId.toString();
            }
            
            const isCurrentApprover = currentStepUserId === userIdStr;
            const isPendingStep = currentStep.status === 'pending';
            
            logger.debug(`Onay akışı adım kontrolü: adım=${currentStep.order}, adım durumu=${currentStep.status}, adım kullanıcısı=${currentStepUserId}, mevcut kullanıcı=${userIdStr}, eşleşme=${isCurrentApprover}`);
            
            if (isCurrentApprover && isPendingStep) {
              logger.debug(`${userRole} kullanıcısı ${userIdStr}, sıralı onay akışında mevcut adımın onaylayıcısı`);
              return true;
            }
          }
        }
        
        // Hızlı onay akışı için
        if (approvalFlow.flowType === 'quick') {
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
          
          if (userSteps.length > 0) {
            const canApproveQuick = userSteps.some(step => 
              step.status === 'pending' || step.status === 'waiting'
            );
            
            if (canApproveQuick) {
              logger.debug(`${userRole} kullanıcısı ${userIdStr}, hızlı onay akışında onaylayabilir`);
              return true;
            }
          }
        }
      }
    }
    
    logger.debug(`Kullanıcı ${userIdStr} (${userRole}) için onay yetkisi bulunamadı`);
    return false;
  } catch (error) {
    logger.error(`Belge onaylama kontrolü hatası: ${error.message}`);
    return false;
  }
};

/**
 * Kullanıcının belgeye not/dosya ekleme yetkisini kontrol eder
 * @param {Object} user - Kullanıcı
 * @param {Object} document - Belge
 * @returns {Boolean} - Not/dosya ekleme izni
 */
const canAddNotesOrFiles = (user, document) => {
  try {
    if (!user || !document) {
      return false;
    }

    // Kullanıcı rolünü büyük harfe çevir
    const userRole = user.role ? user.role.toUpperCase() : '';
    
    // Observer hiçbir belgeye not/dosya ekleyemez
    if (userRole === ROLES.OBSERVER) {
      return false;
    }
    
    // Admin her belgeye not/dosya ekleyebilir
    if (userRole === ROLES.ADMIN) {
      return true;
    }
    
    // Belge sahibi kontrolü
    const userIdStr = user._id ? user._id.toString() : user.id ? user.id.toString() : '';
    let createdById = '';
    
    if (document.createdBy) {
      if (typeof document.createdBy === 'object') {
        createdById = document.createdBy._id ? document.createdBy._id.toString() : document.createdBy.toString();
      } else {
        createdById = document.createdBy.toString();
      }
    }
    
    // MANAGER ve OFFICER rolleri sadece kendi belgelerine not/dosya ekleyebilir
    const isOwner = createdById === userIdStr;
    if ((userRole === ROLES.MANAGER || userRole === ROLES.OFFICER) && isOwner) {
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Belgeye not/dosya ekleme kontrolü hatası: ${error.message}`);
    return false;
  }
};

/**
 * Kullanıcının belgeye etiket ekleme yetkisini kontrol eder
 * @param {Object} user - Kullanıcı
 * @returns {Boolean} - Etiket ekleme izni
 */
const canAddTags = (user) => {
  try {
    if (!user) {
      return false;
    }

    // Kullanıcı rolünü büyük harfe çevir
    const userRole = user.role ? user.role.toUpperCase() : '';
    
    // Observer hiçbir belgeye etiket ekleyemez
    if (userRole === ROLES.OBSERVER) {
      return false;
    }
    
    // ADMIN, MANAGER ve OFFICER rolleri etiket ekleyebilir
    return userRole === ROLES.ADMIN || userRole === ROLES.MANAGER || userRole === ROLES.OFFICER;
    
  } catch (error) {
    logger.error(`Belgeye etiket ekleme kontrolü hatası: ${error.message}`);
    return false;
  }
};

/**
 * Kullanıcının onay akışında adım atlatma (override) yetkisini kontrol eder
 * @param {Object} user - Kullanıcı
 * @returns {Boolean} - Adım atlatma izni
 */
const canOverrideApprovalFlow = (user) => {
  try {
    if (!user) {
      return false;
    }

    // Kullanıcı rolünü büyük harfe çevir
    const userRole = user.role ? user.role.toUpperCase() : '';
    
    // Sadece ADMIN rolü onay akışında adım atlatabilir
    return userRole === ROLES.ADMIN;
    
  } catch (error) {
    logger.error(`Onay akışı adım atlatma kontrolü hatası: ${error.message}`);
    return false;
  }
};

module.exports = {
  ROLES,
  canSubmitForApproval,
  canViewDocument,
  canEditDocument,
  canApproveDocument,
  canAddNotesOrFiles,
  canAddTags,
  canOverrideApprovalFlow
}; 