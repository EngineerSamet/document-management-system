const mongoose = require('mongoose');

/**
 * Aktivite modeli
 * Sistemdeki tüm önemli etkileşimleri ve olayları kaydeder
 */
const activitySchema = new mongoose.Schema({
  // Aktivite türü
  activityType: {
    type: String,
    enum: [
      // Belge aktiviteleri
      'document_created',
      'document_updated',
      'document_deleted',
      'document_viewed',
      'document_submitted',
      'document_approved',
      'document_rejected',
      'document_commented',
      'document_shared',
      'document_versioned',
      'document_reverted',
      
      // Onay akışı aktiviteleri
      'approval_flow_created',
      'approval_flow_updated',
      'approval_flow_deleted',
      'approval_step_changed',
      'approval_reassigned',
      
      // Kullanıcı aktiviteleri
      'user_created',
      'user_updated',
      'user_deleted',
      'user_login',
      'user_logout',
      'user_password_changed',
      'user_role_changed',
      
      // Sistem aktiviteleri
      'system_setting_changed',
      'system_backup',
      'system_error'
    ],
    required: [true, 'Aktivite türü zorunludur'],
    index: true
  },
  
  // Aktiviteyi gerçekleştiren kullanıcı
  // Bu aktiviteyi hangi kullanıcı yaptı?
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      // Sistem aktiviteleri için kullanıcı zorunlu değil
      return !this.activityType.startsWith('system_');
    },
    index: true
  },
  
  //Aktivitenin hangi nesneye (belge, kullanıcı, sistem ayarı) ait olduğunu belirtiyor.
  entityType: {
    type: String,
    enum: ['document', 'approval_flow', 'user', 'comment', 'system'],
    required: [true, 'Varlık türü zorunludur'],
    index: true
  },
  
  // Aktivitenin ilgili olduğu varlık ID'si
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function() {
      // Sistem aktiviteleri için varlık ID'si zorunlu değil
      return this.entityType !== 'system';
    },
    index: true
  },
  
  // Departman bilgisi
  department: {
    type: String,
    index: true
  },
  
  // İkincil varlık referansları
  relatedEntities: [{
    entityType: {
      type: String,
      enum: ['document', 'approval_flow', 'user', 'comment']
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId
    }
  }],
  
  // Aktivite açıklaması
  description: {
    type: String,
    required: [true, 'Aktivite açıklaması zorunludur']
  },
  
  // Aktivite önceki değerler
  previousValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Aktivite yeni değerler
  newValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Aktivitenin gerçekleştiği IP adresi
  ipAddress: {
    type: String
  },
  
  // Kullanıcı aracısı bilgisi (tarayıcı, cihaz vs.)
  userAgent: {
    type: String
  },
  
  // Ek veri
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Zaman bazlı sorgular için indeks
activitySchema.index({ createdAt: -1 });

// Komplex sorgular için bileşik indeksler
activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activitySchema.index({ activityType: 1, createdAt: -1 });
activitySchema.index({ performedBy: 1, createdAt: -1 });
activitySchema.index({ department: 1, activityType: 1, createdAt: -1 });

// Sorgu sonuçları için ilişkili alanları doldur
activitySchema.pre('find', function(next) {
  this.populate('performedBy', 'firstName lastName email department');
  next();
});

activitySchema.pre('findOne', function(next) {
  this.populate('performedBy', 'firstName lastName email department');
  next();
});

// Belirli bir varlığın aktivitelerini getiren yardımcı metod
activitySchema.statics.getEntityActivities = async function(entityType, entityId, options = {}) {
  const query = { 
    entityType, 
    entityId 
  };
  
  // Aktivite türü filtresi
  if (options.activityType) {
    query.activityType = options.activityType;
  }
  
  // Kullanıcı filtresi
  if (options.performedBy) {
    query.performedBy = options.performedBy;
  }
  
  // Departman filtresi
  if (options.department) {
    query.department = options.department;
  }
  
  // Tarih aralığı filtresi
  if (options.startDate || options.endDate) {
    query.createdAt = {};
    
    if (options.startDate) {
      query.createdAt.$gte = new Date(options.startDate);
    }
    
    if (options.endDate) {
      query.createdAt.$lte = new Date(options.endDate);
    }
  }
  
  return this.find(query)
    .sort({ createdAt: options.sortDirection || -1 })
    .limit(options.limit || 100)
    .skip(options.skip || 0)
    .populate('performedBy', 'firstName lastName email department');
};

//logDocumentActivity()	Belgeyle ilgili olayları kayıt eder
//logApprovalActivity()	Onay akışı ile ilgili olayları kayıt eder
//logUserActivity()	Kullanıcıyla ilgili olayları kayıt eder
//logSystemActivity()	Sistem olaylarını kayıt eder

// Belge aktivitesi oluşturma yardımcı metodu
activitySchema.statics.logDocumentActivity = async function(activityType, document, user, description, prevValues = null, newValues = null, metadata = {}) {
  const activityData = {
    activityType,
    performedBy: user._id,
    entityType: 'document',
    entityId: document._id,
    department: user.department,
    description,
    previousValues: prevValues,
    newValues: newValues,
    metadata
  };
  
  // IP ve UserAgent bilgisi varsa ekle
  if (metadata.ipAddress) {
    activityData.ipAddress = metadata.ipAddress;
    delete metadata.ipAddress;
  }
  
  if (metadata.userAgent) {
    activityData.userAgent = metadata.userAgent;
    delete metadata.userAgent;
  }
  
  return this.create(activityData);
};

// Onay akışı aktivitesi oluşturma yardımcı metodu
activitySchema.statics.logApprovalActivity = async function(activityType, approvalFlow, document, user, description, prevValues = null, newValues = null, metadata = {}) {
  const activityData = {
    activityType,
    performedBy: user._id,
    entityType: 'approval_flow',
    entityId: approvalFlow._id,
    department: user.department,
    description,
    previousValues: prevValues,
    newValues: newValues,
    metadata
  };
  
  // Belge bilgisini ilişkili varlıklar olarak ekle
  if (document) {
    activityData.relatedEntities = [{
      entityType: 'document',
      entityId: document._id
    }];
  }
  
  // IP ve UserAgent bilgisi varsa ekle
  if (metadata.ipAddress) {
    activityData.ipAddress = metadata.ipAddress;
    delete metadata.ipAddress;
  }
  
  if (metadata.userAgent) {
    activityData.userAgent = metadata.userAgent;
    delete metadata.userAgent;
  }
  
  return this.create(activityData);
};

// Kullanıcı aktivitesi oluşturma yardımcı metodu
activitySchema.statics.logUserActivity = async function(activityType, targetUser, performedByUser, description, prevValues = null, newValues = null, metadata = {}) {
  const activityData = {
    activityType,
    performedBy: performedByUser ? performedByUser._id : undefined,
    entityType: 'user',
    entityId: targetUser._id,
    department: performedByUser ? performedByUser.department : targetUser.department,
    description,
    previousValues: prevValues,
    newValues: newValues,
    metadata
  };
  
  // IP ve UserAgent bilgisi varsa ekle
  if (metadata.ipAddress) {
    activityData.ipAddress = metadata.ipAddress;
    delete metadata.ipAddress;
  }
  
  if (metadata.userAgent) {
    activityData.userAgent = metadata.userAgent;
    delete metadata.userAgent;
  }
  
  return this.create(activityData);
};

// Sistem aktivitesi oluşturma yardımcı metodu
activitySchema.statics.logSystemActivity = async function(activityType, description, metadata = {}) {
  return this.create({
    activityType,
    entityType: 'system',
    description,
    metadata
  });
};

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity; 