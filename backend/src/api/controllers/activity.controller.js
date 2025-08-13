const activityService = require('../services/activity.service');
const logger = require('../../config/logger');

/**
 * Etkinlik Controller
 * Kullanıcı etkinliklerini yönetir
 */
class ActivityController {
  /**
   * Son etkinlikleri getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getRecentActivities(req, res, next) {
    try {
      logger.info('ActivityController.getRecentActivities çağrıldı');
      
      const { limit = 10, entityType, action } = req.query;
      
      // Limit değerini sayıya çevir
      const limitNum = parseInt(limit, 10) || 10;
      
      const activities = await activityService.getRecentActivities({
        limit: Math.min(limitNum, 50), // Maksimum 50 kayıt getir
        entityType,
        action
      });
      
      res.status(200).json({
        status: 'success',
        results: activities.length,
        data: { activities }
      });
    } catch (error) {
      logger.error(`Son etkinlikleri getirme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Kullanıcının son etkinliklerini getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getUserActivities(req, res, next) {
    try {
      logger.info(`ActivityController.getUserActivities çağrıldı: userId=${req.params.userId}`);
      
      const { userId } = req.params;
      const { limit = 10 } = req.query;
      
      // Limit değerini sayıya çevir
      const limitNum = parseInt(limit, 10) || 10;
      
      // Log modelini doğrudan kullan
      const Log = require('../../models/Log');
      
      const activities = await Log.find({ userId })
        .sort({ createdAt: -1 })
        .limit(Math.min(limitNum, 50))
        .populate('userId', 'firstName lastName email')
        .lean();
      
      // Kullanıcı dostu mesajlar ekle
      const enrichedActivities = activities.map(activity => {
        return {
          ...activity,
          friendlyMessage: activityService.createFriendlyMessage(activity)
        };
      });
      
      res.status(200).json({
        status: 'success',
        results: enrichedActivities.length,
        data: { activities: enrichedActivities }
      });
    } catch (error) {
      logger.error(`Kullanıcı etkinliklerini getirme hatası: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Dashboard için özet etkinlik verileri getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getDashboardActivities(req, res, next) {
    try {
      logger.info('ActivityController.getDashboardActivities çağrıldı');
      
      // Son etkinlikleri getir
      const recentActivities = await activityService.getRecentActivities({
        limit: 10
      });
      
      res.status(200).json({
        status: 'success',
        data: { activities: recentActivities }
      });
    } catch (error) {
      logger.error(`Dashboard etkinliklerini getirme hatası: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new ActivityController(); 