const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const QRCode = require('qrcode');
const { DocumentStatus } = require('../interfaces/IDocument');

/**
 * PDF oluşturma yardımcı fonksiyonları
 */
class PDFGenerator {
  /**
   * Evrak için PDF oluşturur
   * @param {Object} document - Evrak bilgileri
   * @param {string} outputPath - PDF çıktı yolu (opsiyonel)
   * @returns {Promise<string>} PDF dosya yolu
   */
  static async generateDocumentPDF(document, outputPath = null) {
    return new Promise((resolve, reject) => {
      try {
        // Evrak bilgilerini kontrol et
        if (!document || !document.title) {
          throw new Error('Geçersiz evrak bilgileri');
        }
        
        // PDF dosyası için geçici yol oluştur
        const timestamp = Date.now();
        const fileName = `document-${document._id || timestamp}.pdf`;
        const filePath = outputPath || path.join(__dirname, '../../uploads', fileName);
        
        // Dizin yoksa oluştur
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // PDF oluşturma
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: document.title,
            Author: document.createdBy ? `${document.createdBy.firstName} ${document.createdBy.lastName}` : 'Sistem',
            Subject: 'Evrak',
            Keywords: 'evrak, belge, onay',
            CreationDate: new Date()
          }
        });
        
        // Dosyaya yaz
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        
        // Başlık ve logo
        doc.fontSize(20).font('Helvetica-Bold').text('KURUM İÇİ EVRAK SİSTEMİ', { align: 'center' });
        doc.moveDown();
        
        // Evrak numarası ve tarih
        doc.fontSize(12).font('Helvetica');
        if (document.documentNumber) {
          doc.text(`Evrak No: ${document.documentNumber}`, { align: 'right' });
        }
        doc.text(`Tarih: ${new Date(document.createdAt || Date.now()).toLocaleDateString('tr-TR')}`, { align: 'right' });
        doc.moveDown(2);
        
        // Evrak başlığı
        doc.fontSize(16).font('Helvetica-Bold').text(document.title, { align: 'center' });
        doc.moveDown(2);
        
        // Evrak açıklaması
        if (document.description) {
          doc.fontSize(12).font('Helvetica').text(document.description, {
            align: 'justify',
            lineGap: 5
          });
          doc.moveDown(2);
        }
        
        // Dosya bilgileri
        doc.fontSize(12).font('Helvetica-Bold').text('Dosya Bilgileri:', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Dosya Adı: ${document.fileName || 'Belirtilmemiş'}`);
        doc.text(`Dosya Türü: ${document.mimeType || 'Belirtilmemiş'}`);
        doc.text(`Dosya Boyutu: ${document.fileSize ? `${(document.fileSize / 1024).toFixed(2)} KB` : 'Belirtilmemiş'}`);
        doc.moveDown(2);
        
        // Onay bilgileri
        if (document.approvalHistory && document.approvalHistory.length > 0) {
          doc.moveDown();
          doc.fontSize(14).font('Helvetica-Bold').text('Onay Geçmişi', { underline: true });
          doc.moveDown();
          
          document.approvalHistory.forEach((approval, index) => {
            const user = approval.userId;
            const userName = user ? `${user.firstName} ${user.lastName}` : 'Bilinmeyen Kullanıcı';
            const action = approval.action === 'approved' ? 'Onayladı' : 
                          approval.action === 'rejected' ? 'Reddetti' : 'Yorum Yaptı';
            const date = new Date(approval.timestamp).toLocaleDateString('tr-TR');
            
            doc.fontSize(12).font('Helvetica').text(`${index + 1}. ${userName} - ${action} (${date})`);
            
            if (approval.comment) {
              doc.fontSize(10).font('Helvetica-Oblique').text(`Yorum: ${approval.comment}`, { indent: 20 });
            }
            
            doc.moveDown(0.5);
          });
        }
        
        // Oluşturan bilgisi
        doc.moveDown(2);
        if (document.createdBy) {
          doc.fontSize(12).font('Helvetica').text(`Oluşturan: ${document.createdBy.firstName} ${document.createdBy.lastName}`, { align: 'left' });
          if (document.createdBy.department) {
            doc.text(`Departman: ${document.createdBy.department}`, { align: 'left' });
          }
          if (document.createdBy.position) {
            doc.text(`Pozisyon: ${document.createdBy.position}`, { align: 'left' });
          }
        }
        
        // Sayfa numarası
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc.fontSize(8).font('Helvetica').text(
            `Sayfa ${i + 1} / ${totalPages}`,
            50,
            doc.page.height - 50,
            { align: 'center' }
          );
        }
        
        // PDF'i sonlandır
        doc.end();
        
        // Stream tamamlandığında resolve et
        stream.on('finish', () => {
          logger.info(`PDF oluşturuldu: ${filePath}`);
          resolve(filePath);
        });
        
        // Hata durumunda reject et
        stream.on('error', (err) => {
          logger.error(`PDF oluşturma hatası: ${err.message}`);
          reject(err);
        });
        
      } catch (error) {
        logger.error(`PDF oluşturma hatası: ${error.message}`);
        reject(error);
      }
    });
  }
  
  /**
   * Evrak listesi için PDF raporu oluşturur
   * @param {Array<Object>} documents - Evrak listesi
   * @param {Object} options - Rapor seçenekleri
   * @param {string} outputPath - PDF çıktı yolu (opsiyonel)
   * @returns {Promise<string>} PDF dosya yolu
   */
  static async generateDocumentListPDF(documents, options = {}, outputPath = null) {
    return new Promise((resolve, reject) => {
      try {
        // Evrak listesini kontrol et
        if (!Array.isArray(documents)) {
          throw new Error('Geçersiz evrak listesi');
        }
        
        // PDF dosyası için geçici yol oluştur
        const timestamp = Date.now();
        const fileName = `document-list-${timestamp}.pdf`;
        const filePath = outputPath || path.join(__dirname, '../../uploads', fileName);
        
        // Dizin yoksa oluştur
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // PDF oluşturma
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: options.title || 'Evrak Listesi',
            Subject: 'Evrak Listesi Raporu',
            Keywords: 'evrak, liste, rapor',
            CreationDate: new Date()
          }
        });
        
        // Dosyaya yaz
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        
        // Başlık
        doc.fontSize(20).font('Helvetica-Bold').text(options.title || 'EVRAK LİSTESİ RAPORU', { align: 'center' });
        doc.moveDown();
        
        // Rapor tarihi
        doc.fontSize(12).font('Helvetica').text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, { align: 'right' });
        doc.moveDown(2);
        
        // Filtre bilgileri
        if (options.filters) {
          doc.fontSize(12).font('Helvetica-Bold').text('Filtreler:', { continued: true });
          doc.font('Helvetica').text(` ${JSON.stringify(options.filters)}`);
          doc.moveDown();
        }
        
        // Toplam evrak sayısı
        doc.fontSize(12).font('Helvetica-Bold').text('Toplam Evrak Sayısı:', { continued: true });
        doc.font('Helvetica').text(` ${documents.length}`);
        doc.moveDown(2);
        
        // Tablo başlıkları
        const tableTop = doc.y;
        const tableHeaders = ['Evrak No', 'Başlık', 'Durum', 'Oluşturan', 'Tarih'];
        const columnWidths = [80, 200, 70, 100, 70];
        
        // Tablo başlık satırı
        doc.fontSize(10).font('Helvetica-Bold');
        let xPos = 50; // Sol kenar boşluğu
        
        tableHeaders.forEach((header, i) => {
          doc.text(header, xPos, tableTop, { width: columnWidths[i], align: 'left' });
          xPos += columnWidths[i];
        });
        
        // Başlık altı çizgi
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        doc.moveDown(1.5);
        
        // Tablo içeriği
        let rowTop = doc.y;
        doc.fontSize(10).font('Helvetica');
        
        documents.forEach((document, index) => {
          // Sayfa sınırını kontrol et
          if (rowTop > doc.page.height - 100) {
            doc.addPage();
            rowTop = 50;
          }
          
          xPos = 50;
          
          // Evrak numarası
          doc.text(document.documentNumber || '-', xPos, rowTop, { width: columnWidths[0], align: 'left' });
          xPos += columnWidths[0];
          
          // Başlık
          doc.text(document.title, xPos, rowTop, { width: columnWidths[1], align: 'left' });
          xPos += columnWidths[1];
          
          // Durum
          const status = document.status === DocumentStatus.DRAFT ? 'Taslak' :
                        document.status === DocumentStatus.PENDING ? 'Onay Bekliyor' :
                        document.status === DocumentStatus.IN_REVIEW ? 'İncelemede' :
                        document.status === DocumentStatus.APPROVED ? 'Onaylandı' :
                        document.status === DocumentStatus.REJECTED ? 'Reddedildi' : 
                        document.status === DocumentStatus.ARCHIVED ? 'Arşivlenmiş' : 'Bilinmiyor';
          doc.text(status, xPos, rowTop, { width: columnWidths[2], align: 'left' });
          xPos += columnWidths[2];
          
          // Oluşturan
          const creator = document.createdBy ? `${document.createdBy.firstName} ${document.createdBy.lastName}` : '-';
          doc.text(creator, xPos, rowTop, { width: columnWidths[3], align: 'left' });
          xPos += columnWidths[3];
          
          // Tarih
          const date = document.createdAt ? new Date(document.createdAt).toLocaleDateString('tr-TR') : '-';
          doc.text(date, xPos, rowTop, { width: columnWidths[4], align: 'left' });
          
          // Satır altı çizgi (son satır hariç)
          if (index < documents.length - 1) {
            doc.moveTo(50, rowTop + 15).lineTo(550, rowTop + 15).stroke();
          }
          
          rowTop += 20;
          doc.y = rowTop;
        });
        
        // Sayfa numarası
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc.fontSize(8).font('Helvetica').text(
            `Sayfa ${i + 1} / ${totalPages}`,
            50,
            doc.page.height - 50,
            { align: 'center' }
          );
        }
        
        // PDF'i sonlandır
        doc.end();
        
        // Stream tamamlandığında resolve et
        stream.on('finish', () => {
          logger.info(`PDF raporu oluşturuldu: ${filePath}`);
          resolve(filePath);
        });
        
        // Hata durumunda reject et
        stream.on('error', (err) => {
          logger.error(`PDF raporu oluşturma hatası: ${err.message}`);
          reject(err);
        });
        
      } catch (error) {
        logger.error(`PDF raporu oluşturma hatası: ${error.message}`);
        reject(error);
      }
    });
  }
}

module.exports = PDFGenerator;
