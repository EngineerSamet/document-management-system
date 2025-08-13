const mongoose = require('mongoose');
const { DocumentStatus, DocumentType } = require('../interfaces/IDocument');

// Onay geçmişi alt şeması
const approvalHistorySchema = new mongoose.Schema({
// Belge onay geçmişini takip eder
// Hangi kullanıcının ne işlem yaptığını (onay, red, yorum), ne zaman yaptığını ve hangi adımda olduğunu kaydeder
// Onay akışındaki adım sırasını ve akış tipini tutar
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Kullanıcı ID alanı zorunludur']
  },
  action: {
    type: String,
    enum: ['approved', 'rejected', 'commented'],
    required: [true, 'İşlem alanı zorunludur']
  },
  comment: {
    type: String,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  stepOrder: {
    type: Number,
    default: 0
  },
  flowType: {
    type: String,
    default: 'standard'
  }
}, {
  _id: true
});

// Dosya eki alt şeması
const attachmentSchema = new mongoose.Schema({
  //Belgeye eklenen dosyaları yönetir
  //Dosya adı, yolu, türü, boyutu gibi temel bilgileri saklar
  //Dosyayı kimin, ne zaman yüklediğini kaydeder
  filename: {
    type: String,
    required: [true, 'Dosya adı zorunludur'],
    trim: true
  },
  originalName: {
    type: String,
    required: [true, 'Orijinal dosya adı zorunludur'],
    trim: true
  },
  path: {
    type: String,
    required: [true, 'Dosya yolu zorunludur'],
    trim: true
  },
  mimetype: {
    type: String,
    required: [true, 'MIME tipi zorunludur'],
    trim: true
  },
  size: {
    type: Number,
    required: [true, 'Dosya boyutu zorunludur']
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Yükleyen kullanıcı ID alanı zorunludur']
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true
});

// Versiyon alt şeması
const versionSchema = new mongoose.Schema({
  //Belge versiyonlarını takip eder
  //Her versiyonun numarası, başlığı, içeriği ve kim tarafından güncellendiği bilgilerini tutar
  //Versiyon değişikliği için açıklama ve oluşturulma tarihi kaydeder
  versionNumber: {
    type: Number,
    required: [true, 'Versiyon numarası zorunludur']
  },
  title: {
    type: String,
    required: [true, 'Başlık alanı zorunludur'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'İçerik alanı zorunludur'],
    trim: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Güncelleyen kullanıcı ID alanı zorunludur']
  },
  comment: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true
});

// Metadata alt şeması (arama ve filtreleme için)
const metadataSchema = new mongoose.Schema({
  //Belgenin arama ve filtreleme için meta verilerini tutar
  //Etiketler, kategori, öncelik, son tarih gibi alanları içerir
  //Özel alanlar ve versiyon geçmişi için esneklik sağlar
  tags: {
    type: [String],
    default: []
  },
  category: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  dueDate: {
    type: Date
  },
  targetDepartment: {
    type: String,
    trim: true
  },
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  version: {
    type: Number,
    default: 1
  },
  versionHistory: [{
    version: Number,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    comment: String
  }]
}, {
  _id: false
});

// Evrak ana şeması
//Ana Şema (documentSchema)
const documentSchema = new mongoose.Schema({
  // Belgenin tüm özelliklerini tanımlayan ana şema:
  // Temel bilgiler: başlık, açıklama, tür, belge numarası
  // Dosya bilgileri: yol, ad, boyut, tür
  // Durum bilgisi: taslak, incelemede, beklemede, onaylandı, reddedildi, arşivlendi
  // İlişkiler: oluşturan kullanıcı, departman, onaylayıcılar
  // Alt şemalar: ekler, onay geçmişi, versiyonlar
  // Onay akışı bilgileri: akış ID'si, mevcut onaylayıcı, mevcut adım
  // Meta veriler: etiketler, kategori, öncelik, vb.
  // Görüntülenme bilgileri: kim, ne zaman, kaç kez görüntüledi
  title: {
    type: String,
    required: [true, 'Belge başlığı zorunludur'],
    trim: true,
    minlength: [3, 'Başlık en az 3 karakter olmalıdır'],
    maxlength: [200, 'Başlık en fazla 200 karakter olabilir']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Açıklama en fazla 1000 karakter olabilir']
  },
  documentType: {
    type: String,
    enum: Object.values(DocumentType),
    default: DocumentType.OTHER
  },
  documentNumber: {
    type: String,
    unique: true,
    sparse: true, // Null değerlere izin ver (taslak belgeler için)
    index: true
  },
  referenceCode: {
    type: String,
    trim: true,
    index: true
  },
  filePath: {
    type: String,
    required: [true, 'Dosya yolu zorunludur']
  },
  fileName: {
    type: String,
    required: [true, 'Dosya adı zorunludur']
  },
  fileSize: {
    type: Number,
    required: [true, 'Dosya boyutu zorunludur']
  },
  mimeType: {
    type: String,
    required: [true, 'Dosya türü zorunludur']
  },
  status: {
    type: String,
    enum: ['draft', 'in_review', 'pending', 'approved', 'rejected', 'archived'],
    default: DocumentStatus.DRAFT
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Oluşturan kullanıcı zorunludur']
  },
  department: {
    type: String
  },
  approvers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  attachments: {
    type: [attachmentSchema],
    default: []
  },
  currentApprover: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  approvalHistory: {
    type: [approvalHistorySchema],
    default: []
  },
  approvalFlowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApprovalFlow',
    index: true
  },
  currentApprovalStep: {
    type: Number,
    default: 0 // 0: henüz onay sürecinde değil
  },
  versions: {
    type: [versionSchema],
    default: []
  },
  currentVersion: {
    type: Number,
    default: 1
  },
  metadata: {
    type: metadataSchema,
    default: () => ({})
  },
  expiresAt: {
    type: Date
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  viewedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastViewed: {
      type: Date,
      default: Date.now
    },
    count: {
      type: Number,
      default: 1
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tam metin arama için indeks
documentSchema.index({ title: 'text', description: 'text', fileName: 'text' });

// Tarih ve kategori bazlı arama için bileşik indeks
// kategori+tarih, durum+tarih ve son tarih+durum üzerinden hızlı sorgulamayı sağlar
documentSchema.index({ 'metadata.category': 1, createdAt: -1 });
documentSchema.index({ status: 1, createdAt: -1 });
documentSchema.index({ 'metadata.dueDate': 1, status: 1 });

// Evrak numarası oluştur (taslak durumundan çıkarken)
documentSchema.pre('save', async function(next) {
  try {
    // Versiyon yönetimi - içerik değiştiyse yeni versiyon oluştur
    if (this.isModified('content') || this.isModified('title')) {
      if (!this.isNew) { // Yeni belge değilse
        const versionData = {
          versionNumber: this.currentVersion + 1,
          title: this.title,
          content: this.content,
          updatedBy: this.modifiedBy || this.createdBy,
          comment: this.versionComment || 'Belge güncellendi'
        };
        this.versions.push(versionData);
        this.currentVersion = versionData.versionNumber;
        this.versionComment = undefined; // Geçici alanı temizle
      }
    }
    
    // Eğer evrak taslak durumundan çıkıyorsa ve evrak numarası yoksa
    if (this.isModified('status') && this.status !== 'draft' && !this.documentNumber) {
      // Yıl ve ay bilgisini al
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      
      // Bu ay içindeki evrak sayısını bul
      const count = await this.constructor.countDocuments({
        createdAt: {
          $gte: new Date(year, now.getMonth(), 1),
          $lt: new Date(year, now.getMonth() + 1, 1)
        },
        documentNumber: { $exists: true }
      });
      
      // Evrak numarasını oluştur: YIL-AY-SIRA
      const sequence = String(count + 1).padStart(4, '0');
      this.documentNumber = `${year}-${month}-${sequence}`;
    }
    
    // Departman alanını, oluşturan kullanıcının departmanından otomatik doldur
    if (!this.department && this.createdBy) {
      const User = mongoose.model('User');
      const creator = await User.findById(this.createdBy);
      if (creator && creator.department) {
        this.department = creator.department;
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Belge durumu değiştiğinde onay akışı tutarlılığını kontrol et
documentSchema.pre('save', async function(next) {
  try {
    // Eğer belge durumu değiştiyse ve pending/in_review durumuna geçtiyse
    if (this.isModified('status') && 
        (this.status === 'pending' || this.status === 'in_review')) {
      
      // Onay akışı var mı kontrol et
      // Bu alanda hasApprovalFlow() yerine direkt sorgu yapalım
      // Çünkü hasApprovalFlow() içinde save() çağrısı var ve bu sonsuz döngüye neden olabilir
      let hasFlow = false;
      
      if (this.approvalFlowId) {
        const ApprovalFlow = mongoose.model('ApprovalFlow');
        const flow = await ApprovalFlow.findById(this.approvalFlowId);
        hasFlow = !!flow;
      }
      
      if (!hasFlow) {
        // approvalFlowId yoksa veya geçersizse, belge ID'sine göre onay akışı ara
        const ApprovalFlow = mongoose.model('ApprovalFlow');
        const flow = await ApprovalFlow.findOne({ documentId: this._id });
        
        if (flow) {
          // Onay akışı bulundu, belgeyi güncelle
          this.approvalFlowId = flow._id;
          hasFlow = true;
        }
      }
      
      // Onay akışı yoksa ve durum pending/in_review ise hata fırlat
      if (!hasFlow) {
        const error = new Error(`Belge durumu '${this.status}' olarak değiştirilemez çünkü onay akışı bulunamadı.`);
        error.name = 'ApprovalFlowConsistencyError';
        throw error;
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Sorgu sonuçları için ilişkili alanları otomatik doldurur
//find ve findOne sorguları için populate işlemlerini gerçekleştirir
documentSchema.pre('find', function(next) {
  this.populate([
    { path: 'createdBy', select: 'firstName lastName email department position' },
    { path: 'currentApprover', select: 'firstName lastName email department position' },
    { path: 'approvalFlowId' },
    { path: 'approvalHistory.userId', select: 'firstName lastName email department position' },
    { path: 'attachments.uploadedBy', select: 'firstName lastName' },
    { path: 'versions.updatedBy', select: 'firstName lastName' }
  ]);
  next();
});

documentSchema.pre('findOne', function(next) {
  this.populate([
    { path: 'createdBy', select: 'firstName lastName email department position' },
    { path: 'currentApprover', select: 'firstName lastName email department position' },
    { path: 'approvalFlowId' },
    { path: 'approvalHistory.userId', select: 'firstName lastName email department position' },
    { path: 'attachments.uploadedBy', select: 'firstName lastName' },
    { path: 'versions.updatedBy', select: 'firstName lastName' }
  ]);
  next();
});

// Belirli bir versiyona geri dönme metodu
//İstenen versiyon numarasına sahip versiyonu bulur
//Bulunamazsa hata fırlatır
//Bulunursa, belgenin başlık ve içeriğini o versiyondaki değerlerle günceller
//İşlem kaydı için versionComment alanını günceller
documentSchema.methods.revertToVersion = function(versionNumber) {
  const version = this.versions.find(v => v.versionNumber === versionNumber);
  if (!version) {
    throw new Error(`Belirtilen versiyon bulunamadı: ${versionNumber}`);
  }
  
  this.title = version.title;
  this.content = version.content;
  this.versionComment = `Versiyon ${versionNumber}'e geri dönüldü`;
  
  return this;
};

// Belge görüntüleme kaydı metodu
//Kullanıcı daha önce belgeyi görüntülemişse, son görüntüleme tarihini günceller ve görüntüleme sayısını artırır
//İlk kez görüntülüyorsa, yeni bir görüntüleme kaydı oluşturur
documentSchema.methods.recordView = function(userId) {
  const existingView = this.viewedBy.find(v => v.userId.toString() === userId.toString());
  
  if (existingView) {
    existingView.lastViewed = new Date();
    existingView.count += 1;
  } else {
    this.viewedBy.push({
      userId,
      lastViewed: new Date(),
      count: 1
    });
  }
  
  return this;
};

// Kullanıcının belgeyi onaylayıp onaylamadığını kontrol et
//Onay geçmişinde kullanıcının ID'si ve "approved" eylemiyle eşleşen bir kayıt olup olmadığını kontrol eder
documentSchema.methods.hasUserApproved = function(userId) {
  if (!this.approvalHistory || this.approvalHistory.length === 0) {
    return false;
  }
  
  return this.approvalHistory.some(
    history => history.userId.toString() === userId.toString() && 
    history.action === 'approved'
  );
};

// Kullanıcının belgeyi onaylama yetkisi var mı kontrol et
//Admin rolündeki kullanıcılar her zaman onaylayabilir
//Belge zaten onaylanmış veya reddedilmişse kimse onaylayamaz
//Kullanıcı mevcut onaylayıcı olarak atanmışsa onaylayabilir
//Diğer tüm durumlarda onaylama yetkisi yoktur
documentSchema.methods.canUserApprove = function(userId, userRole) {
  // Admin her zaman onaylayabilir
  if (userRole === 'admin') {
    return true;
  }
  
  // Belge zaten onaylanmış veya reddedilmişse onaylanamaz
  if (this.status === DocumentStatus.APPROVED || this.status === DocumentStatus.REJECTED) {
    return false;
  }
  
  // Kullanıcı mevcut onaylayıcı mı kontrol et
  if (this.currentApprover && this.currentApprover.toString() === userId.toString()) {
    return true;
  }
  
  return false;
};

// Belgenin onay akışı var mı kontrol et
//Önce belgenin approvalFlowId alanını kontrol eder
//Bu ID geçerliyse ve ilgili akış varsa true döner
//ID yoksa veya geçersizse, belge ID'sine göre onay akışı arar
//Bulursa, belgeyi günceller ve ilişkiyi düzeltir
//Bulamazsa false döner
documentSchema.methods.hasApprovalFlow = async function() {
  try {
    // approvalFlowId varsa, bu ID ile onay akışı var mı kontrol et
    if (this.approvalFlowId) {
      const ApprovalFlow = mongoose.model('ApprovalFlow');
      const flow = await ApprovalFlow.findById(this.approvalFlowId);
      if (flow) {
        return true;
      }
      // approvalFlowId var ama akış bulunamadıysa, alanı temizle
      this.approvalFlowId = undefined;
    }
    
    // approvalFlowId yoksa veya geçersizse, belge ID'sine göre onay akışı ara
    const ApprovalFlow = mongoose.model('ApprovalFlow');
    const flow = await ApprovalFlow.findOne({ documentId: this._id });
    
    // Eğer onay akışı bulunduysa, belgeyi güncelle
    if (flow) {
      // Sonsuz döngüyü önlemek için pre-save hook'unu atlayarak güncelle
      this.approvalFlowId = flow._id;
      
      // Direkt veritabanında güncelle, save() kullanma
      await mongoose.model('Document').updateOne(
        { _id: this._id },
        { $set: { approvalFlowId: flow._id } }
      );
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`hasApprovalFlow metodu hatası: ${error.message}`);
    return false;
  }
};

// Belgenin durumu ile onay akışı arasında tutarlılık kontrolü
//Belge durumu "pending" veya "in_review" ise onay akışı gerektirir
//hasApprovalFlow metodunu çağırarak onay akışı olup olmadığını kontrol eder
//Onay akışı yoksa hata mesajıyla birlikte geçersiz durum bilgisi döner
//Tutarlıysa geçerli durum bilgisi döner
documentSchema.methods.validateApprovalState = async function() {
  // Belge onay gerektiren bir durumda mı?
  const requiresApprovalFlow = ['pending', 'in_review'].includes(this.status);
  
  if (requiresApprovalFlow) {
    const hasFlow = await this.hasApprovalFlow();
    if (!hasFlow) {
      return {
        isValid: false,
        error: `Belge durumu '${this.status}' olmasına rağmen onay akışı bulunamadı.`
      };
    }
  }
  
  return { isValid: true };
};

// Virtual: Onay akışı
documentSchema.virtual('approvalFlow', {
  ref: 'ApprovalFlow',
  localField: '_id',
  foreignField: 'documentId',
  justOne: true
});

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
