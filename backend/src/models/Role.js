const mongoose = require('mongoose');

/**
 * Rol modelinin şeması
 * Open/Closed prensibine uygun olarak rolleri veritabanında yönetebilmemizi sağlar
 */
const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Rol adı zorunludur'],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Rol açıklaması zorunludur'],
    trim: true,
  },
  permissions: {
    documents: {
      create: { type: Boolean, default: false },
      read: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      approve: { type: Boolean, default: false },
      reject: { type: Boolean, default: false },
      readAll: { type: Boolean, default: false }, // Tüm belgeleri okuyabilir
      updateAll: { type: Boolean, default: false }, // Tüm belgeleri güncelleyebilir
      deleteAll: { type: Boolean, default: false }  // Tüm belgeleri silebilir
    },
    users: {
      create: { type: Boolean, default: false },
      read: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    approvalFlows: {
      create: { type: Boolean, default: false },
      read: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    system: {
      manageRoles: { type: Boolean, default: false },
      viewLogs: { type: Boolean, default: false },
      manageSettings: { type: Boolean, default: false }
    }
  },
  priority: {
    type: Number,
    required: [true, 'Rol önceliği zorunludur'],
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Rol modelini tanımla
const Role = mongoose.model('Role', roleSchema);

// Varsayılan rolleri oluşturan yardımcı fonksiyon
roleSchema.statics.createDefaultRoles = async function() {
  const defaultRoles = [
    {
      name: 'user',
      description: 'Standart kullanıcı',
      permissions: {
        documents: {
          create: true,
          read: true,
          update: true,
          delete: true
        },
        users: {
          read: true
        },
        approvalFlows: {
          read: true
        }
      },
      priority: 0,
      isDefault: true
    },
    {
      name: 'manager',
      description: 'Yönetici',
      permissions: {
        documents: {
          create: true,
          read: true,
          update: true,
          delete: true,
          approve: true,
          reject: true,
          readAll: true
        },
        users: {
          read: true
        },
        approvalFlows: {
          read: true,
          create: true,
          update: true
        }
      },
      priority: 10,
      isDefault: true
    },
    {
      name: 'admin',
      description: 'Sistem yöneticisi',
      permissions: {
        documents: {
          create: true,
          read: true,
          update: true,
          delete: true,
          approve: true,
          reject: true,
          readAll: true,
          updateAll: true,
          deleteAll: true
        },
        users: {
          create: true,
          read: true,
          update: true,
          delete: true
        },
        approvalFlows: {
          create: true,
          read: true,
          update: true,
          delete: true
        },
        system: {
          manageRoles: true,
          viewLogs: true,
          manageSettings: true
        }
      },
      priority: 100,
      isDefault: true
    }
  ];

  // Varsayılan rolleri ekle (zaten varsa güncelle)
  for (const role of defaultRoles) {
    await this.findOneAndUpdate(
      { name: role.name },
      role,
      { upsert: true, new: true }
    );
  }
};

module.exports = Role; 