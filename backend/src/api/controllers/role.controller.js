const Role = require('../../models/Role');
const logger = require('../../utils/logger');

/**
 * Rol kontrolcüsü
 */
class RoleController {
  /**
   * Yeni rol oluşturur
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async createRole(req, res, next) {
    try {
      const roleData = req.body;
      const userId = req.user.id;
      
      // Rol adının benzersiz olduğunu kontrol et
      const existingRole = await Role.findOne({ name: roleData.name });
      if (existingRole) {
        return res.status(400).json({
          status: 'error',
          message: `'${roleData.name}' adında bir rol zaten mevcut`
        });
      }
      
      // Yeni rol oluştur
      const role = await Role.create({
        ...roleData,
        createdBy: userId
      });
      
      res.status(201).json({
        status: 'success',
        message: 'Rol başarıyla oluşturuldu',
        data: { role }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Rol günceller
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async updateRole(req, res, next) {
    try {
      const { id } = req.params;
      const roleData = req.body;
      
      // Rolü bul
      const role = await Role.findById(id);
      if (!role) {
        return res.status(404).json({
          status: 'error',
          message: 'Rol bulunamadı'
        });
      }
      
      // Rol adı değiştiyse, benzersiz olduğunu kontrol et
      if (roleData.name && roleData.name !== role.name) {
        const existingRole = await Role.findOne({ name: roleData.name });
        if (existingRole) {
          return res.status(400).json({
            status: 'error',
            message: `'${roleData.name}' adında bir rol zaten mevcut`
          });
        }
      }
      
      // Rolü güncelle
      Object.keys(roleData).forEach(key => {
        role[key] = roleData[key];
      });
      
      await role.save();
      
      res.status(200).json({
        status: 'success',
        message: 'Rol başarıyla güncellendi',
        data: { role }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Rol siler
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async deleteRole(req, res, next) {
    try {
      const { id } = req.params;
      
      // Rolü bul
      const role = await Role.findById(id);
      if (!role) {
        return res.status(404).json({
          status: 'error',
          message: 'Rol bulunamadı'
        });
      }
      
      // Rolü sil
      await role.remove();
      
      res.status(200).json({
        status: 'success',
        message: 'Rol başarıyla silindi'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Rol detaylarını getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getRoleById(req, res, next) {
    try {
      const { id } = req.params;
      
      const role = await Role.findById(id);
      if (!role) {
        return res.status(404).json({
          status: 'error',
          message: 'Rol bulunamadı'
        });
      }
      
      res.status(200).json({
        status: 'success',
        data: { role }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Tüm rolleri getirir
   * @param {Object} req - İstek nesnesi
   * @param {Object} res - Yanıt nesnesi
   * @param {Function} next - Sonraki middleware
   */
  async getAllRoles(req, res, next) {
    try {
      const roles = await Role.find();
      
      res.status(200).json({
        status: 'success',
        results: roles.length,
        data: { roles }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RoleController(); 