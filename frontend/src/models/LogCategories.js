/**
 * Log kategorileri ve türleri
 * Bu dosya, sistemde kullanılan tüm log kategorilerini ve türlerini tanımlar.
 */

// Log seviyeleri
export const LOG_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
  DEBUG: 'debug'
};

// Log kategorileri
export const LOG_CATEGORIES = {
  // Kullanıcı işlemleri
  USER_LOGIN: 'user_login',           // Kullanıcı girişi
  USER_LOGOUT: 'user_logout',         // Kullanıcı çıkışı
  USER_CREATED: 'user_created',       // Kullanıcı oluşturuldu
  USER_UPDATED: 'user_updated',       // Kullanıcı güncellendi
  USER_DELETED: 'user_deleted',       // Kullanıcı silindi
  
  // Yetkilendirme işlemleri
  ROLE_ASSIGNED: 'role_assigned',     // Rol atandı
  ROLE_REMOVED: 'role_removed',       // Rol kaldırıldı
  PERMISSION_CHANGED: 'permission_changed', // İzin değiştirildi
  
  // Belge işlemleri
  DOCUMENT_CREATED: 'document_created',   // Belge oluşturuldu
  DOCUMENT_UPDATED: 'document_updated',   // Belge güncellendi
  DOCUMENT_DELETED: 'document_deleted',   // Belge silindi
  DOCUMENT_VIEWED: 'document_viewed',     // Belge görüntülendi
  DOCUMENT_DOWNLOADED: 'document_downloaded', // Belge indirildi
  
  // Onay akışı işlemleri
  APPROVAL_FLOW_CREATED: 'approval_flow_created',   // Onay akışı oluşturuldu
  APPROVAL_FLOW_UPDATED: 'approval_flow_updated',   // Onay akışı güncellendi
  APPROVAL_FLOW_DELETED: 'approval_flow_deleted',   // Onay akışı silindi
  DOCUMENT_APPROVED: 'document_approved',           // Belge onaylandı
  DOCUMENT_REJECTED: 'document_rejected',           // Belge reddedildi
  
  // Sistem işlemleri
  SYSTEM_ERROR: 'system_error',               // Sistem hatası
  SYSTEM_WARNING: 'system_warning',           // Sistem uyarısı
  SYSTEM_CONFIG_CHANGED: 'config_changed',    // Sistem ayarları değiştirildi
  DATABASE_ERROR: 'database_error',           // Veritabanı hatası
  API_ERROR: 'api_error',                     // API hatası
  
  // Dosya işlemleri
  FILE_UPLOADED: 'file_uploaded',             // Dosya yüklendi
  FILE_DELETED: 'file_deleted',               // Dosya silindi
  
  // Arama ve filtreleme işlemleri
  SEARCH_PERFORMED: 'search_performed',       // Arama yapıldı
  
  // Denetim kaydı
  AUDIT_EVENT: 'audit_event'                  // Denetim olayı
};

// Log modülleri
export const LOG_MODULES = {
  AUTH: 'auth',           // Kimlik doğrulama
  USER: 'user',           // Kullanıcı
  DOCUMENT: 'document',   // Belge
  APPROVAL: 'approval',   // Onay
  SYSTEM: 'system',       // Sistem
  FILE: 'file',           // Dosya
  AUDIT: 'audit',         // Denetim
  SEARCH: 'search'        // Arama
};

// Log kategorisine göre seviye belirleme
export const getCategoryLevel = (category) => {
  switch (category) {
    case LOG_CATEGORIES.SYSTEM_ERROR:
    case LOG_CATEGORIES.DATABASE_ERROR:
    case LOG_CATEGORIES.API_ERROR:
      return LOG_LEVELS.ERROR;
      
    case LOG_CATEGORIES.SYSTEM_WARNING:
      return LOG_LEVELS.WARNING;
      
    case LOG_CATEGORIES.AUDIT_EVENT:
      return LOG_LEVELS.CRITICAL;
      
    default:
      return LOG_LEVELS.INFO;
  }
};

// Log kategorisine göre modül belirleme
export const getCategoryModule = (category) => {
  if (category.startsWith('user_')) return LOG_MODULES.USER;
  if (category.startsWith('document_')) return LOG_MODULES.DOCUMENT;
  if (category.startsWith('approval_')) return LOG_MODULES.APPROVAL;
  if (category.startsWith('system_') || category.includes('error') || category === 'config_changed') return LOG_MODULES.SYSTEM;
  if (category.startsWith('file_')) return LOG_MODULES.FILE;
  if (category === 'search_performed') return LOG_MODULES.SEARCH;
  if (category.includes('login') || category.includes('logout') || category.includes('role_') || category.includes('permission_')) return LOG_MODULES.AUTH;
  if (category === 'audit_event') return LOG_MODULES.AUDIT;
  
  return LOG_MODULES.SYSTEM;
};

// Log kategorisine göre kullanıcı dostu mesaj oluşturma
export const getCategoryMessage = (category, data = {}) => {
  const { userName, documentTitle, roleName, flowName } = data;
  
  switch (category) {
    case LOG_CATEGORIES.USER_LOGIN:
      return `Kullanıcı girişi: ${userName || 'Bilinmeyen kullanıcı'}`;
    case LOG_CATEGORIES.USER_LOGOUT:
      return `Kullanıcı çıkışı: ${userName || 'Bilinmeyen kullanıcı'}`;
    case LOG_CATEGORIES.USER_CREATED:
      return `Yeni kullanıcı oluşturuldu: ${userName || 'Bilinmeyen kullanıcı'}`;
    case LOG_CATEGORIES.USER_UPDATED:
      return `Kullanıcı güncellendi: ${userName || 'Bilinmeyen kullanıcı'}`;
    case LOG_CATEGORIES.USER_DELETED:
      return `Kullanıcı silindi: ${userName || 'Bilinmeyen kullanıcı'}`;
      
    case LOG_CATEGORIES.ROLE_ASSIGNED:
      return `Rol atandı: ${userName || 'Bilinmeyen kullanıcı'} → ${roleName || 'Bilinmeyen rol'}`;
    case LOG_CATEGORIES.ROLE_REMOVED:
      return `Rol kaldırıldı: ${userName || 'Bilinmeyen kullanıcı'} → ${roleName || 'Bilinmeyen rol'}`;
      
    case LOG_CATEGORIES.DOCUMENT_CREATED:
      return `Yeni belge oluşturuldu: ${documentTitle || 'Bilinmeyen belge'}`;
    case LOG_CATEGORIES.DOCUMENT_UPDATED:
      return `Belge güncellendi: ${documentTitle || 'Bilinmeyen belge'}`;
    case LOG_CATEGORIES.DOCUMENT_DELETED:
      return `Belge silindi: ${documentTitle || 'Bilinmeyen belge'}`;
    case LOG_CATEGORIES.DOCUMENT_VIEWED:
      return `Belge görüntülendi: ${documentTitle || 'Bilinmeyen belge'}`;
    case LOG_CATEGORIES.DOCUMENT_DOWNLOADED:
      return `Belge indirildi: ${documentTitle || 'Bilinmeyen belge'}`;
      
    case LOG_CATEGORIES.APPROVAL_FLOW_CREATED:
      return `Yeni onay akışı oluşturuldu: ${flowName || 'Bilinmeyen akış'}`;
    case LOG_CATEGORIES.APPROVAL_FLOW_UPDATED:
      return `Onay akışı güncellendi: ${flowName || 'Bilinmeyen akış'}`;
    case LOG_CATEGORIES.APPROVAL_FLOW_DELETED:
      return `Onay akışı silindi: ${flowName || 'Bilinmeyen akış'}`;
    case LOG_CATEGORIES.DOCUMENT_APPROVED:
      return `Belge onaylandı: ${documentTitle || 'Bilinmeyen belge'}`;
    case LOG_CATEGORIES.DOCUMENT_REJECTED:
      return `Belge reddedildi: ${documentTitle || 'Bilinmeyen belge'}`;
      
    case LOG_CATEGORIES.SYSTEM_ERROR:
      return `Sistem hatası: ${data.message || 'Bilinmeyen hata'}`;
    case LOG_CATEGORIES.SYSTEM_WARNING:
      return `Sistem uyarısı: ${data.message || 'Bilinmeyen uyarı'}`;
    case LOG_CATEGORIES.SYSTEM_CONFIG_CHANGED:
      return `Sistem ayarları değiştirildi: ${data.configName || 'Bilinmeyen ayar'}`;
      
    case LOG_CATEGORIES.FILE_UPLOADED:
      return `Dosya yüklendi: ${data.fileName || 'Bilinmeyen dosya'}`;
    case LOG_CATEGORIES.FILE_DELETED:
      return `Dosya silindi: ${data.fileName || 'Bilinmeyen dosya'}`;
      
    case LOG_CATEGORIES.SEARCH_PERFORMED:
      return `Arama yapıldı: ${data.searchTerm || 'Bilinmeyen arama'}`;
      
    case LOG_CATEGORIES.AUDIT_EVENT:
      return `Denetim kaydı: ${data.message || 'Bilinmeyen olay'}`;
      
    default:
      return data.message || 'Bilinmeyen log olayı';
  }
};

// Log kategorisine göre ikon belirleme (Tailwind CSS sınıfları)
export const getCategoryIcon = (category) => {
  switch (category) {
    case LOG_CATEGORIES.USER_LOGIN:
    case LOG_CATEGORIES.USER_LOGOUT:
      return 'fas fa-sign-in-alt';
      
    case LOG_CATEGORIES.USER_CREATED:
    case LOG_CATEGORIES.USER_UPDATED:
    case LOG_CATEGORIES.USER_DELETED:
      return 'fas fa-user';
      
    case LOG_CATEGORIES.ROLE_ASSIGNED:
    case LOG_CATEGORIES.ROLE_REMOVED:
    case LOG_CATEGORIES.PERMISSION_CHANGED:
      return 'fas fa-user-shield';
      
    case LOG_CATEGORIES.DOCUMENT_CREATED:
    case LOG_CATEGORIES.DOCUMENT_UPDATED:
    case LOG_CATEGORIES.DOCUMENT_DELETED:
    case LOG_CATEGORIES.DOCUMENT_VIEWED:
    case LOG_CATEGORIES.DOCUMENT_DOWNLOADED:
      return 'fas fa-file-alt';
      
    case LOG_CATEGORIES.APPROVAL_FLOW_CREATED:
    case LOG_CATEGORIES.APPROVAL_FLOW_UPDATED:
    case LOG_CATEGORIES.APPROVAL_FLOW_DELETED:
      return 'fas fa-project-diagram';
      
    case LOG_CATEGORIES.DOCUMENT_APPROVED:
      return 'fas fa-check-circle';
      
    case LOG_CATEGORIES.DOCUMENT_REJECTED:
      return 'fas fa-times-circle';
      
    case LOG_CATEGORIES.SYSTEM_ERROR:
    case LOG_CATEGORIES.DATABASE_ERROR:
    case LOG_CATEGORIES.API_ERROR:
      return 'fas fa-exclamation-triangle';
      
    case LOG_CATEGORIES.SYSTEM_WARNING:
      return 'fas fa-exclamation-circle';
      
    case LOG_CATEGORIES.SYSTEM_CONFIG_CHANGED:
      return 'fas fa-cogs';
      
    case LOG_CATEGORIES.FILE_UPLOADED:
    case LOG_CATEGORIES.FILE_DELETED:
      return 'fas fa-file-upload';
      
    case LOG_CATEGORIES.SEARCH_PERFORMED:
      return 'fas fa-search';
      
    case LOG_CATEGORIES.AUDIT_EVENT:
      return 'fas fa-shield-alt';
      
    default:
      return 'fas fa-info-circle';
  }
};

export default {
  LOG_LEVELS,
  LOG_CATEGORIES,
  LOG_MODULES,
  getCategoryLevel,
  getCategoryModule,
  getCategoryMessage,
  getCategoryIcon
};