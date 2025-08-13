const mongoose = require('mongoose');

/**
 * Sistem ayarları modeli
 * Uygulama genelinde yapılandırma ayarlarını saklar
 */
const settingSchema = new mongoose.Schema({
  // Ayarın kategorisi
  category: {
    type: String,
    enum: ['general', 'document', 'approval', 'notification', 'security', 'appearance', 'integration'],
    required: [true, 'Ayar kategorisi zorunludur'],
    index: true
  },
  
  // Ayar anahtarı
  key: {
    type: String,
    required: [true, 'Ayar anahtarı zorunludur'],
    trim: true,
    index: true
  },
  
  // Ayar değeri (herhangi bir veri tipi olabilir)
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Ayar değeri zorunludur']
  },
  
  // Ayar açıklaması
  description: {
    type: String,
    trim: true
  },
  
  // Ayar veri tipi (doğrulama ve form oluşturma için)
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'array', 'object', 'date'],
    required: [true, 'Veri tipi zorunludur']
  },
  
  // Ayarın sistem tarafından mı yoksa kullanıcı tarafından mı tanımlandığı
  isSystem: {
    type: Boolean,
    default: false
  },
  
  // Ayarın düzenleme sınırlaması
  isEditable: {
    type: Boolean,
    default: true
  },
  
  // Ayarın görünürlüğü (admin panelde görünsün mü?)
  isVisible: {
    type: Boolean,
    default: true
  },
  
  // Form için doğrulama kuralları
  validation: {
    required: {
      type: Boolean,
      default: false
    },
    min: Number,
    max: Number,
    minLength: Number,
    maxLength: Number,
    pattern: String,
    options: [mongoose.Schema.Types.Mixed]
  },
  
  // Son güncelleyen kullanıcı
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Benzersiz kategori+anahtar kombinasyonu için bileşik indeks
settingSchema.index({ category: 1, key: 1 }, { unique: true });

// Sorgu sonuçları için ilişkili alanları doldur
settingSchema.pre('find', function(next) {
  this.populate('updatedBy', 'firstName lastName email');
  next();
});

settingSchema.pre('findOne', function(next) {
  this.populate('updatedBy', 'firstName lastName email');
  next();
});

// Değeri tipine göre dönüştür
settingSchema.methods.getValueAsType = function() {
  const value = this.value;
  
  switch (this.dataType) {
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'date':
      return new Date(value);
    case 'array':
    case 'object':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      }
      return value;
    default:
      return value;
  }
};

// Kategori bazlı ayarları getir
settingSchema.statics.getByCategory = async function(category) {
  const settings = await this.find({ category });
  
  // Anahtar-değer formatında döndür
  return settings.reduce((acc, setting) => {
    acc[setting.key] = setting.getValueAsType();
    return acc;
  }, {});
};

// Anahtar ile ayar getir
settingSchema.statics.getByKey = async function(key, category = null) {
  const query = { key };
  
  if (category) {
    query.category = category;
  }
  
  const setting = await this.findOne(query);
  return setting ? setting.getValueAsType() : null;
};

// Ayar değerini güncelle
settingSchema.statics.updateSetting = async function(category, key, value, userId) {
  const setting = await this.findOne({ category, key });
  
  if (!setting) {
    throw new Error(`'${category}.${key}' ayarı bulunamadı`);
  }
  
  if (!setting.isEditable) {
    throw new Error(`'${category}.${key}' ayarı düzenlenemez`);
  }
  
  setting.value = value;
  setting.updatedBy = userId;
  
  return setting.save();
};

// Varsayılan ayarları oluştur
settingSchema.statics.createDefaultSettings = async function() {
  const defaults = [
    // Genel ayarlar
    {
      category: 'general',
      key: 'applicationName',
      value: 'Belge Onay Sistemi',
      description: 'Uygulama adı',
      dataType: 'string',
      isSystem: true
    },
    {
      category: 'general',
      key: 'companyName',
      value: 'Şirket Adı',
      description: 'Şirket adı',
      dataType: 'string'
    },
    {
      category: 'general',
      key: 'logoUrl',
      value: '/assets/logo.png',
      description: 'Logo URL',
      dataType: 'string'
    },
    {
      category: 'general',
      key: 'language',
      value: 'tr',
      description: 'Varsayılan dil',
      dataType: 'string',
      validation: {
        options: ['tr', 'en']
      }
    },
    
    // Belge ayarları
    {
      category: 'document',
      key: 'documentTypes',
      value: ['Resmi Yazı', 'Sözleşme', 'Rapor', 'Dilekçe', 'Diğer'],
      description: 'Belge tipleri',
      dataType: 'array'
    },
    {
      category: 'document',
      key: 'autoNumbering',
      value: true,
      description: 'Otomatik belge numaralandırma',
      dataType: 'boolean'
    },
    {
      category: 'document',
      key: 'maxFileSize',
      value: 10,
      description: 'Maksimum dosya boyutu (MB)',
      dataType: 'number',
      validation: {
        min: 1,
        max: 100
      }
    },
    {
      category: 'document',
      key: 'allowedFileTypes',
      value: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png'],
      description: 'İzin verilen dosya türleri',
      dataType: 'array'
    },
    
    // Onay ayarları
    {
      category: 'approval',
      key: 'defaultTimeLimit',
      value: 3,
      description: 'Varsayılan onay süresi (gün)',
      dataType: 'number'
    },
    {
      category: 'approval',
      key: 'allowReassignment',
      value: true,
      description: 'Onay yeniden atamaya izin ver',
      dataType: 'boolean'
    },
    {
      category: 'approval',
      key: 'requireCommentOnReject',
      value: true,
      description: 'Reddetme durumunda yorum zorunluluğu',
      dataType: 'boolean'
    },
    
    // Bildirim ayarları
    {
      category: 'notification',
      key: 'emailNotifications',
      value: true,
      description: 'E-posta bildirimleri',
      dataType: 'boolean'
    },
    {
      category: 'notification',
      key: 'reminderFrequency',
      value: 24,
      description: 'Hatırlatma sıklığı (saat)',
      dataType: 'number'
    },
    
    // Güvenlik ayarları
    {
      category: 'security',
      key: 'sessionTimeout',
      value: 60,
      description: 'Oturum zaman aşımı (dakika)',
      dataType: 'number'
    },
    {
      category: 'security',
      key: 'passwordPolicy',
      value: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
      },
      description: 'Şifre politikası',
      dataType: 'object'
    }
  ];
  
  for (const setting of defaults) {
    await this.findOneAndUpdate(
      { category: setting.category, key: setting.key },
      setting,
      { upsert: true, new: true }
    );
  }
};

const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting; 