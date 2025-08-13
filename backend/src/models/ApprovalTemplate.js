const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Onay Akışı Şablonu Şeması
 * Belge onay süreçleri için yeniden kullanılabilir şablonlar
 */
const ApprovalTemplateSchema = new Schema({
  // Şablon adı
  name: {
    type: String,
    required: [true, 'Şablon adı zorunludur'],
    trim: true,
    minlength: [3, 'Şablon adı en az 3 karakter olmalıdır'],
    maxlength: [100, 'Şablon adı en fazla 100 karakter olabilir']
  },
  
  // Şablon açıklaması
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Şablon açıklaması en fazla 500 karakter olabilir']
  },
  
  // Onaylayıcılar
  approvers: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'En az bir onaylayıcı belirtmelisiniz']
  }],
  
  // Akış türü: sequential (sıralı)
  flowType: {
    type: String,
    enum: {
      values: ['sequential'],
      message: 'Geçersiz onay akışı türü. Geçerli değerler: sequential'
    },
    default: 'sequential'
  },
  
  // Oluşturan kullanıcı
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Departman (opsiyonel, departmana özel şablonlar için)
  department: {
    type: String,
    trim: true
  },
  
  // Aktif mi?
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Şablonun kullanım sayısını getiren sanal alan
ApprovalTemplateSchema.virtual('usageCount').get(function() {
  return this._usageCount || 0;
});

// Şablonun kullanım sayısını ayarlayan metod
ApprovalTemplateSchema.methods.setUsageCount = function(count) {
  this._usageCount = count;
  return this;
};

// Şablonu JSON'a dönüştürürken sanal alanları dahil et
ApprovalTemplateSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    return ret;
  }
});

// Şablonu objeye dönüştürürken sanal alanları dahil et
ApprovalTemplateSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    return ret;
  }
});

module.exports = mongoose.model('ApprovalTemplate', ApprovalTemplateSchema); 