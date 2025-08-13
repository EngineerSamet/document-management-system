import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import * as adminApi from '../../api/admin'; // Import admin API functions

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debugLoading, setDebugLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activatingDummyUsers, setActivatingDummyUsers] = useState(false);
  const [dummyUsersResult, setDummyUsersResult] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // Sayfa yüklendiğinde kullanıcıları getir
  useEffect(() => {
    fetchUsersDebug(); // Normal endpoint yerine doğrudan debug endpoint'i kullanalım
  }, []);

  // Debug endpoint ile tüm kullanıcıları getir (filtresiz)
  const fetchUsersDebug = async () => {
    try {
      setLoading(true);
      console.log('Debug endpoint ile kullanıcılar getiriliyor...');
      
      // Debug endpoint'i kullan (kimlik doğrulama gerektirmeyen)
      const response = await axios.get('/api/admin/users/debug');
      
      console.log('Debug: Kullanıcılar başarıyla alındı:', response.data);
      
      if (response.data && response.data.data && response.data.data.users) {
        setUsers(response.data.data.users);
        console.log(`${response.data.data.users.length} kullanıcı yüklendi`);
        
        // Başarılı mesajı göster
        showNotification(
          `${response.data.data.users.length} kullanıcı başarıyla yüklendi`,
          'success'
        );
      } else {
        console.error('Beklenmeyen API yanıtı:', response.data);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Kullanıcılar yüklenirken hata:', error);
      
      if (error.response) {
        console.error('Hata detayları:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      
      showNotification(
        error.response?.data?.message || 'Kullanıcılar yüklenirken bir hata oluştu',
        'error'
      );
      setLoading(false);
    }
  };
  
  // Debug amaçlı tüm kullanıcıları getir (filtresiz)
  const fetchAllUsersDebug = async () => {
    try {
      setDebugLoading(true);
      console.log('Debug: Tüm kullanıcıları getirme isteği gönderiliyor...');
      
      const result = await adminApi.getAllUsersDebug();
      
      if (result && result.data && result.data.users) {
        console.log('Debug: Tüm kullanıcılar başarıyla alındı:', result);
        console.log('Debug: Bulunan kullanıcı sayısı:', result.data.users.length);
        
        // Kullanıcıları state'e kaydet
        setUsers(result.data.users);
        
        showNotification(
          `Debug: Toplam ${result.data.users.length} kullanıcı bulundu (filtresiz)`,
          'success'
        );
      } else {
        console.error('Debug: Beklenmeyen API yanıtı:', result);
        showNotification('Debug: Beklenmeyen API yanıtı', 'error');
      }
    } catch (error) {
      console.error('Debug: Kullanıcıları getirme hatası:', error);
      showNotification(
        error.response?.data?.message || 'Debug: Kullanıcıları getirirken bir hata oluştu',
        'error'
      );
    } finally {
      setDebugLoading(false);
    }
  };

  // Normal endpoint ile kullanıcıları getir (admin/all)
  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('Normal endpoint ile kullanıcılar getiriliyor...');
      
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.error('Token bulunamadı!');
        showNotification('Oturum bilgisi bulunamadı', 'error');
        setLoading(false);
        return;
      }
      
      // Normal endpoint'i kullan
      const response = await axios.get(
        '/api/users/admin/all',
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      console.log('Normal: Kullanıcılar başarıyla alındı:', response.data);
      
      if (response.data && response.data.data && response.data.data.users) {
        setUsers(response.data.data.users);
        console.log(`${response.data.data.users.length} kullanıcı yüklendi`);
        
        // Başarılı mesajı göster
        showNotification(
          `${response.data.data.users.length} aktif kullanıcı başarıyla yüklendi`,
          'success'
        );
      } else {
        console.error('Beklenmeyen API yanıtı:', response.data);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Normal endpoint hatası:', error);
      
      // Hata durumunda debug endpoint'i dene
      console.log('Normal endpoint başarısız, debug endpoint deneniyor...');
      fetchUsersDebug();
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        console.error('Token bulunamadı!');
        showNotification('Oturum bilgisi bulunamadı', 'error');
        return;
      }
      
      await axios.patch(
        `/api/users/${userId}/status`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      // Kullanıcı listesini güncelle
      setUsers(users.map(user => 
        user._id === userId ? { ...user, isActive: !currentStatus } : user
      ));
      
      showNotification(
        `Kullanıcı durumu ${!currentStatus ? 'aktif' : 'pasif'} olarak güncellendi`,
        'success'
      );
    } catch (error) {
      console.error('Kullanıcı durumu güncelleme hatası:', error);
      
      showNotification(
        error.response?.data?.message || 'Kullanıcı durumu güncellenirken bir hata oluştu',
        'error'
      );
    }
  };

  const handleActivateDummyUsers = async () => {
    try {
      setActivatingDummyUsers(true);
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        console.error('Token bulunamadı!');
        showNotification('Oturum bilgisi bulunamadı', 'error');
        setActivatingDummyUsers(false);
        return;
      }
      
      const response = await axios.post(
        '/api/users/admin/bulk-activate-dummy',
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      setDummyUsersResult(response.data.data);
      showNotification(response.data.message, 'success');
      
      // Kullanıcı listesini güncelle
      fetchUsersDebug(); // Debug endpoint ile tüm kullanıcıları getir
    } catch (error) {
      console.error('Test kullanıcıları aktifleştirme hatası:', error);
      
      if (error.response) {
        console.error('Hata detayları:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      
      showNotification(
        error.response?.data?.message || 'Test kullanıcıları aktifleştirilirken bir hata oluştu',
        'error'
      );
    } finally {
      setActivatingDummyUsers(false);
      setIsModalOpen(true);
    }
  };

  // Kullanıcı silme işlemini başlat
  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  // Kullanıcı silme işlemini onayla
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      setDeleting(true);
      
      // Kullanıcı silme API çağrısı
      const result = await adminApi.deleteUser(userToDelete._id);
      
      showNotification(result.message || 'Kullanıcı başarıyla silindi', 'success');
      
      // Kullanıcı listesini güncelle
      fetchUsersDebug();
      
      // Modalı kapat
      setDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Kullanıcı silme hatası:', error);
      
      let errorMessage = 'Kullanıcı silinirken bir hata oluştu';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      showNotification(errorMessage, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role.toUpperCase()) {
      case 'ADMIN': return 'red';
      case 'MANAGER': return 'blue';
      case 'OFFICER': return 'green';
      case 'OBSERVER': return 'gray';
      default: return 'gray';
    }
  };

  // Admin değilse erişimi engelle
  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <Card className="p-6">
          <h2 className="text-xl font-bold text-red-600 mb-4">Yetkisiz Erişim</h2>
          <p className="text-gray-700">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <Button 
            onClick={() => navigate('/dashboard')} 
            className="mt-4"
          >
            Ana Sayfaya Dön
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Kullanıcı Yönetimi</h1>
        <div className="flex gap-2">
          <Button 
            onClick={fetchUsersDebug}
            variant="outline"
            color="secondary"
            disabled={debugLoading}
          >
            {debugLoading ? 'Yükleniyor...' : 'Debug: Tüm Kullanıcıları Getir'}
          </Button>
          <Button 
            onClick={fetchUsers}
            variant="outline"
            color="primary"
            disabled={loading}
          >
            {loading ? 'Yükleniyor...' : 'Normal: Aktif Kullanıcıları Getir'}
          </Button>
          <Button 
            onClick={handleActivateDummyUsers}
            variant="outline"
            disabled={activatingDummyUsers}
          >
            {activatingDummyUsers ? 'İşleniyor...' : 'Test Kullanıcılarını Aktifleştir'}
          </Button>
          <Button 
            onClick={() => navigate('/admin/kullanicilar/yeni')}
          >
            Yeni Kullanıcı Ekle
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Kullanıcılar yükleniyor...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kullanıcı
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Departman / Pozisyon
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rol
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durum
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Doğrulama
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                      Kayıtlı kullanıcı bulunamadı
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                            {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.department}</div>
                        <div className="text-sm text-gray-500">{user.position}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge color={getRoleBadgeColor(user.role)}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isVerified 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {user.isVerified ? 'Doğrulanmış' : 'Doğrulanmamış'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => handleToggleStatus(user._id, user.isActive)}
                          className={`text-sm ${
                            user.isActive 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-green-600 hover:text-green-900'
                          } mr-3`}
                        >
                          {user.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                        </button>
                        
                        {/* Kullanıcı silme butonu */}
                        <button 
                          onClick={() => handleDeleteUser(user)}
                          className="text-sm text-red-600 hover:text-red-900 ml-3"
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Test kullanıcıları sonuç modalı */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Test Kullanıcıları Aktifleştirildi"
      >
        {dummyUsersResult && (
          <div>
            <p className="mb-4">
              {dummyUsersResult.count} test kullanıcısı başarıyla aktifleştirildi.
            </p>
            {dummyUsersResult.users && dummyUsersResult.users.length > 0 && (
              <div>
                <h3 className="font-bold mb-2">Kullanıcı Bilgileri:</h3>
                <div className="bg-gray-100 p-4 rounded-md max-h-60 overflow-y-auto">
                  {dummyUsersResult.users.map((user, index) => (
                    <div key={index} className="mb-2 pb-2 border-b border-gray-200 last:border-0">
                      <p><strong>E-posta:</strong> {user.email}</p>
                      <p><strong>Şifre:</strong> {user.password}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  Bu şifreleri not alın, daha sonra görüntülenemeyecektir.
                </p>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setIsModalOpen(false)}>
                Kapat
              </Button>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Kullanıcı silme onay modalı */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deleting && setDeleteModalOpen(false)}
        title="Kullanıcı Silme Onayı"
      >
        {userToDelete && (
          <div>
            <p className="mb-4 text-gray-700">
              <strong>{userToDelete.firstName} {userToDelete.lastName}</strong> ({userToDelete.email}) kullanıcısını silmek istediğinize emin misiniz?
            </p>
            <p className="mb-6 text-red-600 font-medium">
              Bu işlem geri alınamaz ve kullanıcıya ait tüm veriler silinecektir!
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                color="secondary"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
              >
                İptal
              </Button>
              <Button
                color="danger"
                onClick={confirmDeleteUser}
                disabled={deleting}
              >
                {deleting ? 'Siliniyor...' : 'Kullanıcıyı Sil'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserManagement; 