const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * E-posta gönderme yardımcı fonksiyonları
 */
class EmailService {
  constructor() {
    // Test ortamında mı çalışıyoruz?
    const isTestEnvironment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    
    // Test ortamında nodemailer'ın test hesabını kullan veya gerçek SMTP ayarları kullan
    if (isTestEnvironment && !process.env.SMTP_HOST) {
      // Test ortamında ve SMTP ayarları yoksa, nodemailer'ın test hesabını kullan
      logger.info('Test ortamında çalışılıyor. Nodemailer test hesabı (ethereal.email) kullanılacak.');
      
      // Nodemailer'ın ethereal.email test hesabını oluştur
      this.createTestAccount();
    } else {
      // Gerçek SMTP ayarları veya varsayılan değerler
      logger.info(`SMTP ayarları kullanılıyor: ${process.env.SMTP_HOST || 'localhost'}`);
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: process.env.SMTP_PORT || 25,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        } : null
      });
    }
    
    // Varsayılan gönderen
    this.defaultFrom = process.env.EMAIL_FROM || 'noreply@example.com';
  }
  
  /**
   * Test hesabı oluşturur
   */
  async createTestAccount() {
    try {
      // Nodemailer test hesabı oluştur
      logger.info('Ethereal.email test hesabı oluşturuluyor...');
      const testAccount = await nodemailer.createTestAccount();
      
      logger.info('Nodemailer test hesabı oluşturuldu:', {
        user: testAccount.user,
        server: 'smtp.ethereal.email',
        port: 587
      });
      
      // Test hesabı ile transporter oluştur
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      
      // Test hesap bilgilerini kaydet
      this.testAccount = testAccount;
      
      logger.info('Ethereal.email test hesabı başarıyla yapılandırıldı. E-postalar için önizleme URL\'leri sağlanacak.');
    } catch (error) {
      logger.error('Test hesabı oluşturma hatası:', error);
      
      // Test hesabı oluşturulamazsa, sahte transporter kullan
      this.useFakeTransporter();
    }
  }
  
  /**
   * Sahte transporter kullanır (e-posta gönderimi simüle edilir)
   */
  useFakeTransporter() {
    logger.warn('Sahte e-posta transporteri kullanılıyor. E-postalar gerçekten gönderilmeyecek!');
    
    // Sahte transporter oluştur
    this.transporter = {
      sendMail: async (mailOptions) => {
        logger.info('Sahte e-posta gönderimi:', {
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text ? mailOptions.text.substring(0, 50) + '...' : null
        });
        
        // Başarılı gönderim simüle et
        return {
          messageId: `fake-${Date.now()}`,
          response: 'Sahte gönderim başarılı'
        };
      }
    };
  }
  
  /**
   * E-posta gönderir
   * @param {Object} options - E-posta seçenekleri
   * @param {string} options.to - Alıcı e-posta adresi
   * @param {string} options.subject - E-posta konusu
   * @param {string} options.text - Düz metin içeriği
   * @param {string} options.html - HTML içeriği
   * @param {string} [options.from] - Gönderen e-posta adresi
   * @param {Array<Object>} [options.attachments] - Ekler
   * @returns {Promise<Object>} Gönderim sonucu
   */
  async sendEmail(options) {
    try {
      // Transporter yoksa (henüz oluşturulmamışsa), sahte transporter kullan
      if (!this.transporter) {
        this.useFakeTransporter();
      }
      
      if (!options.to || !options.subject || (!options.text && !options.html)) {
        throw new Error('Geçersiz e-posta seçenekleri');
      }
      
      const mailOptions = {
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments || []
      };
      
      // Test ortamında ve @example.com uzantılı e-postalar için loglama yap ve başarılı kabul et
      if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && 
          options.to.endsWith('@example.com')) {
        logger.info(`Test e-postası gönderildi (simüle): ${options.to}, Konu: ${options.subject}`);
        
        // Eğer Ethereal transporter kullanılıyorsa, URL oluştur
        if (this.testAccount) {
          // Sahte bir messageId oluştur
          const fakeMessageId = `simulated-${Date.now()}@example.com`;
          
          // Ethereal URL formatını kullan
          const previewUrl = nodemailer.getTestMessageUrl({
            envelope: {
              from: mailOptions.from,
              to: [mailOptions.to]
            },
            messageId: fakeMessageId
          });
          
          logger.info(`Test e-postası önizleme URL (simüle): ${previewUrl}`);
          
          return {
            messageId: fakeMessageId,
            response: 'Test ortamında simüle edildi',
            previewUrl: previewUrl
          };
        }
        
        return {
          messageId: `simulated-${Date.now()}`,
          response: 'Test ortamında simüle edildi'
        };
      }
      
      // Gerçek e-posta gönderimi
      const info = await this.transporter.sendMail(mailOptions);
      
      // Eğer Ethereal test hesabı kullanıldıysa, URL'yi logla
      if (this.testAccount) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        logger.info(`📧 E-POSTA ÖNİZLEME URL: ${previewUrl}`);
        info.previewUrl = previewUrl;
      }
      
      logger.info(`E-posta gönderildi: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error(`E-posta gönderme hatası: ${error.message}`);
      
      // Test ortamında hata fırlatma, sadece log
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        logger.warn('Test ortamında e-posta gönderimi başarısız, ancak işlem devam edecek');
        return {
          messageId: `error-${Date.now()}`,
          error: error.message,
          simulated: true
        };
      }
      
      throw error;
    }
  }
  
  /**
   * Hesap doğrulama e-postası gönderir
   * @param {Object} user - Kullanıcı bilgileri
   * @param {string} token - Doğrulama token'ı
   * @returns {Promise<Object>} Gönderim sonucu
   */
  async sendVerificationEmail(user, token) {
    try {
      const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify?token=${token}`;
      const subject = 'Hesap Doğrulama';
      
      const text = `Sayın ${user.firstName} ${user.lastName},
      
Kurum İçi Evrak Sistemine hoş geldiniz. Hesabınızı doğrulamak ve şifrenizi belirlemek için aşağıdaki bağlantıya tıklayınız:

${verifyUrl}

Bu bağlantı 24 saat süreyle geçerlidir.

Saygılarımızla,
Kurum İçi Evrak Sistemi`;
      
      const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hesap Doğrulama</h2>
        <p>Sayın <strong>${user.firstName} ${user.lastName}</strong>,</p>
        <p>Kurum İçi Evrak Sistemine hoş geldiniz. Hesabınızı doğrulamak ve şifrenizi belirlemek için aşağıdaki butona tıklayınız:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Hesabımı Doğrula</a>
        </div>
        
        <p>Bu bağlantı 24 saat süreyle geçerlidir.</p>
        
        <p>Saygılarımızla,<br>Kurum İçi Evrak Sistemi</p>
      </div>
      `;
      
      const result = await this.sendEmail({
        to: user.email,
        subject,
        text,
        html
      });
      
      // Test ortamında ve example.com uzantılı e-posta ise, özel mesaj
      if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && 
          user.email.endsWith('@example.com')) {
        logger.info(`Test kullanıcısı için doğrulama e-postası (${user.email}). Token: ${token}`);
        logger.info(`Doğrulama URL: ${verifyUrl}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Doğrulama e-postası gönderme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Onay bildirimi e-postası gönderir
   * @param {Object} user - Kullanıcı bilgileri
   * @param {Object} document - Evrak bilgileri
   * @returns {Promise<Object>} Gönderim sonucu
   */
  async sendApprovalNotification(user, document) {
    try {
      const subject = `Onay Bekleyen Evrak: ${document.title}`;
      
      const text = `Sayın ${user.firstName} ${user.lastName},
      
${document.title} başlıklı evrak onayınızı bekliyor.

Evrak Numarası: ${document.documentNumber || 'Henüz atanmadı'}
Oluşturan: ${document.createdBy ? `${document.createdBy.firstName} ${document.createdBy.lastName}` : 'Bilinmiyor'}
Oluşturulma Tarihi: ${new Date(document.createdAt).toLocaleDateString('tr-TR')}

Evrakı incelemek ve onaylamak için lütfen sisteme giriş yapınız.

Saygılarımızla,
Kurum İçi Evrak Sistemi`;
      
      const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Onay Bekleyen Evrak</h2>
        <p>Sayın <strong>${user.firstName} ${user.lastName}</strong>,</p>
        <p><strong>${document.title}</strong> başlıklı evrak onayınızı bekliyor.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Evrak Numarası:</strong> ${document.documentNumber || 'Henüz atanmadı'}</p>
          <p><strong>Oluşturan:</strong> ${document.createdBy ? `${document.createdBy.firstName} ${document.createdBy.lastName}` : 'Bilinmiyor'}</p>
          <p><strong>Oluşturulma Tarihi:</strong> ${new Date(document.createdAt).toLocaleDateString('tr-TR')}</p>
        </div>
        
        <p>Evrakı incelemek ve onaylamak için <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/documents/${document._id}" style="color: #0066cc;">buraya tıklayınız</a>.</p>
        
        <p>Saygılarımızla,<br>Kurum İçi Evrak Sistemi</p>
      </div>
      `;
      
      return await this.sendEmail({
        to: user.email,
        subject,
        text,
        html
      });
    } catch (error) {
      logger.error(`Onay bildirimi e-postası gönderme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Evrak durumu güncelleme bildirimi e-postası gönderir
   * @param {Object} user - Kullanıcı bilgileri
   * @param {Object} document - Evrak bilgileri
   * @param {string} action - İşlem (approved, rejected)
   * @param {Object} approver - Onaylayan/reddeden kullanıcı bilgileri
   * @returns {Promise<Object>} Gönderim sonucu
   */
  async sendStatusUpdateNotification(user, document, action, approver) {
    try {
      const actionText = action === 'approved' ? 'onaylandı' : 'reddedildi';
      const subject = `Evrak ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}: ${document.title}`;
      
      const text = `Sayın ${user.firstName} ${user.lastName},
      
${document.title} başlıklı evrakınız ${approver.firstName} ${approver.lastName} tarafından ${actionText}.

Evrak Numarası: ${document.documentNumber || 'Henüz atanmadı'}
Durum: ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}
İşlem Tarihi: ${new Date().toLocaleDateString('tr-TR')}

Evrak detaylarını görmek için lütfen sisteme giriş yapınız.

Saygılarımızla,
Kurum İçi Evrak Sistemi`;
      
      const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${action === 'approved' ? '#28a745' : '#dc3545'};">Evrak ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}</h2>
        <p>Sayın <strong>${user.firstName} ${user.lastName}</strong>,</p>
        <p><strong>${document.title}</strong> başlıklı evrakınız <strong>${approver.firstName} ${approver.lastName}</strong> tarafından ${actionText}.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Evrak Numarası:</strong> ${document.documentNumber || 'Henüz atanmadı'}</p>
          <p><strong>Durum:</strong> <span style="color: ${action === 'approved' ? '#28a745' : '#dc3545'};">${actionText.charAt(0).toUpperCase() + actionText.slice(1)}</span></p>
          <p><strong>İşlem Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
        </div>
        
        <p>Evrak detaylarını görmek için <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/documents/${document._id}" style="color: #0066cc;">buraya tıklayınız</a>.</p>
        
        <p>Saygılarımızla,<br>Kurum İçi Evrak Sistemi</p>
      </div>
      `;
      
      return await this.sendEmail({
        to: user.email,
        subject,
        text,
        html
      });
    } catch (error) {
      logger.error(`Durum güncelleme bildirimi e-postası gönderme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Şifre sıfırlama e-postası gönderir
   * @param {Object} user - Kullanıcı bilgileri
   * @param {string} resetToken - Sıfırlama token'ı
   * @returns {Promise<Object>} Gönderim sonucu
   */
  async sendPasswordResetEmail(user, resetToken) {
    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password/${resetToken}`;
      const subject = 'Şifre Sıfırlama İsteği';
      
      const text = `Sayın ${user.firstName} ${user.lastName},
      
Hesabınız için bir şifre sıfırlama isteği aldık. Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayınız:

${resetUrl}

Bu bağlantı 10 dakika süreyle geçerlidir.

Eğer şifre sıfırlama isteğinde bulunmadıysanız, bu e-postayı görmezden gelebilirsiniz.

Saygılarımızla,
Kurum İçi Evrak Sistemi`;
      
      const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Şifre Sıfırlama İsteği</h2>
        <p>Sayın <strong>${user.firstName} ${user.lastName}</strong>,</p>
        <p>Hesabınız için bir şifre sıfırlama isteği aldık. Şifrenizi sıfırlamak için aşağıdaki butona tıklayınız:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Şifremi Sıfırla</a>
        </div>
        
        <p>Bu bağlantı 10 dakika süreyle geçerlidir.</p>
        <p>Eğer şifre sıfırlama isteğinde bulunmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
        
        <p>Saygılarımızla,<br>Kurum İçi Evrak Sistemi</p>
      </div>
      `;
      
      return await this.sendEmail({
        to: user.email,
        subject,
        text,
        html
      });
    } catch (error) {
      logger.error(`Şifre sıfırlama e-postası gönderme hatası: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new EmailService();
