const PDFGenerator = require('../../utils/pdf');
const Document = require('../../models/Document');
const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs');

/**
 * PDF servisi
 */
class PDFService {
  /**
   * Evrak için PDF oluşturur
   * @param {Object|string} document - Evrak nesnesi veya ID
   * @returns {Promise<string>} PDF dosya yolu
   */
  async generateDocumentPDF(document) {
    try {
      // Eğer ID gönderildiyse evrakı getir
      if (typeof document === 'string') {
        document = await Document.findById(document);
        if (!document) {
          throw new Error('Evrak bulunamadı');
        }
      }
      
      // Uploads klasörünü kontrol et
      const uploadsDir = path.join(__dirname, '../../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // PDF klasörünü kontrol et
      const pdfDir = path.join(uploadsDir, 'pdf');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }
      
      // PDF dosya yolu
      const fileName = `document-${document._id}-${Date.now()}.pdf`;
      const filePath = path.join(pdfDir, fileName);
      
      // PDF oluştur
      await PDFGenerator.generateDocumentPDF(document, filePath);
      
      logger.info(`PDF oluşturuldu: ${filePath}`);
      
      return filePath;
    } catch (error) {
      logger.error(`PDF oluşturma hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Evrak listesi için PDF raporu oluşturur
   * @param {Array<Object>|Object} documents - Evrak listesi veya filtre nesnesi
   * @param {Object} options - Rapor seçenekleri
   * @returns {Promise<string>} PDF dosya yolu
   */
  async generateDocumentListPDF(documents, options = {}) {
    try {
      // Eğer filtre nesnesi gönderildiyse evrakları getir
      if (!Array.isArray(documents) && typeof documents === 'object') {
        const filters = documents;
        
        const query = {};
        
        // Filtreler
        if (filters.status) {
          query.status = filters.status;
        }
        
        if (filters.documentType) {
          query.documentType = filters.documentType;
        }
        
        if (filters.createdBy) {
          query.createdBy = filters.createdBy;
        }
        
        if (filters.search) {
          query.$or = [
            { title: { $regex: filters.search, $options: 'i' } },
            { documentNumber: { $regex: filters.search, $options: 'i' } }
          ];
        }
        
        // Tarih aralığı
        if (filters.startDate || filters.endDate) {
          query.createdAt = {};
          
          if (filters.startDate) {
            query.createdAt.$gte = new Date(filters.startDate);
          }
          
          if (filters.endDate) {
            query.createdAt.$lte = new Date(filters.endDate);
          }
        }
        
        // Evrakları getir
        documents = await Document.find(query)
          .sort({ createdAt: -1 })
          .limit(filters.limit || 100);
        
        // Filtre bilgilerini options'a ekle
        options.filters = filters;
      }
      
      // Uploads klasörünü kontrol et
      const uploadsDir = path.join(__dirname, '../../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // PDF klasörünü kontrol et
      const pdfDir = path.join(uploadsDir, 'pdf');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }
      
      // PDF dosya yolu
      const fileName = `document-list-${Date.now()}.pdf`;
      const filePath = path.join(pdfDir, fileName);
      
      // PDF oluştur
      await PDFGenerator.generateDocumentListPDF(documents, options, filePath);
      
      logger.info(`PDF raporu oluşturuldu: ${filePath}`);
      
      return filePath;
    } catch (error) {
      logger.error(`PDF raporu oluşturma hatası: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new PDFService();
