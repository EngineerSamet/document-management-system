/**
 * Kullanıcı arayüzü
 * @typedef {Object} IUser
 * @property {string} id - Kullanıcı ID
 * @property {string} firstName - Kullanıcı adı
 * @property {string} lastName - Kullanıcı soyadı
 * @property {string} email - E-posta adresi
 * @property {string} password - Şifre (hash'lenmiş)
 * @property {string} role - Kullanıcı rolü (admin, manager, supervisor, user)
 * @property {string} department - Departman
 * @property {string} position - Pozisyon
 * @property {boolean} isActive - Hesap aktif mi?
 * @property {Date} lastLogin - Son giriş zamanı
 * @property {Date} createdAt - Oluşturulma zamanı
 * @property {Date} updatedAt - Güncellenme zamanı
 */

/**
 * Kullanıcı oluşturma DTO
 * @typedef {Object} CreateUserDTO
 * @property {string} firstName - Kullanıcı adı
 * @property {string} lastName - Kullanıcı soyadı
 * @property {string} email - E-posta adresi
 * @property {string} password - Şifre
 * @property {string} role - Kullanıcı rolü
 * @property {string} department - Departman
 * @property {string} position - Pozisyon
 */

/**
 * Kullanıcı güncelleme DTO
 * @typedef {Object} UpdateUserDTO
 * @property {string} [firstName] - Kullanıcı adı
 * @property {string} [lastName] - Kullanıcı soyadı
 * @property {string} [email] - E-posta adresi
 * @property {string} [password] - Şifre
 * @property {string} [role] - Kullanıcı rolü
 * @property {string} [department] - Departman
 * @property {string} [position] - Pozisyon
 * @property {boolean} [isActive] - Hesap aktif mi?
 */

/**
 * Kullanıcı yanıt DTO
 * @typedef {Object} UserResponseDTO
 * @property {string} id - Kullanıcı ID
 * @property {string} firstName - Kullanıcı adı
 * @property {string} lastName - Kullanıcı soyadı
 * @property {string} email - E-posta adresi
 * @property {string} role - Kullanıcı rolü
 * @property {string} department - Departman
 * @property {string} position - Pozisyon
 * @property {boolean} isActive - Hesap aktif mi?
 * @property {Date} lastLogin - Son giriş zamanı
 * @property {Date} createdAt - Oluşturulma zamanı
 * @property {Date} updatedAt - Güncellenme zamanı
 */

/**
 * Giriş DTO
 * @typedef {Object} LoginDTO
 * @property {string} email - E-posta adresi
 * @property {string} password - Şifre
 */

/**
 * Giriş yanıt DTO
 * @typedef {Object} LoginResponseDTO
 * @property {string} token - JWT token
 * @property {string} refreshToken - Yenileme token'ı
 * @property {UserResponseDTO} user - Kullanıcı bilgileri
 */

module.exports = {};
