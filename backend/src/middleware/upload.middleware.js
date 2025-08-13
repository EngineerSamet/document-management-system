const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Yükleme dizinini oluştur
const createUploadDir = () => {
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

// Dosya depolama ayarları
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = createUploadDir();
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Benzersiz dosya adı oluştur
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `${file.fieldname}-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// Dosya filtresi
const fileFilter = (req, file, cb) => {
  // İzin verilen dosya tipleri
  const allowedFileTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Desteklenmeyen dosya formatı. Sadece PDF, JPEG, PNG, DOC ve DOCX dosyaları yüklenebilir.'), false);
  }
};

// Dosya boyutu limiti (10 MB)
const limits = {
  fileSize: 10 * 1024 * 1024
};

// Multer upload nesnesi
const upload = multer({
  storage,
  fileFilter,
  limits
});

// Dosya yükleme middleware'i
const uploadMiddleware = {
  // Tek dosya yükleme
  single: (fieldName = 'file') => {
    return (req, res, next) => {
      const singleUpload = upload.single(fieldName);
      
      singleUpload(req, res, (err) => {
        if (err) {
          logger.error(`Dosya yükleme hatası: ${err.message}`);
          return res.status(400).json({
            status: 'error',
            message: err.message
          });
        }
        
        // Dosya yüklendi mi kontrol et
        if (req.file) {
          logger.info(`Dosya yüklendi: ${req.file.originalname}, ${req.file.size} bytes`);
        }
        
        next();
      });
    };
  },
  
  // Çoklu dosya yükleme
  array: (fieldName = 'files', maxCount = 5) => {
    return (req, res, next) => {
      const arrayUpload = upload.array(fieldName, maxCount);
      
      arrayUpload(req, res, (err) => {
        if (err) {
          logger.error(`Dosya yükleme hatası: ${err.message}`);
          return res.status(400).json({
            status: 'error',
            message: err.message
          });
        }
        
        // Dosyalar yüklendi mi kontrol et
        if (req.files && req.files.length > 0) {
          logger.info(`${req.files.length} dosya yüklendi`);
        }
        
        next();
      });
    };
  }
};

module.exports = uploadMiddleware; 