/**
 * Onay akışı türleri
 * @enum {string}
 */
const ApprovalFlowType = {
  QUICK: 'quick',      // Hızlı onay - ilk onay geldiğinde tüm akış tamamlanır
  STANDARD: 'standard' // Standart/sıralı onay - adımlar sırayla onaylanır
};

/**
 * Onay durumları
 * @enum {string}
 */
const ApprovalStatus = {
  PENDING: 'pending',   // Beklemede
  APPROVED: 'approved', // Onaylandı
  REJECTED: 'rejected', // Reddedildi
  CANCELED: 'canceled', // İptal edildi
  WAITING: 'waiting'    // Sırasını bekliyor
};

/**
 * Onay adımı arayüzü
 * @interface
 */
const IApprovalStep = {
  userId: String,       // Onaylayıcı kullanıcı ID
  role: String,         // Onaylayıcı rolü (opsiyonel, rol bazlı onay için)
  order: Number,        // Onay sırası
  status: String,       // Onay durumu (ApprovalStatus)
  actionDate: Date,     // İşlem tarihi
  comment: String       // Yorum/açıklama
};

/**
 * Onay akışı arayüzü
 * @interface
 */
const IApprovalFlow = {
  documentId: String,    // İlgili belge ID
  flowType: String,      // Akış türü (ApprovalFlowType)
  steps: Array,          // Onay adımları (IApprovalStep[])
  currentStep: Number,   // Mevcut onay adımı
  status: String,        // Akış durumu (ApprovalStatus)
  createdBy: String,     // Oluşturan kullanıcı ID
  createdAt: Date,       // Oluşturulma tarihi
  updatedAt: Date,       // Güncellenme tarihi
  name: String,          // Akış adı (opsiyonel, şablonlar için)
  description: String,   // Akış açıklaması (opsiyonel)
  isTemplate: Boolean    // Şablon mu?
};

module.exports = {
  ApprovalFlowType,
  ApprovalStatus,
  IApprovalStep,
  IApprovalFlow
};
