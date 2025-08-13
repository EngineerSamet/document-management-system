const express = require('express');
const documentController = require('../controllers/document.controller');
const documentValidator = require('../validators/document.validator');
const authMiddleware = require('../../middleware/auth.middleware');
const uploadMiddleware = require('../../middleware/upload.middleware');
const { ROLES, checkRole, documentAccessControl } = require('../../middleware/role.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Dosya yükleme için klasör oluştur
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Dosya yükleme yapılandırması
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Dosya filtreleme
const fileFilter = (req, file, cb) => {
  // Ana dosya (file) için sadece PDF kabul et
  if (file.fieldname === 'file') {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Ana dosya olarak sadece PDF dosyaları yüklenebilir'), false);
    }
  } 
  // Ek dosyalar (additionalFiles) için daha geniş format desteği
  else if (file.fieldname === 'additionalFiles') {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Ek dosyalar için desteklenmeyen format. Sadece PDF, resim, Word ve Excel dosyaları yüklenebilir.'), false);
    }
  } 
  // Diğer tüm alanlar için hata ver
  else {
    // Hata vermek yerine, bilinmeyen alanları da kabul et (ama dosyayı kaydetme)
    console.warn(`Beklenmeyen dosya alanı: ${file.fieldname}`);
    cb(null, false);
  }
};

// Multer yapılandırması
const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Tüm dosya alanlarını kabul eden middleware
// Bu, "Unexpected field" hatasını önler
const uploadAny = upload.any();

/**
 * Evrak rotaları
 */

// Tüm rotalarda kimlik doğrulama gerekli
router.use(authMiddleware.protect);

// Kullanıcının evraklarını getirme
router.get(
  '/user/documents',
  documentValidator.listDocumentsRules(),
  documentController.getUserDocuments
);

// Onay bekleyen evrakları getirme
router.get(
  '/user/pending',
  documentValidator.listDocumentsRules(),
  documentController.getPendingDocuments
);

// Frontend'in kullandığı onay bekleyen evraklar endpoint'i
router.get(
  '/pending-approvals',
  documentValidator.listDocumentsRules(),
  documentController.getPendingDocuments
);

/**
 * @route GET /api/documents/pending/approvals
 * @desc Kullanıcının onay bekleyen belgelerini getirir
 * @access Private/Manager,Supervisor,Admin
 */
router.get(
  '/pending/approvals',
  checkRole([ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.ADMIN]),
  documentController.getPendingApprovals
);

/**
 * @route GET /api/documents/dashboard/stats
 * @desc Dashboard için istatistikleri getirir (rol tabanlı)
 * @access Private
 */
router.get(
  '/dashboard/stats',
  documentController.getDashboardStats
);

/**
 * @route GET /api/documents/approval/templates
 * @desc Onay akışı şablonlarını getirir
 * @access Private/Admin,Manager
 */
router.get(
  '/approval/templates',
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  documentController.getApprovalTemplates
);

/**
 * @route POST /api/documents/approval/templates
 * @desc Onay akışı şablonu oluşturur
 * @access Private/Admin,Manager
 */
router.post(
  '/approval/templates',
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  documentController.createApprovalTemplate
);

/**
 * @route GET /api/documents/approval/all-templates
 * @desc Tüm onay akışı şablonlarını getirir
 * @access Private/Admin,Manager
 */
router.get(
  '/approval/all-templates',
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  documentController.getAllApprovalTemplates
);

/**
 * @route GET /api/documents/approval/all-flows
 * @desc Tüm onay akışlarını getirir
 * @access Private/Admin,Manager
 */
router.get(
  '/approval/all-flows',
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  documentController.getAllApprovalFlows
);

// Yönetici rotaları
// Tüm evrakları getirme (sadece admin ve observer)
router.get(
  '/admin/all',
  checkRole([ROLES.ADMIN, ROLES.OBSERVER]),
  documentValidator.listDocumentsRules(),
  documentController.getAllDocuments
);

// Evrak oluşturma
router.post(
  '/',
  checkRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.OFFICER]),
  uploadAny, // Tüm dosya alanlarını kabul eden middleware
  documentValidator.createDocumentRules(),
  documentController.createDocument
);

// Evrak güncelleme
router.put(
  '/:id',
  uploadAny, // Tüm dosya alanlarını kabul eden middleware
  documentValidator.updateDocumentRules(),
  documentAccessControl(), // Belge erişim kontrolü
  documentController.updateDocument
);

// Evrak silme
router.delete(
  '/:id',
  documentValidator.documentIdRules(),
  documentAccessControl(), // Belge erişim kontrolü
  documentController.deleteDocument
);

// Evrak detaylarını getirme
router.get(
  '/:id',
  documentValidator.documentIdRules(),
  documentAccessControl({ allowViewBeforeApproval: true }), // Belge erişim kontrolü (görüntüleme izni)
  documentController.getDocument
);

// Evrakı onaya gönderme
router.post(
  '/:id/submit',
  documentValidator.documentIdRules(),
  documentAccessControl(), // Belge erişim kontrolü
  documentController.submitForApproval
);

// Evrakı onaylama veya reddetme
router.post(
  '/:id/approve-reject',
  documentValidator.documentIdRules(),
  documentValidator.approveOrRejectDocumentRules(),
  documentAccessControl(), // Belge erişim kontrolü
  documentController.approveOrRejectDocument
);

// Evrakın PDF çıktısını alma
router.get(
  '/:id/pdf',
  documentValidator.documentIdRules(),
  documentAccessControl({ allowViewBeforeApproval: true }), // Belge erişim kontrolü (görüntüleme izni)
  documentController.generatePDF
);

/**
 * @route POST /api/documents/:documentId/approve
 * @desc Belgeyi onaylar
 * @access Private/Manager,Officer,Admin
 */
router.post(
  '/:documentId/approve',
  checkRole([ROLES.MANAGER, ROLES.OFFICER, ROLES.ADMIN]),
  documentAccessControl(), // Belge erişim kontrolü
  documentController.approveDocument
);

/**
 * @route POST /api/documents/:documentId/reject
 * @desc Belgeyi reddeder
 * @access Private/Manager,Officer,Admin
 */
router.post(
  '/:documentId/reject',
  checkRole([ROLES.MANAGER, ROLES.OFFICER, ROLES.ADMIN]),
  documentAccessControl(), // Belge erişim kontrolü
  documentController.rejectDocument
);

/**
 * @route GET /api/documents/:documentId/download
 * @desc Belgeyi PDF olarak indirir
 * @access Private
 */
router.get(
  '/:documentId/download', 
  documentAccessControl({ allowViewBeforeApproval: true }), // Belge erişim kontrolü (görüntüleme izni)
  documentController.downloadDocument
);

/**
 * @route GET /api/documents/:documentId/approval-flow
 * @desc Belgenin onay akışını getirir
 * @access Private
 */
router.get(
  '/:documentId/approval-flow',
  documentAccessControl({ allowViewBeforeApproval: true }),
  documentController.getDocumentApprovalFlow
);

/**
 * @route POST /api/documents/:documentId/notes
 * @desc Belgeye not ekler
 * @access Private/Admin,Manager,Officer (kendi belgeleri için)
 */
router.post(
  '/:documentId/notes',
  checkRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.OFFICER]),
  documentAccessControl(), // Belge erişim kontrolü - canAddNotesOrFiles kullanılacak
  documentController.addNoteToDocument
);

/**
 * @route POST /api/documents/:documentId/files
 * @desc Belgeye ek dosya ekler
 * @access Private/Admin,Manager,Officer (kendi belgeleri için)
 */
router.post(
  '/:documentId/files',
  checkRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.OFFICER]),
  uploadAny, // Dosya yükleme middleware'i
  documentAccessControl(), // Belge erişim kontrolü - canAddNotesOrFiles kullanılacak
  documentController.addFileToDocument
);

/**
 * @route POST /api/documents/:documentId/tags
 * @desc Belgeye etiket ekler
 * @access Private/Admin,Manager,Officer
 */
router.post(
  '/:documentId/tags',
  checkRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.OFFICER]),
  documentAccessControl(), // Belge erişim kontrolü - canAddTags kullanılacak
  documentController.addTagsToDocument
);

/**
 * @route POST /api/documents/:documentId/override-approval
 * @desc Onay akışında adım atlatır (override)
 * @access Private/Admin
 */
router.post(
  '/:documentId/override-approval',
  checkRole([ROLES.ADMIN]),
  documentAccessControl(), // Belge erişim kontrolü - canOverrideApprovalFlow kullanılacak
  documentController.overrideApprovalFlow
);

// Tüm belgeleri silme (sadece admin)
router.delete(
  '/admin/all',
  checkRole([ROLES.ADMIN]),
  documentController.deleteAllDocuments
);

module.exports = router;
