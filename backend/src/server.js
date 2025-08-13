const express = require('express'); //Web sunucusunu oluşturur
const cors = require('cors');//Farklı kaynaklardan gelen istekleri kontrol eder.
const morgan = require('morgan'); //HTTP isteklerini loglar.
const path = require('path'); //Dosya yollarını işler.
const { createWriteStream } = require('fs'); //Dosya yazma işlemlerini yapar.
const connectDB = require('./config/database'); //Veritabanı bağlantısını yapar.
const errorHandler = require('./middleware/error.middleware'); //Hataları işler.
const { applySecurityMiddleware } = require('./middleware/security.middleware'); //Güvenlik için bazı kontroller ekleniyor (Helmet, RateLimit gibi).
const logger = require('./config/logger');//Loglama işlemlerini yapar.


// Hata ayıklama için
console.log('Server.js başlatılıyor...');
console.log('Node.js sürümü:', process.version);
console.log('Çalışma dizini:', process.cwd());
console.log('Ortam değişkenleri:', Object.keys(process.env).filter(key => !key.includes('SECRET')));

// Punycode uyarısını bastır
process.env.NODE_NO_WARNINGS = '1';

// Ortam değişkenlerini yükle
require('dotenv').config();

// Express uygulaması oluştur
const app = express();

// CORS ayarları
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions)); //Frontend ile backend farklı portlarda çalışabilir Bu durumda CORS devreye girer: bu yapı, 
//tarayıcıda güvenli veri alışverişi yapılmasını sağlar.

// Güvenlik middleware'lerini uygula
try {
  console.log('Güvenlik middleware\'leri uygulanıyor...');
  applySecurityMiddleware(app); //middleware/security.middleware.js dosyasına bakarak detaylarını anlayabilirsin.
  console.log('Güvenlik middleware\'leri başarıyla uygulandı');
} catch (error) {
  console.error('Güvenlik middleware uygulama hatası:', error);
  logger.error('Güvenlik middleware uygulama hatası:', error);
}

// JSON ve URL-encoded parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Morgan logger - HTTP isteklerini logla
const logsDir = path.join(__dirname, '../logs');
try {
  const accessLogStream = createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });
  app.use(morgan('combined', { stream: accessLogStream })); //Tüm gelen HTTP isteklerini logs/access.log dosyasına kaydeder.
} catch (error) {
  console.warn('Log dosyası oluşturulamadı:', error.message);
  logger.warn('Log dosyası oluşturulamadı:', error.message);
}
app.use(morgan('dev'));

// Statik dosyalar
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API rotaları
//Gelen istekleri ilgili route dosyalarına yönlendiriyor.
app.use('/api/auth', require('./api/routes/auth.routes'));
app.use('/api/users', require('./api/routes/user.routes'));
app.use('/api/documents', require('./api/routes/document.routes'));
app.use('/api/approval-flows', require('./api/routes/approval.routes'));
app.use('/api/admin', require('./api/routes/admin.routes'));

// Yeni eklenen rotalar
try {
  // Logs rotaları
  app.use('/api/logs', require('./api/routes/logs.routes'));
  console.log('Logs rotaları başarıyla yüklendi');
  
  // Activities rotaları
  app.use('/api/activities', require('./api/routes/activity.routes'));
  console.log('Activities rotaları başarıyla yüklendi');
} catch (error) {
  console.error('Rota yükleme hatası:', error.message);
  logger.error('Rota yükleme hatası:', error);
}

// API durumu için basit endpoint
//"API çalışıyor mu?" sorusunun cevabını veren basit bir endpoint. 
app.get('/api/status', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Hata işleyici
app.use(errorHandler);//middleware/error.middleware.js içeriğine bakman gerek.

// Veritabanı bağlantısı
try {
  console.log('Veritabanı bağlantısı başlatılıyor...');
  logger.info('Veritabanı bağlantısı başlatılıyor...');
  
  // Sunucuyu başlat
  const PORT = process.env.PORT || 5000;
  
  // Önce sunucuyu başlat, sonra veritabanına bağlan
  console.log(`Sunucu ${PORT} portunda başlatılıyor...`);
  const server = app.listen(PORT, () => {
    console.log(`Sunucu başarıyla ${PORT} portunda başlatıldı`);
    logger.info(`Server running on port ${PORT}`);
    console.log(`API durumu: http://localhost:${PORT}/api/status`);
    
    // Sunucu başladıktan sonra veritabanına bağlan
    console.log('Veritabanı bağlantısı deneniyor...');
    connectDB()
      .then(() => {
        console.log('Veritabanı bağlantısı başarılı!');
        logger.info('Veritabanı bağlantısı başarılı!');
      })
      .catch(err => {
        console.error('Veritabanı bağlantı hatası:', err.message);
        console.error('Hata detayları:', err.stack);
        logger.error('Veritabanı bağlantı hatası:', err);
        console.log('Veritabanı bağlantısı olmadan sunucu çalışmaya devam edecek');
        logger.warn('Veritabanı bağlantısı olmadan sunucu çalışmaya devam edecek');
      });
  });
  
  // Sunucu hata olayını dinle
  server.on('error', (error) => {
    console.error('Sunucu başlatma hatası:', error.message);
    console.error('Hata detayları:', error.stack);
    logger.error('Sunucu başlatma hatası:', error);
  });
  
  // Sunucu kapatma olayını dinle
  server.on('close', () => {
    console.log('Sunucu kapatıldı');
    logger.info('Sunucu kapatıldı');
  });
  
} catch (error) {
  console.error('Sunucu başlatma hatası:', error.message);
  console.error('Hata detayları:', error.stack);
  logger.error('Sunucu başlatma hatası:', error);
}

// Beklenmeyen hata işleyici
process.on('unhandledRejection', (err, promise) => {
  console.error('Yakalanmamış Promise Reddi:', err);
  console.error('Stack trace:', err.stack);
  logger.error(`Unhandled Rejection: ${err.message}`, { stack: err.stack });
  // Uygulamayı çöktürmek yerine hatayı logla
  console.error('Promise detayları:', promise);
});

// Çıkış olayını dinle
process.on('exit', (code) => {
  console.log(`Sunucu ${code} kodu ile kapanıyor`);
  logger.info(`Sunucu ${code} kodu ile kapanıyor`);
});

// Beklenmeyen istisnaları yakala
process.on('uncaughtException', (err, origin) => {
  console.error('Beklenmeyen hata:', err);
  console.error('Hata kaynağı:', origin);
  console.error('Stack trace:', err.stack);
  logger.error('Beklenmeyen hata:', { error: err.message, stack: err.stack, origin });
  
  // Çökmeyi önle ama kontrollü şekilde kapat
  console.log('Sunucu kontrollü şekilde kapatılıyor...');
  setTimeout(() => {
    console.log('Sunucu kapatılıyor...');
    process.exit(1);
  }, 5000); // 5 saniye bekle
});

// SIGTERM sinyalini yakala
process.on('SIGTERM', () => {
  console.log('SIGTERM sinyali alındı. Sunucu kapatılıyor...');
  logger.info('SIGTERM sinyali alındı. Sunucu kapatılıyor...');
});

// SIGINT sinyalini yakala (Ctrl+C)
process.on('SIGINT', () => {
  console.log('SIGINT sinyali alındı. Sunucu kapatılıyor...');
  logger.info('SIGINT sinyali alındı. Sunucu kapatılıyor...');
});

module.exports = app;
