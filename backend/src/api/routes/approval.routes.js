const express = require('express');
const approvalService = require('../services/approval.service');
const authMiddleware = require('../../middleware/auth.middleware');
const { ROLES, checkRole } = require('../../middleware/role.middleware');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * Onay Akışı Rotaları
 */

// Tüm rotalarda kimlik doğrulama gerekli
router.use(authMiddleware.protect);

/**
 * @route GET /api/approval-flows
 * @desc Tüm onay akışlarını getirir
 * @access Private
 */
router.get('/', async (req, res, next) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };
    
    const result = await approvalService.getAllApprovalFlows(options);
    
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error(`Onay akışları getirme hatası: ${error.message}`);
    next(error);
  }
});

/**
 * @route GET /api/approval-flows/:documentId
 * @desc Belgeye ait onay akışını getirir
 * @access Private
 */
router.get('/:documentId', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    
    const approvalFlow = await approvalService.getApprovalFlow(documentId);
    
    res.status(200).json({
      status: 'success',
      data: approvalFlow
    });
  } catch (error) {
    logger.error(`Onay akışı getirme hatası: ${error.message}`);
    next(error);
  }
});

/**
 * @route POST /api/approval-flows
 * @desc Yeni bir onay akışı oluşturur
 * @access Private/Manager,Admin
 */
router.post(
  '/',
  checkRole([ROLES.MANAGER, ROLES.ADMIN]),
  async (req, res, next) => {
    try {
      const { documentId, approverIds } = req.body;
      
      const approvalFlow = await approvalService.createApprovalFlow(
        documentId,
        req.user.id,
        approverIds
      );
      
      res.status(201).json({
        status: 'success',
        message: 'Onay akışı başarıyla oluşturuldu',
        data: approvalFlow
      });
    } catch (error) {
      logger.error(`Onay akışı oluşturma hatası: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route POST /api/approval-flows/:documentId/approve
 * @desc Belgeyi onaylar
 * @access Private
 */
router.post('/:documentId/approve', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { comment } = req.body;
    
    const approvalFlow = await approvalService.processApprovalAction(
      documentId,
      req.user.id,
      'approve',
      comment
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Belge başarıyla onaylandı',
      data: approvalFlow
    });
  } catch (error) {
    logger.error(`Belge onaylama hatası: ${error.message}`);
    next(error);
  }
});

/**
 * @route POST /api/approval-flows/:documentId/reject
 * @desc Belgeyi reddeder
 * @access Private
 */
router.post('/:documentId/reject', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { comment } = req.body;
    
    const approvalFlow = await approvalService.processApprovalAction(
      documentId,
      req.user.id,
      'reject',
      comment
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Belge reddedildi',
      data: approvalFlow
    });
  } catch (error) {
    logger.error(`Belge reddetme hatası: ${error.message}`);
    next(error);
  }
});

module.exports = router; 