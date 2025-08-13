const mongoose = require('mongoose');
const Log = require('../../models/Log');
const User = require('../../models/User');
const Document = require('../../models/Document');
const ApprovalFlow = require('../../models/ApprovalFlow');
const logger = require('../../config/logger');
const { NotFoundError } = require('../../utils/errors');

/**
 * Etkinlik Servisi
 * Kullanıcı etkinliklerini loglama ve sorgulama işlemlerini yönetir
 */
class ActivityService {
  /**
   * Kullanıcı etkinliği oluşturur
   * @param {String} userId - Kullanıcı ID
   * @param {String} action - Yapılan işlem (created, updated, approved, rejected, etc.)
   * @param {String} entityType - İşlem yapılan varlık tipi (document, user, approvalFlow, etc.)
   * @param {String} entityId - İşlem yapılan varlık ID
   * @param {String} description - Etkinlik açıklaması
   * @param {Object} metadata - Ek bilgiler
   * @returns {Promise<Object>} Oluşturulan log kaydı
   */
  async createActivity(userId, action, entityType, entityId, description, metadata = {}) {
    try {
      logger.debug(`ActivityService.createActivity çağrıldı: ${userId}, ${action}, ${entityType}, ${entityId}`);
      
      // Log oluştur
      const log = await Log.create({
        userId,
        action,
        entityType,
        entityId,
        description,
        metadata,
        level: 'info'
      });
      
      return log;
    } catch (error) {
      logger.error(`Etkinlik oluşturma hatası: ${error.message}`);
      // Hata olsa bile uygulamanın çalışmasını engellemiyoruz
      return null;
    }
  }
  
  /**
   * Son etkinlikleri getirir
   * @param {Object} options - Sorgu seçenekleri
   * @param {Number} options.limit - Maksimum kayıt sayısı
   * @param {String} options.entityType - Varlık tipi filtresi (opsiyonel)
   * @param {String} options.action - İşlem tipi filtresi (opsiyonel)
   * @returns {Promise<Array>} Etkinlik listesi
   */
  async getRecentActivities(options = { limit: 10 }) {
    try {
      const { limit = 10, entityType, action } = options;
      
      // Filtreleri oluştur
      const filter = {};
      
      if (entityType) {
        filter.entityType = entityType;
      }
      
      if (action) {
        filter.action = action;
      }
      
      // Logları getir ve kullanıcı bilgilerini doldur
      const activities = await Log.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'firstName lastName email')
        .lean();
      
      // Varlık bilgilerini ekle
      const enrichedActivities = await Promise.all(
        activities.map(async (activity) => {
          const enriched = { ...activity };
          
          // Varlık tipine göre ek bilgileri getir
          if (activity.entityType === 'document' && activity.entityId) {
            try {
              const document = await Document.findById(activity.entityId).select('title fileType').lean();
              if (document) {
                enriched.entityDetails = {
                  title: document.title,
                  fileType: document.fileType
                };
              }
            } catch (err) {
              logger.debug(`Belge detayları getirilemedi: ${err.message}`);
            }
          } else if (activity.entityType === 'approvalFlow' && activity.entityId) {
            try {
              const flow = await ApprovalFlow.findById(activity.entityId).select('name flowType').lean();
              if (flow) {
                enriched.entityDetails = {
                  name: flow.name,
                  flowType: flow.flowType
                };
              }
            } catch (err) {
              logger.debug(`Onay akışı detayları getirilemedi: ${err.message}`);
            }
          }
          
          // Kullanıcı dostu mesaj oluştur
          enriched.friendlyMessage = this.createFriendlyMessage(enriched);
          
          return enriched;
        })
      );
      
      return enrichedActivities;
    } catch (error) {
      logger.error(`Son etkinlikleri getirme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Kullanıcı dostu mesaj oluşturur
   * @param {Object} activity - Etkinlik nesnesi
   * @returns {String} Kullanıcı dostu mesaj
   */
  createFriendlyMessage(activity) {
    try {
      const userName = activity.userId 
        ? `${activity.userId.firstName} ${activity.userId.lastName}`
        : 'Sistem';
      
      const entityName = activity.entityDetails
        ? (activity.entityDetails.title || activity.entityDetails.name || 'Belirtilmemiş')
        : 'Belirtilmemiş';
      
      // Eylem ve varlık tipine göre mesaj oluştur
      switch (activity.action) {
        case 'create':
          return `${userName}, ${this.getEntityTypeInTurkish(activity.entityType)} oluşturdu: ${entityName}`;
        
        case 'update':
          return `${userName}, ${this.getEntityTypeInTurkish(activity.entityType)} güncelledi: ${entityName}`;
        
        case 'delete':
          return `${userName}, ${this.getEntityTypeInTurkish(activity.entityType)} sildi: ${entityName}`;
        
        case 'approve':
          return `${userName}, ${this.getEntityTypeInTurkish(activity.entityType)} onayladı: ${entityName}`;
        
        case 'reject':
          return `${userName}, ${this.getEntityTypeInTurkish(activity.entityType)} reddetti: ${entityName}`;
        
        case 'login':
          return `${userName} sisteme giriş yaptı`;
        
        case 'logout':
          return `${userName} sistemden çıkış yaptı`;
        
        default:
          return activity.description || `${userName} bir işlem gerçekleştirdi`;
      }
    } catch (error) {
      logger.error(`Kullanıcı dostu mesaj oluşturma hatası: ${error.message}`);
      return activity.description || 'Bilinmeyen etkinlik';
    }
  }
  
  /**
   * Varlık tipinin Türkçe karşılığını döndürür
   * @param {String} entityType - Varlık tipi
   * @returns {String} Türkçe karşılık
   */
  getEntityTypeInTurkish(entityType) {
    const types = {
      'document': 'belge',
      'user': 'kullanıcı',
      'approvalFlow': 'onay akışı',
      'system': 'sistem'
    };
    
    return types[entityType] || entityType;
  }
}

module.exports = new ActivityService(); 