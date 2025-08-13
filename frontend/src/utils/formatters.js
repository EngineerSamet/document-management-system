import { format, parseISO, formatDistance } from 'date-fns';
import { tr } from 'date-fns/locale';
import { DOCUMENT_STATUS } from './constants';

/**
 * Tarih formatları için yardımcı fonksiyonlar
 */

/**
 * Tarihi lokalize edilmiş formatta döndürür
 * @param {Date|String} date - Tarih nesnesi veya tarih string'i
 * @returns {String} Formatlanmış tarih
 */
export const formatDate = (date) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Tarihi ve saati lokalize edilmiş formatta döndürür
 * @param {Date|String} date - Tarih nesnesi veya tarih string'i
 * @returns {String} Formatlanmış tarih ve saat
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Tarihten bu yana geçen süreyi insan dostu formatta döndürür
 * @param {Date|String} date - Tarih nesnesi veya tarih string'i
 * @returns {String} Geçen süre (örn: "3 saat önce")
 */
export const formatTimeAgo = (date) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now - dateObj;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffMonth / 12);
  
  if (diffSec < 60) {
    return 'Az önce';
  } else if (diffMin < 60) {
    return `${diffMin} dakika önce`;
  } else if (diffHour < 24) {
    return `${diffHour} saat önce`;
  } else if (diffDay < 30) {
    return `${diffDay} gün önce`;
  } else if (diffMonth < 12) {
    return `${diffMonth} ay önce`;
  } else {
    return `${diffYear} yıl önce`;
  }
};

/**
 * Göreceli tarih formatla (örn: "2 saat önce")
 * @param {string|Date} date - ISO string veya Date objesi
 * @returns {string} Göreceli tarih
 */
export const formatRelativeDate = (date) => {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatDistance(dateObj, new Date(), { 
      addSuffix: true,
      locale: tr 
    });
  } catch (error) {
    console.error('Relative date format error:', error);
    return '-';
  }
};

/**
 * Para birimi formatla
 * @param {number} amount - Miktar
 * @param {string} currency - Para birimi (default: TRY)
 * @returns {string} Formatlanmış para miktarı
 */
export const formatCurrency = (amount, currency = 'TRY') => {
  if (amount === null || amount === undefined) return '-';
  
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

/**
 * Belge durumu görüntü metni
 * @param {string} status - Durum kodu
 * @returns {string} Türkçe durum metni
 */
export const formatDocumentStatus = (status) => {
  const statusMap = {
    [DOCUMENT_STATUS.DRAFT]: 'Taslak',
    [DOCUMENT_STATUS.IN_REVIEW]: 'İncelemede',
    [DOCUMENT_STATUS.PENDING]: 'Onay Bekliyor',
    [DOCUMENT_STATUS.APPROVED]: 'Onaylandı',
    [DOCUMENT_STATUS.REJECTED]: 'Reddedildi',
    [DOCUMENT_STATUS.ARCHIVED]: 'Arşivlendi',
  };

  return statusMap[status] || status;
};

/**
 * Dosya boyutu formatla
 * @param {number} bytes - Dosya boyutu (bytes)
 * @param {number} decimals - Ondalık hane sayısı
 * @returns {string} Formatlanmış dosya boyutu
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Tam ad formatla
 * @param {Object} user - Kullanıcı objesi
 * @returns {string} Tam ad
 */
export const formatFullName = (user) => {
  if (!user) return '-';
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || '-';
};

/**
 * Kullanıcı rolü formatla
 * @param {string} role - Rol kodu
 * @returns {string} Türkçe rol adı
 */
export const formatUserRole = (role) => {
  const roleMap = {
    'ADMIN': 'Yönetici',
    'MANAGER': 'Müdür',
    'USER': 'Kullanıcı',
  };

  return roleMap[role] || role;
};

/**
 * Metni kısaltıp sonuna üç nokta ekler
 * @param {string} text - Kısaltılacak metin
 * @param {number} maxLength - Maksimum uzunluk
 * @returns {string} Kısaltılmış metin
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '...';
};
