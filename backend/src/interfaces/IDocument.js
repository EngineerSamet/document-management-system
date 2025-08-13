/**
 * Belge durumu için enum
 * @readonly
 * @enum {string}
 */
const DocumentStatus = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ARCHIVED: 'archived'
};

/**
 * Belge türü için enum
 * @readonly
 * @enum {string}
 */
const DocumentType = {
  REPORT: 'REPORT',         // Rapor
  CONTRACT: 'CONTRACT',      // Sözleşme
  INVOICE: 'INVOICE',       // Fatura
  LETTER: 'LETTER',         // Yazı/Mektup
  APPLICATION: 'APPLICATION', // Başvuru/Dilekçe
  FORM: 'FORM',            // Form
  CERTIFICATE: 'CERTIFICATE', // Sertifika/Belge
  PROTOCOL: 'PROTOCOL',     // Protokol
  RECEIPT: 'RECEIPT',       // Makbuz
  PETITION: 'PETITION',     // Dilekçe
  MEMO: 'MEMO',            // Not/Memorandum
  ANNOUNCEMENT: 'ANNOUNCEMENT', // Duyuru
  OTHER: 'OTHER'           // Diğer
};

/**
 * Belge önceliği için enum
 * @readonly
 * @enum {string}
 */
const DocumentPriority = {
  LOW: 'low',           // Düşük
  MEDIUM: 'medium',      // Normal
  HIGH: 'high',         // Yüksek
  URGENT: 'urgent'       // Acil
};

/**
 * @typedef {Object} IDocument
 * @property {string} id - Belge ID
 * @property {string} title - Belge başlığı
 * @property {string} description - Belge açıklaması
 * @property {string} documentType - Belge türü
 * @property {string} filePath - Dosya yolu
 * @property {string} fileName - Dosya adı
 * @property {number} fileSize - Dosya boyutu (bytes)
 * @property {string} mimeType - Dosya MIME türü
 * @property {string} status - Belge durumu
 * @property {string} createdBy - Oluşturan kullanıcı ID
 * @property {Date} createdAt - Oluşturulma tarihi
 * @property {Date} updatedAt - Güncellenme tarihi
 * @property {string} [approvalFlowId] - Onay akışı ID (varsa)
 * @property {string} [department] - İlgili departman
 * @property {Object} [metadata] - Ek meta veriler
 */

/**
 * Evrak oluşturma DTO
 * @typedef {Object} CreateDocumentDTO
 * @property {string} title - Evrak başlığı
 * @property {string} content - Evrak içeriği
 * @property {string} documentType - Evrak tipi
 * @property {string} approvalFlowId - Onay akışı ID
 * @property {Array<string>} [attachments] - Ek dosya yolları
 */

/**
 * Evrak güncelleme DTO
 * @typedef {Object} UpdateDocumentDTO
 * @property {string} [title] - Evrak başlığı
 * @property {string} [content] - Evrak içeriği
 * @property {string} [documentType] - Evrak tipi
 * @property {string} [approvalFlowId] - Onay akışı ID
 * @property {Array<string>} [attachments] - Ek dosya yolları
 */

/**
 * Evrak onay DTO
 * @typedef {Object} ApproveDocumentDTO
 * @property {string} documentId - Evrak ID
 * @property {boolean} approved - Onay durumu
 * @property {string} [comment] - Yorum
 */

/**
 * Evrak yanıt DTO
 * @typedef {Object} DocumentResponseDTO
 * @property {string} id - Evrak ID
 * @property {string} title - Evrak başlığı
 * @property {string} content - Evrak içeriği
 * @property {string} documentNumber - Evrak numarası
 * @property {string} documentType - Evrak tipi
 * @property {string} status - Evrak durumu
 * @property {Object} createdBy - Oluşturan kullanıcı bilgileri
 * @property {Array<string>} attachments - Ek dosya yolları
 * @property {Object} currentApprover - Şu anki onaylayıcı bilgileri
 * @property {Array<Object>} approvalHistory - Onay geçmişi
 * @property {Object} approvalFlow - Onay akışı bilgileri
 * @property {Date} createdAt - Oluşturulma zamanı
 * @property {Date} updatedAt - Güncellenme zamanı
 */

const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  resource: {
    type: String,
    required: true
  },
  actions: {
    type: [String],
    required: true
  }
});

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String
  },
  permissions: [permissionSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Role = mongoose.model('Role', roleSchema);

module.exports = {
  DocumentStatus,
  DocumentType,
  DocumentPriority,
  Role
};
