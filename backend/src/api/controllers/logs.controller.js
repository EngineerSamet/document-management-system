const Log = require('../../models/Log');
const logger = require('../../config/logger');
const { ValidationError } = require('../../utils/errors');

/**
 * Log Controller
 * Sistem log kayıtlarını yönetir
 */
class LogsController {
  /**
   * Tüm log kayıtlarını sayfalama ve filtreleme ile getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getLogs(req, res, next) {
    try {
      logger.info('LogsController.getLogs çağrıldı');
      
      // Query parametrelerini al
      const { 
        page = 1, 
        limit = 50, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        level, // log seviyesi: info, warning, error, critical
        module, // log modülü: auth, document, approval, user, system
        category, // log kategorisi
        searchTerm, // arama terimi
        dateFrom, // başlangıç tarihi
        dateTo, // bitiş tarihi
        userEmail // kullanıcı e-posta adresi
      } = req.query;
      
      // Sayfa ve limit değerlerini sayıya çevir
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      
      // Geçerli değerler kontrolü
      if (isNaN(pageNum) || pageNum < 1) {
        throw new ValidationError('Geçersiz sayfa numarası');
      }
      
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new ValidationError('Geçersiz limit değeri (1-100 arası olmalı)');
      }
      
      // Sıralama yönünü kontrol et
      const sortDirection = sortOrder === 'asc' ? 1 : -1;
      
      // Filtreleme için sorgu nesnesi oluştur
      const query = {};
      
      // Log seviyesi filtresi
      if (level && level !== 'all') {
        query.level = level;
      }
      
      // Modül filtresi - entityType ve action'a göre filtreleme
      if (module && module !== 'all') {
        // Roadmap'e göre düzenlenmiş modül filtreleme mantığı
        switch (module) {
          case 'auth':
            // Kimlik Doğrulama (AUTH) modülü için filtreleme
            query.$or = [
              { action: { $regex: 'login', $options: 'i' } },
              { action: { $regex: 'logout', $options: 'i' } },
              { action: { $regex: 'token', $options: 'i' } },
              { action: { $regex: 'password_reset', $options: 'i' } },
              { action: { $regex: 'auth', $options: 'i' } }
            ];
            break;
            
          case 'user':
            // Kullanıcı (USER) modülü için filtreleme
            query.$or = [
              { entityType: 'user' },
              { action: { $regex: 'user_', $options: 'i' } },
              { action: { $regex: 'role_', $options: 'i' } },
              { action: { $regex: 'permission', $options: 'i' } }
            ];
            break;
            
          case 'approval':
            // Onay (APPROVAL) modülü için filtreleme
            query.$or = [
              { entityType: 'approvalFlow' },
              { action: { $regex: 'approval', $options: 'i' } },
              { action: { $regex: 'approve', $options: 'i' } },
              { action: { $regex: 'reject', $options: 'i' } },
              { action: { $regex: 'submit_for_approval', $options: 'i' } }
            ];
            break;
            
          case 'document':
            // Belge (DOCUMENT) modülü için filtreleme - onay işlemleri hariç
            query.$and = [
              { entityType: 'document' },
              { 
                action: { 
                  $not: {
                    $regex: '(approve|reject|approval)', 
                    $options: 'i'
                  }
                }
              }
            ];
            break;
            
          case 'system':
            // Sistem (SYSTEM) modülü için filtreleme
            query.$or = [
              { entityType: 'system' },
              { action: { $regex: 'system_', $options: 'i' } },
              { action: { $regex: 'error', $options: 'i' } },
              { action: { $regex: 'config', $options: 'i' } },
              { action: { $regex: 'database', $options: 'i' } },
              { action: { $regex: 'service_', $options: 'i' } },
              { action: { $regex: 'api_', $options: 'i' } }
            ];
            break;
            
          case 'file':
            // Dosya (FILE) modülü için filtreleme
            query.$or = [
              { action: { $regex: 'file_', $options: 'i' } },
              { action: { $regex: 'upload', $options: 'i' } },
              { action: { $regex: 'download', $options: 'i' } }
            ];
            break;
            
          case 'audit':
            // Denetim (AUDIT) modülü için filtreleme
            query.$or = [
              { action: { $regex: 'audit', $options: 'i' } },
              { action: { $regex: 'security', $options: 'i' } },
              { level: 'critical' }
            ];
            break;
            
          case 'search':
            // Arama (SEARCH) modülü için filtreleme
            query.$or = [
              { action: { $regex: 'search', $options: 'i' } }
            ];
            break;
            
          default:
            // Diğer modüller için doğrudan entityType kullan
            query.entityType = module;
        }
      }
      
      // Kategori filtresi
      if (category && category !== 'all') {
        // Eğer modül filtresi ile birlikte kullanılıyorsa, $and kullan
        if (query.$or) {
          query.$and = [
            { $or: query.$or },
            { action: category }
          ];
          delete query.$or;
        } else if (query.$and) {
          // Zaten $and varsa, yeni koşul ekle
          query.$and.push({ action: category });
        } else {
          // Yoksa doğrudan ekle
          query.action = category;
        }
      }
      
      // Arama filtresi
      if (searchTerm) {
        const searchQuery = [
          { description: { $regex: searchTerm, $options: 'i' } },
          { action: { $regex: searchTerm, $options: 'i' } }
        ];
        
        // Sorgu yapısına göre birleştir
        if (query.$or && !query.$and) {
          query.$and = [
            { $or: query.$or },
            { $or: searchQuery }
          ];
          delete query.$or;
        } else if (query.$and) {
          query.$and.push({ $or: searchQuery });
        } else {
          query.$or = searchQuery;
        }
      }
      
      // Tarih filtresi
      if (dateFrom || dateTo) {
        query.createdAt = {};
        
        if (dateFrom) {
          query.createdAt.$gte = new Date(dateFrom);
        }
        
        if (dateTo) {
          // Bitiş tarihini günün sonuna ayarla
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = endDate;
        }
      }
      
      // Kullanıcı e-posta filtresi
      if (userEmail) {
        // Önce kullanıcıyı e-posta ile bul
        const User = require('../../models/User');
        try {
          const user = await User.findOne({ email: { $regex: userEmail, $options: 'i' } });
          if (user) {
            // Kullanıcı bulunduysa, userId ile filtrele
            if (query.$and) {
              query.$and.push({ userId: user._id });
            } else {
              query.userId = user._id;
            }
          } else {
            // Kullanıcı bulunamadıysa, boş sonuç döndürecek bir koşul ekle
            if (query.$and) {
              query.$and.push({ userId: null });
            } else {
              query.userId = null;
            }
          }
        } catch (error) {
          logger.error(`Kullanıcı e-posta filtresi hatası: ${error.message}`);
          // Hata durumunda filtrelemeyi atla
        }
      }
      
      // Debug: Oluşturulan sorguyu logla
      logger.debug(`Oluşturulan sorgu: ${JSON.stringify(query)}`);
      
      // Toplam kayıt sayısını al
      const total = await Log.countDocuments(query);
      
      // Sayfalama için skip değerini hesapla
      const skip = (pageNum - 1) * limitNum;
      
      // Toplam sayfa sayısını hesapla
      const totalPages = Math.ceil(total / limitNum);
      
      // Log kayıtlarını getir
      const logs = await Log.find(query)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'firstName lastName email')
        .lean();
      
      // Kullanıcı dostu log kayıtları oluştur
      const formattedLogs = logs.map(log => {
        // Modül bilgisini belirle - Roadmap'e göre düzenlenmiş
        let logModule = log.entityType;
        
        // Onay akışı logları için özel işlem
        if (log.entityType === 'approvalFlow' || log.action.includes('approval') || 
            log.action === 'approve' || log.action === 'reject' || 
            log.action === 'submit_for_approval') {
          logModule = 'approval';
        }
        
        // Auth logları için özel işlem
        if (log.action.includes('login') || log.action.includes('logout') || 
            log.action.includes('token') || log.action.includes('password_reset')) {
          logModule = 'auth';
        }
        
        // Kullanıcı logları için özel işlem
        if (log.entityType === 'user' || log.action.startsWith('user_') ||
            log.action.includes('role_') || log.action.includes('permission')) {
          logModule = 'user';
        }
        
        // Sistem logları için özel işlem
        if (log.entityType === 'system' || log.action.includes('error') || 
            log.action.includes('config') || log.action.includes('database')) {
          logModule = 'system';
        }
        
        // Dosya logları için özel işlem
        if (log.action.includes('file_') || log.action.includes('upload') || 
            log.action.includes('download')) {
          logModule = 'file';
        }
        
        // Arama logları için özel işlem
        if (log.action.includes('search')) {
          logModule = 'search';
        }
        
        // Denetim logları için özel işlem
        if (log.action.includes('audit') || log.action.includes('security') || 
            log.level === 'critical') {
          logModule = 'audit';
        }
        
        return {
          id: log._id,
          timestamp: log.createdAt,
          level: log.level,
          module: logModule, // Belirlenen modül
          entityType: log.entityType, // Orijinal entityType
          action: log.action,
          message: log.description,
          details: log.metadata,
          userId: log.userId?._id,
          userName: log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : null,
          userEmail: log.userId?.email || null
        };
      });
      
      res.status(200).json({
        status: 'success',
        results: logs.length,
        pagination: {
          total,
          totalPages,
          currentPage: pageNum,
          limit: limitNum
        },
        logs: formattedLogs
      });
    } catch (error) {
      logger.error(`Log kayıtlarını getirme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Son etkinlikleri getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getRecentActivities(req, res, next) {
    try {
      logger.info('LogsController.getRecentActivities çağrıldı');
      
      const { limit = 10 } = req.query;
      const limitNum = parseInt(limit, 10) || 10;
      
      // Son etkinlikleri getir
      const logs = await Log.find({ level: 'info' })
        .sort({ createdAt: -1 })
        .limit(Math.min(limitNum, 50))
        .populate('userId', 'firstName lastName email')
        .lean();
      
      // Kullanıcı dostu etkinlikler oluştur
      const activities = logs.map(log => {
        // Kullanıcı adı
        const userName = log.userId 
          ? `${log.userId.firstName} ${log.userId.lastName}`
          : 'Sistem';
        
        // Etkinlik mesajı
        let message = log.description;
        
        // Etkinlik tipi ve içeriğine göre özel mesaj oluştur
        if (log.entityType === 'user' && log.action === 'create') {
          message = `Yeni kullanıcı oluşturuldu: ${log.metadata?.userName || 'İsimsiz Kullanıcı'}`;
        } else if (log.entityType === 'document' && log.action === 'approve') {
          message = `Belge onaylandı: ${log.metadata?.documentTitle || 'İsimsiz Belge'}`;
        } else if (log.entityType === 'document' && log.action === 'reject') {
          message = `Belge reddedildi: ${log.metadata?.documentTitle || 'İsimsiz Belge'}`;
        } else if (log.entityType === 'approvalFlow' && log.action === 'create') {
          message = `Yeni onay akışı oluşturuldu: ${log.metadata?.flowName || 'İsimsiz Akış'}`;
        }
        
        return {
          id: log._id,
          timestamp: log.createdAt,
          message,
          user: userName,
          entityType: log.entityType,
          action: log.action
        };
      });
      
      res.status(200).json({
        status: 'success',
        results: activities.length,
        activities
      });
    } catch (error) {
      logger.error(`Son etkinlikleri getirme hatası: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new LogsController();