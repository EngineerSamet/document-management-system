const mongoose = require('mongoose');
const { ApprovalStatus, ApprovalFlowType } = require('../interfaces/IApprovalFlow');

// Onay adımı şeması
const ApprovalStepSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(ApprovalStatus),
    default: ApprovalStatus.PENDING
  },
  comment: {
    type: String
  },
  actionDate: {
    type: Date
  },
  role: {
    type: String,
    default: ''
  }
}, { _id: true });

// Onay geçmişi şeması
const ApprovalHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['approve', 'reject', 'cancel', 'reassign'],
    required: true
  },
  stepOrder: {
    type: Number,
    required: true
  },
  comment: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Onay akışı şeması
const ApprovalFlowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Onay akışı adı zorunludur'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: false
  },
  flowType: {
    type: String,
    enum: ['quick', 'standard', 'sequential'],
    default: 'standard',
    required: true
  },
  steps: [ApprovalStepSchema],
  history: [ApprovalHistorySchema],
  currentStep: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: Object.values(ApprovalStatus),
    default: ApprovalStatus.PENDING
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isTemplate: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Belge silindiğinde onay akışını da sil
ApprovalFlowSchema.index({ documentId: 1 });

// Onay durumunu güncelleme metodu
ApprovalFlowSchema.methods.updateStatus = function() {
  // Tüm adımlar onaylandıysa
  const allApproved = this.steps.every(step => step.status === ApprovalStatus.APPROVED);
  
  // Herhangi bir adım reddedildiyse
  const anyRejected = this.steps.some(step => step.status === ApprovalStatus.REJECTED);
  
  if (anyRejected) {
    this.status = ApprovalStatus.REJECTED;
  } else if (allApproved) {
    this.status = ApprovalStatus.APPROVED;
  } else {
    this.status = ApprovalStatus.PENDING;
  }
  
  return this;
};

// Sonraki adıma geçme metodu
ApprovalFlowSchema.methods.moveToNextStep = function() {
  if (this.currentStep < this.steps.length) {
    this.currentStep += 1;
  }
  return this;
};

// Mevcut adımı alma metodu
ApprovalFlowSchema.methods.getCurrentStep = function() {
  const logger = require('../config/logger');
  
  try {
    // Adımlar yoksa null döndür
    if (!this.steps || this.steps.length === 0) {
      logger.debug(`Flow ${this._id} - Adım bulunamadı, steps dizisi boş veya tanımlanmamış`);
      return null;
    }
    
    // Mevcut adım değeri yoksa null döndür
    if (this.currentStep === undefined || this.currentStep === null) {
      logger.debug(`Flow ${this._id} - Mevcut adım değeri tanımlanmamış`);
      return null;
    }
    
    // Mevcut adım numarasını integer'a çevir (string olabilir)
    const currentStepNumber = parseInt(this.currentStep, 10);
    if (isNaN(currentStepNumber)) {
      logger.debug(`Flow ${this._id} - Geçersiz adım numarası: ${this.currentStep}`);
      return null;
    }
    
    // Adımları order alanına göre sıralayalım
    const sortedSteps = [...this.steps].sort((a, b) => a.order - b.order);
    
    // Mevcut adımı bul
    const step = sortedSteps.find(step => step.order === currentStepNumber);
    
    if (!step) {
      logger.debug(`Flow ${this._id} - Mevcut adım (${this.currentStep}) steps dizisinde bulunamadı`);
      return null;
    }
    
    // Adım nesnesi detaylarını logla
    if (step.userId) {
      let userInfo;
      if (typeof step.userId === 'object') {
        // Populate edilmiş kullanıcı nesnesi
        userInfo = step.userId._id ? 
          `{_id: ${step.userId._id}, firstName: ${step.userId.firstName || 'undefined'}, lastName: ${step.userId.lastName || 'undefined'}}` : 
          JSON.stringify(step.userId);
      } else {
        // ObjectId
        userInfo = step.userId.toString();
      }
      
      logger.debug(`Flow ${this._id} - Mevcut adım bulundu: #${step.order}, Kullanıcı: ${userInfo}, Durum: ${step.status}`);
    } else {
      logger.debug(`Flow ${this._id} - Mevcut adım bulundu: #${step.order}, Kullanıcı: undefined, Durum: ${step.status}`);
    }
    
    return step;
  } catch (error) {
    logger.error(`Flow ${this._id} - getCurrentStep hatası: ${error.message}`);
    return null;
  }
};

// Mevcut onaylayıcıyı alma metodu
ApprovalFlowSchema.methods.getCurrentApprover = function() {
  const logger = require('../config/logger');
  
  const currentStep = this.getCurrentStep();
  if (!currentStep) {
    logger.debug(`Flow ${this._id} - Mevcut adım bulunamadı, onaylayıcı bilgisi alınamıyor`);
    return null;
  }
  
  // Adım içinde kullanıcı ID'si var mı?
  if (!currentStep.userId) {
    logger.debug(`Flow ${this._id} - Mevcut adımda (#${currentStep.order}) kullanıcı bilgisi yok`);
    return null;
  }
  
  logger.debug(`Flow ${this._id} - Mevcut onaylayıcı: ${currentStep.userId._id || currentStep.userId}`);
  return currentStep.userId;
};

// Onay geçmişine kayıt ekleme metodu
ApprovalFlowSchema.methods.addHistoryEntry = function(userId, action, stepOrder, comment) {
  this.history.push({
    userId,
    action,
    stepOrder,
    comment,
    timestamp: new Date()
  });
  return this;
};

// Onay akışı türüne göre adım kontrolü
ApprovalFlowSchema.methods.canUserApprove = function(userId) {
  const logger = require('../config/logger');
  logger.debug(`canUserApprove kontrolü - Flow ID: ${this._id}, User ID: ${userId}, Flow Type: ${this.flowType}`);
  
  // Belge zaten onaylanmış veya reddedilmiş mi kontrol et
  if (this.status === ApprovalStatus.APPROVED || this.status === ApprovalStatus.REJECTED) {
    logger.debug(`Flow ${this._id} - Akış zaten ${this.status} durumunda, onaylanamaz`);
    return false;
  }
  
  // Kullanıcı ID kontrolü
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    logger.debug(`Flow ${this._id} - Geçersiz kullanıcı ID: ${userId}`);
    return false;
  }
  
  // Kullanıcı ID'sini string'e çevir
  const userIdStr = userId.toString();
  
  // Kullanıcı daha önce onaylamış mı kontrol et
  const hasAlreadyApproved = this.history && this.history.length > 0 && this.history.some(
    entry => entry.userId.toString() === userIdStr && entry.action === 'approve'
  );
  
  if (hasAlreadyApproved) {
    logger.debug(`Flow ${this._id} - Kullanıcı ${userId} bu akışı daha önce onaylamış`);
    return false;
  }
  
  // Akış türüne göre kontrol
  switch (this.flowType) {
    case 'quick':
      // Hızlı onayda herhangi bir adımda onaylayabilir
      // İlk onay geldiğinde tüm akış tamamlanır
      const canQuickApprove = this.steps && this.steps.length > 0 && this.steps.some(step => {
        if (!step.userId) return false;
        
        let stepUserId;
        if (typeof step.userId === 'object') {
          stepUserId = step.userId._id ? step.userId._id.toString() : null;
        } else {
          stepUserId = step.userId.toString();
        }
        
        return stepUserId === userIdStr && 
          (step.status === ApprovalStatus.PENDING || step.status === ApprovalStatus.WAITING);
      });
      
      logger.debug(`Flow ${this._id} - Hızlı onay kontrolü: ${canQuickApprove}`);
      return canQuickApprove;
      
    case 'standard':
    case 'sequential':
    default:
      // Sıralı onayda sadece mevcut adımın onaylayıcısı onaylayabilir
      const currentStep = this.getCurrentStep();
      
      // Mevcut adım bilgileri
      logger.debug(`Flow ${this._id} - Sıralı onay, mevcut adım: ${currentStep ? currentStep.order : 'Bulunamadı'}`);
      
      // Mevcut adım yoksa veya status PENDING değilse onaylayamaz
      if (!currentStep) {
        logger.debug(`Flow ${this._id} - Mevcut adım bulunamadı`);
        return false;
      }
      
      if (currentStep.status !== ApprovalStatus.PENDING) {
        logger.debug(`Flow ${this._id} - Adım durumu onay beklemede değil: ${currentStep.status}`);
        return false;
      }
      
      // Kullanıcı mevcut adımın onaylayıcısı mı?
      // Bu kısım düzeltildi - Güvenli ve tutarlı ID karşılaştırması yapılıyor
      let currentUserId;
      
      if (typeof currentStep.userId === 'object') {
        // Populate edilmiş kullanıcı objesi
        if (currentStep.userId._id) {
          currentUserId = currentStep.userId._id.toString();
        } else if (currentStep.userId.id) {
          currentUserId = currentStep.userId.id.toString();
        } else {
          currentUserId = currentStep.userId.toString();
        }
      } else {
        // ObjectId
        currentUserId = currentStep.userId.toString();
      }
      
      const isCurrentApprover = currentUserId === userIdStr;
      
      logger.debug(`Flow ${this._id} - Mevcut adım onaylayıcısı ID: ${currentUserId}`);
      logger.debug(`Flow ${this._id} - İstek yapan kullanıcı ID: ${userIdStr}`);
      logger.debug(`Flow ${this._id} - ID eşleşmesi: ${isCurrentApprover}`);
      
      return isCurrentApprover;
  }
};

// Kullanıcının belirli bir adımda onaylayıcı olup olmadığını kontrol et
ApprovalFlowSchema.methods.isUserApproverInStep = function(userId, stepOrder) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return false;
  }
  
  const step = this.steps.find(s => s.order === stepOrder);
  return step && step.userId.toString() === userId.toString();
};

// Kullanıcının daha önce onaylayıp onaylamadığını kontrol et
ApprovalFlowSchema.methods.hasUserApproved = function(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return false;
  }
  
  return this.history.some(
    entry => entry.userId.toString() === userId.toString() && entry.action === 'approve'
  );
};

const ApprovalFlow = mongoose.model('ApprovalFlow', ApprovalFlowSchema);

module.exports = ApprovalFlow;
