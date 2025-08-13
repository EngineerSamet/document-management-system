const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logs.controller');
const authMiddleware = require('../../middleware/auth.middleware');

/**
 * @route   GET /api/logs
 * @desc    Tüm log kayıtlarını sayfalama ve filtreleme ile getirir
 * @access  Private (Admin)
 */
router.get('/',
  authMiddleware.protect,
  authMiddleware.isAdmin,
  logsController.getLogs
);

/**
 * @route   GET /api/logs/recent
 * @desc    Son etkinlikleri getirir
 * @access  Private
 */
router.get('/recent',
  authMiddleware.protect,
  logsController.getRecentActivities
);

module.exports = router;