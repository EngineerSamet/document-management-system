const mongoose = require('mongoose');

/**
 * Yorum modeli
 * Belgeler üzerinde yapılan yorumları ve tartışmaları saklar
 */
const commentSchema = new mongoose.Schema({
  // Hangi belgeye ait
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: [true, 'Belge ID alanı zorunludur'],
    index: true
  },
  
  // Kim tarafından oluşturuldu
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Oluşturan kullanıcı alanı zorunludur'],
    index: true
  },
  
  // Yorum içeriği
  content: {
    type: String,
    required: [true, 'Yorum içeriği zorunludur'],
    trim: true,
    minlength: [1, 'Yorum en az 1 karakter olmalıdır'],
    maxlength: [2000, 'Yorum en fazla 2000 karakter olabilir']
  },
  
  // Üst yorum (iç içe yorumlar için)
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null,
    index: true
  },
  
  // Yorum onay işlemiyle ilişkili mi?
  isApprovalComment: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Yorum onay adımı
  approvalStep: {
    type: Number,
    default: null
  },
  
  // Belgenin belirli bir bölümüne yorum
  documentSection: {
    type: String,
    default: null
  },
  
  // Yorum tipi
  type: {
    type: String,
    enum: ['comment', 'question', 'suggestion', 'approval', 'rejection'],
    default: 'comment',
    index: true
  },
  
  // Yorumda bahsedilen kullanıcılar
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Yorum resmi mi? (onay sürecinin parçası olan yorumlar)
  isOfficial: {
    type: Boolean,
    default: false
  },
  
  // Çözüldü mü? (soru/öneri yorumları için)
  isResolved: {
    type: Boolean,
    default: false
  },
  
  // Düzenlendi mi?
  isEdited: {
    type: Boolean,
    default: false
  },
  
  // Son düzenleme tarihi
  editedAt: {
    type: Date,
    default: null
  },
  
  // Yorum ayarları
  settings: {
    isPrivate: {
      type: Boolean,
      default: false
    },
    allowReplies: {
      type: Boolean,
      default: true
    }
  },
  
  // Ek veriler
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tam metin araması için indeks
commentSchema.index({ content: 'text' });

// Sorgu performansı için bileşik indeksler
commentSchema.index({ documentId: 1, createdAt: -1 });
commentSchema.index({ documentId: 1, isApprovalComment: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1, createdAt: 1 });

// Alt yorumlar için sanal alan
commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment',
  options: { sort: { createdAt: 1 } }
});

// Sorgu sonuçları için ilişkili alanları doldur
commentSchema.pre('find', function(next) {
  this.populate([
    { path: 'createdBy', select: 'firstName lastName email profileImage' },
    { path: 'mentions', select: 'firstName lastName email' }
  ]);
  next();
});

commentSchema.pre('findOne', function(next) {
  this.populate([
    { path: 'createdBy', select: 'firstName lastName email profileImage' },
    { path: 'mentions', select: 'firstName lastName email' }
  ]);
  next();
});

// Alt yorumlarla birlikte yorumu getiren yardımcı metod
commentSchema.statics.findWithReplies = async function(commentId) {
  return this.findById(commentId)
    .populate('createdBy', 'firstName lastName email profileImage')
    .populate('mentions', 'firstName lastName email')
    .populate({
      path: 'replies',
      populate: [
        { path: 'createdBy', select: 'firstName lastName email profileImage' },
        { path: 'mentions', select: 'firstName lastName email' }
      ]
    });
};

// Belirli bir belgeye ait tüm yorumları getiren yardımcı metod
commentSchema.statics.findByDocument = async function(documentId, options = {}) {
  const query = { 
    documentId,
    parentComment: null // Sadece ana yorumları getir
  };
  
  // Filtreler ekle
  if (options.isApprovalComment !== undefined) {
    query.isApprovalComment = options.isApprovalComment;
  }
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query)
    .sort({ createdAt: options.sortDirection || -1 })
    .populate('createdBy', 'firstName lastName email profileImage')
    .populate('mentions', 'firstName lastName email')
    .populate({
      path: 'replies',
      options: { sort: { createdAt: 1 } },
      populate: [
        { path: 'createdBy', select: 'firstName lastName email profileImage' },
        { path: 'mentions', select: 'firstName lastName email' }
      ]
    });
};

// Yorumu düzenle
commentSchema.methods.edit = function(newContent) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

// Yorumu çözüldü olarak işaretle
commentSchema.methods.markAsResolved = function() {
  this.isResolved = true;
  return this.save();
};

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment; 