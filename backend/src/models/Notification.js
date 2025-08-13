const mongoose = require('mongoose');

/**
 * Notification model
 * Kullanıcılara gönderilen bildirimleri saklar
 */
const notificationSchema = new mongoose.Schema({
  // Kime gönderildi
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Alıcı kullanıcı alanı zorunludur'],
    index: true
  },
  
  // Bildirim türü
  type: {
    type: String,
    enum: [
      'document_created',
      'document_updated', 
      'document_approval_requested',
      'document_approved',
      'document_rejected',
      'document_commented',
      'approval_step_changed',
      'approval_reminder',
      'document_shared',
      'mention',
      'system'
    ],
    required: [true, 'Bildirim türü zorunludur'],
    index: true
  },
  
  // Bildirim başlığı
  title: {
    type: String,
    required: [true, 'Bildirim başlığı zorunludur'],
    trim: true
  },
  
  // Bildirim içeriği
  message: {
    type: String,
    required: [true, 'Bildirim mesajı zorunludur'],
    trim: true
  },
  
  // İlgili varlık referansları
  references: {
    // İlgili belge
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      index: true
    },
    
    // İlgili kullanıcı (bildirimi tetikleyen)
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // İlgili onay akışı
    approvalFlowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalFlow'
    }
  },
  
  // Bildirim durumu
  status: {
    type: String,
    enum: ['unread', 'read', 'archived'],
    default: 'unread',
    index: true
  },
  
  // Öncelik seviyesi
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Bildirim kanalları
  channels: {
    inApp: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: false
    }
  },
  
  // E-posta gönderildi mi?
  emailSent: {
    type: Boolean,
    default: false
  },
  
  // Bildirim gönderim tarihini ayarlayabilmek için (gelecek tarihli bildirimler)
  scheduledFor: {
    type: Date,
    default: Date.now
  },
  
  // Bildirim içeriğini zenginleştirebilecek ek veriler
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Okundu tarihi
  readAt: {
    type: Date,
    default: null
  },
  
  // Bildirim için eylem URL'i
  actionUrl: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Sorgu performansı için bileşik indeksler
notificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
notificationSchema.index({ 'references.documentId': 1, type: 1 });

// Sorgu sonuçları için populate
notificationSchema.pre('find', function(next) {
  this.populate([
    { path: 'recipient', select: 'firstName lastName email' },
    { path: 'references.actorId', select: 'firstName lastName' },
    { path: 'references.documentId', select: 'title documentNumber' }
  ]);
  next();
});

notificationSchema.pre('findOne', function(next) {
  this.populate([
    { path: 'recipient', select: 'firstName lastName email' },
    { path: 'references.actorId', select: 'firstName lastName' },
    { path: 'references.documentId', select: 'title documentNumber' }
  ]);
  next();
});

// Bildirim oluşturma yardımcı fonksiyonları
notificationSchema.statics.createDocumentApprovalNotification = async function(document, recipient, actor) {
  return await this.create({
    recipient: recipient._id,
    type: 'document_approval_requested',
    title: 'Onay Bekleyen Belge',
    message: `"${document.title}" belgesi onayınızı bekliyor.`,
    references: {
      documentId: document._id,
      actorId: actor._id
    },
    actionUrl: `/documents/${document._id}/review`
  });
};

notificationSchema.statics.createDocumentStatusNotification = async function(document, recipient, status, actor) {
  const statusMessages = {
    approved: 'onaylandı',
    rejected: 'reddedildi',
    commented: 'hakkında yorum yapıldı'
  };
  
  const statusTypes = {
    approved: 'document_approved',
    rejected: 'document_rejected',
    commented: 'document_commented'
  };
  
  return await this.create({
    recipient: recipient._id,
    type: statusTypes[status],
    title: `Belge ${statusMessages[status]}`,
    message: `"${document.title}" belgesi ${actor.fullName} tarafından ${statusMessages[status]}.`,
    references: {
      documentId: document._id,
      actorId: actor._id
    },
    actionUrl: `/documents/${document._id}`
  });
};

// Okundu olarak işaretle
notificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

// Arşivle
notificationSchema.methods.archive = function() {
  this.status = 'archived';
  return this.save();
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 