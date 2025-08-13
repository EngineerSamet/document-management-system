/**
 * Özel hata sınıfları
 * SOLID prensiplerine uygun olarak tasarlanmıştır.
 * Her hata sınıfı tek bir sorumluluk üstlenir ve gerektiğinde genişletilebilir.
 */

/**
 * Temel API Hatası sınıfı
 * Tüm özel hata sınıfları için temel sınıf
 */
class ApiError extends Error {
  /**
   * @param {string} message - Hata mesajı
   * @param {number} statusCode - HTTP durum kodu
   * @param {Object|Array} details - Hata detayları (opsiyonel)
   */
  constructor(message, statusCode, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Doğrulama hatası
 * 400 Bad Request için kullanılır
 */
class ValidationError extends ApiError {
  /**
   * @param {string} message - Hata mesajı
   * @param {Object} errors - Alan bazlı hata detayları
   */
  constructor(message = 'Doğrulama hataları', errors = {}) {
    super(message, 400, errors);
    this.errors = errors;
  }
}

/**
 * Kimlik doğrulama hatası
 * 401 Unauthorized için kullanılır
 */
class AuthenticationError extends ApiError {
  /**
   * @param {string} message - Hata mesajı
   */
  constructor(message = 'Kimlik doğrulama başarısız') {
    super(message, 401);
  }
}

/**
 * Yetkilendirme hatası
 * 403 Forbidden için kullanılır
 */
class PermissionError extends ApiError {
  /**
   * @param {string} message - Hata mesajı
   */
  constructor(message = 'Bu işlem için yetkiniz bulunmuyor') {
    super(message, 403);
  }
}

/**
 * Kaynak bulunamadı hatası
 * 404 Not Found için kullanılır
 */
class NotFoundError extends ApiError {
  /**
   * @param {string} message - Hata mesajı
   */
  constructor(message = 'İstenen kaynak bulunamadı') {
    super(message, 404);
  }
}

/**
 * Çakışma hatası
 * 409 Conflict için kullanılır
 */
class ConflictError extends ApiError {
  /**
   * @param {string} message - Hata mesajı
   */
  constructor(message = 'Kaynak çakışması') {
    super(message, 409);
  }
}

/**
 * Sunucu hatası
 * 500 Internal Server Error için kullanılır
 */
class ServerError extends ApiError {
  /**
   * @param {string} message - Hata mesajı
   * @param {Error} originalError - Orijinal hata nesnesi
   */
  constructor(message = 'Sunucu hatası', originalError = null) {
    super(message, 500);
    this.originalError = originalError;
  }
}

/**
 * Dış servis hatası
 * 502 Bad Gateway için kullanılır
 */
class ExternalServiceError extends ApiError {
  /**
   * @param {string} message - Hata mesajı
   * @param {string} service - Hata veren servis adı
   */
  constructor(message = 'Dış servis hatası', service = null) {
    super(message, 502);
    this.service = service;
  }
}

/**
 * İşlem süresi aşımı hatası
 * 504 Gateway Timeout için kullanılır
 */
class TimeoutError extends ApiError {
  /**
   * @param {string} message - Hata mesajı
   */
  constructor(message = 'İşlem süresi aşıldı') {
    super(message, 504);
  }
}

/**
 * Dosya işleme hatası
 * 500 Internal Server Error için kullanılır
 */
class FileError extends ApiError {
  /**
   * @param {string} message - Hata mesajı
   * @param {string} code - Hata kodu
   */
  constructor(message = 'Dosya işleme hatası', code = null) {
    super(message, 500);
    this.code = code;
  }
}

module.exports = {
  ApiError,
  ValidationError,
  AuthenticationError,
  PermissionError,
  NotFoundError,
  ConflictError,
  ServerError,
  ExternalServiceError,
  TimeoutError,
  FileError
}; 