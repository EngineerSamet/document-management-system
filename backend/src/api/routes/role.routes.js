const express = require('express');
const roleController = require('../controllers/role.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const { ROLES, checkRole } = require('../../middleware/role.middleware');

const router = express.Router();

/**
 * Rol rotaları
 */

// Tüm rotalarda kimlik doğrulama ve admin yetkisi gerekli
router.use(authMiddleware.protect);
router.use(checkRole([ROLES.ADMIN]));

// Tüm rolleri getirme
router.get('/', roleController.getAllRoles);

// Rol detaylarını getirme
router.get('/:id', roleController.getRoleById);

// Rol oluşturma
router.post('/', roleController.createRole);

// Rol güncelleme
router.put('/:id', roleController.updateRole);

// Rol silme
router.delete('/:id', roleController.deleteRole);

module.exports = router; 