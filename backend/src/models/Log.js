const mongoose = require('mongoose');

// Log şeması
const logSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Bazı sistem logları için kullanıcı olmayabilir
  },
  action: {
    type: String,
    required: [true, 'İşlem alanı zorunludur'],
    trim: true
  },
  entityType: {
    type: String,
    enum: ['user', 'document', 'approvalFlow', 'system'],
    required: [true, 'Varlık tipi alanı zorunludur']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false // Sistem logları için varlık olmayabilir
  },
  description: {
    type: String,
    required: [true, 'Açıklama alanı zorunludur'],
    trim: true
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // Ek bilgiler için esnek alan
    default: {}
  },
  level: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info'
  }
}, {
  timestamps: true
});

// Kullanıcı bilgilerini doldur
logSchema.pre('find', function(next) {
  this.populate({
    path: 'userId',
    select: 'firstName lastName email'
  });
  next();
});

logSchema.pre('findOne', function(next) {
  this.populate({
    path: 'userId',
    select: 'firstName lastName email'
  });
  next();
});

// Statik metod: Kullanıcı işlemi logla
logSchema.statics.logUserAction = async function(userId, action, description, metadata = {}, ipAddress = null, userAgent = null) {
  return this.create({
    userId,
    action,
    entityType: 'user',
    entityId: userId,
    description,
    ipAddress,
    userAgent,
    metadata,
    level: 'info'
  });
};

// Statik metod: Evrak işlemi logla
logSchema.statics.logDocumentAction = async function(userId, action, description, metadata = {}, ipAddress = null, userAgent = null) {
  try {
    // Gelen parametreleri logla
    console.log('logDocumentAction çağrıldı:', {
      userId,
      action,
      description,
      metadata: JSON.stringify(metadata).substring(0, 100) // Çok uzun olmaması için kısalt
    });
    
    let entityId = null;
    let entityType = 'document'; // Varsayılan olarak document
    let safeDescription = '';
    
    // Metadata'dan documentId'yi al
    if (metadata && metadata.documentId) {
      entityId = metadata.documentId;
    }
    
    // Onay işlemleri için entityType'ı belirle
    if (action === 'submit_for_approval' || 
        action === 'approve' || 
        action === 'reject' || 
        action.includes('approval')) {
      entityType = 'approvalFlow';
    }
    
    // Description null veya undefined ise güvenli bir şekilde dönüştür
    if (description === null || description === undefined) {
      safeDescription = 'Açıklama yok';
    } else {
      try {
        safeDescription = String(description);
      } catch (error) {
        console.error('Description dönüştürme hatası:', error);
        safeDescription = 'Geçersiz açıklama';
      }
    }
    
    // Log seviyesini belirle
    let level = 'info';
    if (action.includes('error') || action === 'reject') {
      level = 'error';
    } else if (action.includes('warning')) {
      level = 'warning';
    }
    
    console.log('Log oluşturuluyor:', {
      userId,
      action,
      entityType,
      entityId,
      description: safeDescription,
      level
    });
    
    // Log kaydını oluştur
    return this.create({
      userId,
      action,
      entityType,
      entityId,
      description: safeDescription,
      ipAddress,
      userAgent,
      metadata,
      level
    });
  } catch (error) {
    console.error('Log oluşturma hatası:', error);
    // Loglama hatası uygulamayı çökertmesin
    return null;
  }
};

// Statik metod: Sistem işlemi logla
logSchema.statics.logSystemAction = async function(action, description, metadata = {}, level = 'info') {
  return this.create({
    action,
    entityType: 'system',
    description,
    metadata,
    level
  });
};

const Log = mongoose.model('Log', logSchema);

module.exports = Log;
