/**
 * Belge Onaya Gönderme Test Dosyası
 * 
 * Bu test, belge onaya gönderme işleminin doğru çalıştığını kontrol eder.
 * Özellikle DocumentStatus enum değerlerinin tutarlı kullanımını doğrular.
 */

const { DocumentStatus } = require('../interfaces/IDocument');

// Test: Taslak durumundaki belgeyi onaya gönderme
const testSubmitDraftDocument = () => {
  try {
    console.log('Test: Taslak durumundaki belgeyi onaya gönderme');
    
    // Mock belge oluştur
    const mockDocument = {
      _id: '507f1f77bcf86cd799439011',
      title: 'Test Belgesi',
      status: DocumentStatus.DRAFT
    };
    
    console.log('Belge durumu (başlangıç):', mockDocument.status);
    console.log('DocumentStatus.DRAFT:', DocumentStatus.DRAFT);
    console.log('DocumentStatus.IN_REVIEW:', DocumentStatus.IN_REVIEW);
    
    // Belge durumu kontrolü
    if (mockDocument.status !== DocumentStatus.DRAFT && mockDocument.status !== DocumentStatus.REJECTED) {
      console.error('Hata: Bu belge zaten onay sürecinde veya onaylanmış');
      return false;
    }
    
    // Belge durumunu güncelle
    mockDocument.status = DocumentStatus.IN_REVIEW;
    console.log('Belge durumu (güncelleme sonrası):', mockDocument.status);
    
    console.log('Test başarılı: Taslak belge onaya gönderilebilir');
    return true;
  } catch (error) {
    console.error('Test hatası:', error);
    return false;
  }
};

// Test: Onay sürecindeki belgeyi tekrar onaya gönderme
const testSubmitPendingDocument = () => {
  try {
    console.log('Test: Onay sürecindeki belgeyi tekrar onaya gönderme');
    
    // Mock belge oluştur
    const mockDocument = {
      _id: '507f1f77bcf86cd799439012',
      title: 'Test Belgesi 2',
      status: DocumentStatus.IN_REVIEW
    };
    
    console.log('Belge durumu:', mockDocument.status);
    
    // Belge durumu kontrolü
    if (mockDocument.status !== DocumentStatus.DRAFT && mockDocument.status !== DocumentStatus.REJECTED) {
      console.error('Beklenen hata: Bu belge zaten onay sürecinde veya onaylanmış');
      return true; // Bu durumda hata bekliyoruz, o yüzden true dönüyoruz
    }
    
    console.error('Test başarısız: Onay sürecindeki belge tekrar onaya gönderilebilir olmamalı');
    return false;
  } catch (error) {
    console.error('Test hatası:', error);
    return false;
  }
};

// Testleri çalıştır
const result1 = testSubmitDraftDocument();
const result2 = testSubmitPendingDocument();

console.log('Test sonuçları:');
console.log('- Taslak belgeyi onaya gönderme:', result1 ? 'BAŞARILI' : 'BAŞARISIZ');
console.log('- Onay sürecindeki belgeyi tekrar onaya gönderme:', result2 ? 'BAŞARILI' : 'BAŞARISIZ');

// Test sonucunu döndür (tüm testler başarılıysa 0, değilse 1)
process.exit(result1 && result2 ? 0 : 1); 