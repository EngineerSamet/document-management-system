// API URL
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Kullanıcı rolleri
export const USER_ROLES = {
  ADMIN: 'ADMIN',     // Sistem yöneticisi
  MANAGER: 'MANAGER', // Birim amiri/müdür
  OFFICER: 'OFFICER', // Uzman/memur
  OBSERVER: 'OBSERVER', // Gözlemci/denetçi
};

// Belge durumları
export const DOCUMENT_STATUS = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
};

// Belge türleri
export const DocumentType = {
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

// Belge öncelik seviyeleri
export const DocumentPriority = {
  LOW: 'low',           // Düşük
  MEDIUM: 'medium',      // Normal
  HIGH: 'high'         // Yüksek
};

// Onay akışı tipleri
export const APPROVAL_FLOW_TYPES = {
  SEQUENTIAL: 'SEQUENTIAL', // Sıralı onay
};

// Pagination için
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

// Form hata mesajları
export const FORM_ERROR_MESSAGES = {
  REQUIRED: 'Bu alan zorunludur',
  EMAIL_INVALID: 'Geçerli bir e-posta adresi giriniz',
  PASSWORD_MIN_LENGTH: 'Şifre en az 6 karakter olmalıdır',
  PASSWORD_MATCH: 'Şifreler eşleşmiyor',
};

// Lokalizasyon ayarları
export const DATE_FORMAT = 'DD.MM.YYYY';
export const DATETIME_FORMAT = 'DD.MM.YYYY HH:mm';

// Dosya yükleme limitleri
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

// Tema ve renkler
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

// Dashboard veri yenileme süresi (ms)
export const DASHBOARD_REFRESH_INTERVAL = 60 * 1000; // 1 dakika
