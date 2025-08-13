const User = require('../../models/User');
const Document = require('../../models/Document');
const ApprovalFlow = require('../../models/ApprovalFlow');
const logger = require('../../config/logger');
const bcrypt = require('bcryptjs');

/**
 * Admin servisi
 * SOLID prensiplerine uygun olarak tasarlanmıştır
 * Single Responsibility: Her metot tek bir işi yapar
 * Open/Closed: Yeni özellikler eklemek için mevcut kodu değiştirmek yerine genişletebiliriz
 * Liskov Substitution: Alt sınıflar üst sınıfların yerine geçebilir
 * Interface Segregation: İstemciler kullanmadıkları arayüzlere bağımlı değildir
 * Dependency Inversion: Üst seviye modüller alt seviye modüllere bağımlı değildir
 */
class AdminService {
  /**
   * Kullanıcı sayısını getirir
   * @returns {Promise<Number>} Toplam kullanıcı sayısı
   */
  async getUserCount() {
    try {
      logger.info('AdminService.getUserCount çağrıldı');
      const count = await User.countDocuments({});
      logger.info(`Toplam kullanıcı sayısı: ${count}`);
      return count;
    } catch (error) {
      logger.error(`Kullanıcı sayısını getirme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Belge sayısını getirir
   * @returns {Promise<Number>} Toplam belge sayısı
   */
  async getDocumentCount() {
    try {
      logger.info('AdminService.getDocumentCount çağrıldı');
      const count = await Document.countDocuments({});
      logger.info(`Toplam belge sayısı: ${count}`);
      return count;
    } catch (error) {
      logger.error(`Belge sayısını getirme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Onay bekleyen belge sayısını getirir
   * @returns {Promise<Number>} Onay bekleyen belge sayısı
   */
  async getPendingDocumentCount() {
    try {
      logger.info('AdminService.getPendingDocumentCount çağrıldı');
      const count = await Document.countDocuments({ status: 'WAITING_APPROVAL' });
      logger.info(`Onay bekleyen belge sayısı: ${count}`);
      return count;
    } catch (error) {
      logger.error(`Onay bekleyen belge sayısını getirme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Onay akışı sayısını getirir
   * @returns {Promise<Number>} Toplam onay akışı sayısı
   */
  async getApprovalFlowCount() {
    try {
      logger.info('AdminService.getApprovalFlowCount çağrıldı');
      const count = await ApprovalFlow.countDocuments({});
      logger.info(`Toplam onay akışı sayısı: ${count}`);
      return count;
    } catch (error) {
      logger.error(`Onay akışı sayısını getirme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Tüm onay akışlarını siler
   * @returns {Promise<Object>} Silme işlemi sonucu
   */
  async deleteAllApprovalFlows() {
    try {
      logger.info('AdminService.deleteAllApprovalFlows çağrıldı');
      
      // Tüm onay akışlarını sil
      const result = await ApprovalFlow.deleteMany({});
      
      logger.info(`${result.deletedCount} onay akışı başarıyla silindi`);
      return result;
    } catch (error) {
      logger.error(`Tüm onay akışlarını silme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sistem istatistiklerini getirir
   * @returns {Promise<Object>} Sistem istatistikleri
   */
  async getSystemStats() {
    try {
      logger.info('AdminService.getSystemStats çağrıldı');
      
      // Tüm istatistikleri paralel olarak getir
      const [userCount, documentCount, pendingDocuments, approvalFlowCount] = await Promise.all([
        this.getUserCount(),
        this.getDocumentCount(),
        this.getPendingDocumentCount(),
        this.getApprovalFlowCount()
      ]);
      
      const stats = {
        userCount,
        documentCount,
        pendingDocuments,
        approvalFlowCount
      };
      
      logger.info('Sistem istatistikleri başarıyla getirildi');
      return stats;
    } catch (error) {
      logger.error(`Sistem istatistiklerini getirme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Admin yetkisiyle yeni kullanıcı oluşturur
   * @param {Object} userData - Kullanıcı verileri
   * @param {string} userData.firstName - Kullanıcının adı
   * @param {string} userData.lastName - Kullanıcının soyadı
   * @param {string} userData.email - Kullanıcının e-posta adresi
   * @param {string} userData.password - Kullanıcının şifresi
   * @param {string} userData.role - Kullanıcının rolü (ADMIN, MANAGER, OFFICER, OBSERVER)
   * @returns {Promise<Object>} Oluşturulan kullanıcı
   */
  async createUserWithAdminPrivileges(userData) {
    try {
      logger.info(`AdminService.createUserWithAdminPrivileges çağrıldı: ${userData.email}`);
      
      // E-posta kontrolü
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        logger.warn(`Bu e-posta adresi ile kayıtlı bir kullanıcı zaten var: ${userData.email}`);
        const error = new Error('Bu e-posta adresi ile kayıtlı bir kullanıcı zaten var');
        error.code = 11000; // MongoDB duplicate key error code
        throw error;
      }
      
      // Şifreyi hash'le
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      // Yeni kullanıcı oluştur
      const user = new User({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password: hashedPassword,
        role: userData.role
      });
      
      // Kullanıcıyı kaydet
      await user.save();
      
      logger.info(`Yeni kullanıcı başarıyla oluşturuldu: ${user.email} (${user.role})`);
      return user;
    } catch (error) {
      logger.error(`Kullanıcı oluşturma hatası: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AdminService(); 