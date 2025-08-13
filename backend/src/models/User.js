const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../middleware/role.middleware');

// Rol değerlerini tanımla - Hem büyük hem küçük harfli değerleri kabul edecek şekilde
const USER_ROLES = {
  ADMIN: 'ADMIN',     // Sistem yöneticisi, tüm yetkilere sahip
  MANAGER: 'MANAGER', // Müdür/onaylayıcı, kendi departmanındaki belgeleri onaylayabilir
  OFFICER: 'OFFICER', // Uzman/belge oluşturucu, evrak oluşturabilir ve onaya gönderebilir
  OBSERVER: 'OBSERVER', // Sadece izleyici, belgeleri görüntüleyebilir ama işlem yapamaz
};

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Ad alanı zorunludur'],
    trim: true,
    minlength: [2, 'Ad en az 2 karakter olmalıdır'],
    maxlength: [50, 'Ad en fazla 50 karakter olabilir']
  },
  lastName: {
    type: String,
    required: [true, 'Soyad alanı zorunludur'],
    trim: true,
    minlength: [2, 'Soyad en az 2 karakter olmalıdır'],
    maxlength: [50, 'Soyad en fazla 50 karakter olabilir']
  },
  email: {
    type: String,
    required: [true, 'E-posta alanı zorunludur'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
      'Lütfen geçerli bir e-posta adresi giriniz'
    ]
  },
  password: {
    type: String,
    required: [true, 'Şifre alanı zorunludur'],
    minlength: [6, 'Şifre en az 6 karakter olmalıdır'],
    select: false // Varsayılan olarak sorgu sonuçlarında gösterme
  },
  role: {
    type: String,
    enum: [...Object.values(USER_ROLES), 'admin', 'manager', 'officer', 'observer'],
    default: USER_ROLES.OFFICER,
    uppercase: true
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: false // Geriye dönük uyumluluk için role stringi kullanılabilir
  },
  department: {
    type: String,
    required: false, // Opsiyonel alan olarak değiştirildi
    trim: true
  },
  position: {
    type: String,
    required: false, // Opsiyonel alan olarak değiştirildi
    trim: true
  },
  isActive: {
    type: Boolean,
    default: false // Varsayılan olarak pasif, doğrulama sonrası aktifleşecek
  },
  isVerified: {
    type: Boolean,
    default: false // Varsayılan olarak doğrulanmamış, e-posta doğrulama sonrası true olacak
  },
  verificationToken: String,
  verificationExpire: Date,
  lastLogin: {
    type: Date,
    default: null
  },
  profileImage: {
    type: String,
    default: null
  },
  contactInfo: {
    phone: {
      type: String,
      trim: true,
      default: null
    },
    address: {
      type: String,
      trim: true,
      default: null
    }
  },
  preferences: {
    language: {
      type: String,
      enum: ['tr', 'en'],
      default: 'tr'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      inApp: {
        type: Boolean,
        default: true
      }
    }
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Şifre değiştiğinde hash'le
userSchema.pre('save', async function(next) {
  // Şifre değişmediyse devam et
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // Şifreyi hash'le
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Sorgu sonuçları için roleId alanını doldur
userSchema.pre('find', function(next) {
  this.populate('roleId');
  next();
});

userSchema.pre('findOne', function(next) {
  this.populate('roleId');
  next();
});

// Şifre doğrulama metodu
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    // Şifreyi karşılaştır
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    
    // Test ortamında ve example.com uzantılı e-posta ise debug log'u ekle
    const isTestEnvironment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    const isTestEmail = this.email && this.email.endsWith('@example.com');
    
    if (isTestEnvironment && isTestEmail) {
      console.log(`Şifre karşılaştırma (${this.email}):`, {
        candidatePassword,
        passwordHash: this.password,
        isMatch
      });
    }
    
    return isMatch;
  } catch (error) {
    console.error('Şifre karşılaştırma hatası:', error);
    return false;
  }
};

// Tam ad virtual property
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Yetki kontrolü metodu
userSchema.methods.hasPermission = function(resource, action) {
  // roleId alanı doluysa, role objesinden izinleri kontrol et
  if (this.roleId && this.roleId.permissions && this.roleId.permissions[resource]) {
    return !!this.roleId.permissions[resource][action];
  }
  
  // Eski rol sistemi için geriye dönük uyumluluk
  // Bu bölüm, rol veritabanı güncellenince kaldırılabilir
  if (this.role === USER_ROLES.ADMIN) {
    return true; // Admin her şeyi yapabilir
  } else if (this.role === USER_ROLES.MANAGER) {
    // Manager'ın yetkileri
    if (resource === 'documents') {
      return ['create', 'read', 'update', 'delete', 'approve', 'reject', 'readAll'].includes(action);
    }
  } else if (this.role === USER_ROLES.OFFICER) {
    // Officer'ın yetkileri
    if (resource === 'documents') {
      return ['create', 'read', 'update', 'delete'].includes(action);
    }
  } else if (this.role === USER_ROLES.OBSERVER) {
    // Observer'ın yetkileri - sadece okuma
    if (resource === 'documents') {
      return ['read'].includes(action);
    }
  }
  
  return false;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
