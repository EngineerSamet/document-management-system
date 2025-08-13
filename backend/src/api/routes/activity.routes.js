const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const authMiddleware = require('../../middleware/auth.middleware');

/**
 * @route   GET /api/activities/recent
 * @desc    Son etkinlikleri getirir
 * @access  Private
 */
router.get('/recent',
  authMiddleware.protect,
  activityController.getRecentActivities
);

/**
 * @route   GET /api/activities/dashboard
 * @desc    Dashboard için özet etkinlik verileri getirir
 * @access  Private
 */
router.get('/dashboard',
  authMiddleware.protect,
  activityController.getDashboardActivities
);

/**
 * @route   GET /api/activities/user/:userId
 * @desc    Kullanıcının son etkinliklerini getirir
 * @access  Private
 */
router.get('/user/:userId',
  authMiddleware.protect,
  activityController.getUserActivities
);

module.exports = router; 