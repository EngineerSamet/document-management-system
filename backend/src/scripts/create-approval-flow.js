require('dotenv').config();
const mongoose = require('mongoose');
const ApprovalFlow = require('../models/ApprovalFlow');
const User = require('../models/User');
const { ROLES } = require('../middleware/role.middleware');

// Veritabanı bağlantısı
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB bağlantısı başarılı'))
  .catch(err => console.error('MongoDB bağlantı hatası:', err));

// Örnek onay akışları oluştur
async function createApprovalFlows() {
  try {
    // Kullanıcıları bul
    const users = await User.find({}).limit(10);
    
    if (users.length < 3) {
      console.error('Yeterli kullanıcı bulunamadı. En az 3 kullanıcı gerekli.');
      process.exit(1);
    }
    
    // Yönetici kullanıcıları bul
    const managers = users.filter(user => user.role === ROLES.MANAGER);
    const admins = users.filter(user => user.role === ROLES.ADMIN);
    const regularUsers = users.filter(user => user.role === ROLES.USER);
    
    if (managers.length === 0) {
      console.warn('Yönetici kullanıcı bulunamadı. Normal kullanıcılar kullanılacak.');
    }
    
    // Onay akışı örnekleri
    const approvalFlows = [
      {
        name: 'Standart Onay Akışı',
        description: 'Müdür ve Başkan Yardımcısı onayı gerektirir',
        steps: [
          {
            userId: managers[0]?._id || users[0]._id,
            order: 1,
            role: 'Müdür'
          },
          {
            userId: managers[1]?._id || users[1]._id,
            order: 2,
            role: 'Başkan Yardımcısı'
          }
        ]
      },
      {
        name: 'Hızlı Onay Akışı',
        description: 'Sadece Müdür onayı gerektirir',
        steps: [
          {
            userId: managers[0]?._id || users[0]._id,
            order: 1,
            role: 'Müdür'
          }
        ]
      },
      {
        name: 'Kapsamlı Onay Akışı',
        description: 'Müdür, Başkan Yardımcısı ve Başkan onayı gerektirir',
        steps: [
          {
            userId: managers[0]?._id || users[0]._id,
            order: 1,
            role: 'Müdür'
          },
          {
            userId: managers[1]?._id || users[1]._id,
            order: 2,
            role: 'Başkan Yardımcısı'
          },
          {
            userId: admins[0]?._id || users[2]._id,
            order: 3,
            role: 'Başkan'
          }
        ]
      }
    ];
    
    // Mevcut onay akışlarını temizle
    await ApprovalFlow.deleteMany({});
    
    // Onay akışlarını oluştur
    for (const flow of approvalFlows) {
      await ApprovalFlow.create({
        name: flow.name,
        description: flow.description,
        steps: flow.steps,
        currentStep: 1,
        status: 'PENDING',
        createdBy: users[0]._id
      });
    }
    
    console.log(`${approvalFlows.length} adet onay akışı oluşturuldu.`);
    process.exit(0);
  } catch (error) {
    console.error('Onay akışı oluşturma hatası:', error);
    process.exit(1);
  }
}

createApprovalFlows(); 