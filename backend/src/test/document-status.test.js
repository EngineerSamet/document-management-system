/**
 * Belge Durumu Test Dosyası
 * 
 * Bu test, belge durumu enum değerlerinin doğru çalıştığını kontrol eder.
 * Özellikle 'in_review' değerinin geçerli olduğunu doğrular.
 */

const { DocumentStatus } = require('../interfaces/IDocument');
const Document = require('../models/Document');

// Belge durumu enum değerlerini kontrol et
console.log('DocumentStatus değerleri:', DocumentStatus);
console.log('IN_REVIEW değeri:', DocumentStatus.IN_REVIEW);

// Document modelindeki status alanının enum değerlerini kontrol et
console.log('Document status enum değerleri:', Document.schema.path('status').enumValues);

// Test: Belge oluştur ve in_review durumunu ayarla
const testDocument = () => {
  try {
    // Yeni bir belge örneği oluştur
    const doc = new Document({
      title: 'Test Belgesi',
      description: 'Bu bir test belgesidir',
      filePath: '/test/path',
      fileName: 'test.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      status: 'in_review',
      createdBy: '507f1f77bcf86cd799439011' // Örnek ObjectId
    });
    
    // Belge durumunu kontrol et
    console.log('Belge durumu:', doc.status);
    
    // Validasyon yap
    const validationError = doc.validateSync();
    if (validationError) {
      console.error('Validasyon hatası:', validationError);
    } else {
      console.log('Validasyon başarılı!');
    }
    
    return !validationError;
  } catch (error) {
    console.error('Test hatası:', error);
    return false;
  }
};

// Testi çalıştır
const result = testDocument();
console.log('Test sonucu:', result ? 'BAŞARILI' : 'BAŞARISIZ');

// Test sonucunu döndür (0: başarılı, 1: başarısız)
process.exit(result ? 0 : 1); 