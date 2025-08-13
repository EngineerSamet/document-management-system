import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useAdminCreateUser } from '../../hooks/useAdminCreateUser';
import { getDepartments, getPositions, normalizeDepartmentId } from '../../api/users';

// Departman listesi (varsayılan)
const DEFAULT_DEPARTMENTS = [
  { id: 'IT', name: 'Bilgi Teknolojileri' },
  { id: 'HR', name: 'İnsan Kaynakları' },
  { id: 'FINANCE', name: 'Finans' },
  { id: 'MARKETING', name: 'Pazarlama' },
  { id: 'SALES', name: 'Satış' },
  { id: 'OPERATIONS', name: 'Operasyon' },
  { id: 'LEGAL', name: 'Hukuk' },
  { id: 'CUSTOMER_SERVICE', name: 'Müşteri Hizmetleri' },
  { id: 'RESEARCH', name: 'Araştırma ve Geliştirme' }
];

const CreateUser = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isInitialized } = useAuth();
  const { successToast, errorToast } = useNotification();
  const { createUser, loading, error, testUserPassword } = useAdminCreateUser();
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [positions, setPositions] = useState([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [positionError, setPositionError] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'OFFICER', // Varsayılan rol
    department: '', // Departman alanı eklendi
    position: '' // Pozisyon alanı eklendi
  });
  
  // Form validation state
  const [formErrors, setFormErrors] = useState({});
  
  // Test kullanıcısı şifre modalı
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [createdTestUser, setCreatedTestUser] = useState(null);
  
  // Pozisyonları getir - useCallback ile memoize edilmiş
  const fetchPositions = useCallback(async (departmentId = null) => {
    if (!departmentId) {
      setPositions([]);
      return;
    }
    
    try {
      // Yükleme durumunu güncelle
      setIsLoadingPositions(true);
      setPositionError(null);
      
      // API çağrısı
      const response = await getPositions(departmentId);
      
      // Yanıtı kontrol et
      if (response && response.data && Array.isArray(response.data.positions)) {
        console.log(`Pozisyonlar başarıyla alındı, toplam ${response.data.positions.length} pozisyon:`, response.data.positions);
        setPositions(response.data.positions);
        
        // Pozisyon listesi boşsa uyarı göster
        if (response.data.positions.length === 0) {
          setPositionError('Bu departman için pozisyon tanımlanmamış');
        }
      } else {
        // Veri yapısı beklenen formatta değilse
        console.warn('Pozisyon verisi beklenen formatta değil:', response);
        setPositions([]);
        setPositionError('Pozisyon listesi alınamadı');
      }
    } catch (error) {
      console.error('Pozisyon listesi getirme hatası:', error);
      setPositions([]);
      setPositionError('Pozisyon listesi yüklenirken bir hata oluştu');
    } finally {
      // Yükleme durumunu güncelle
      setIsLoadingPositions(false);
    }
  }, []);
  
  // Yetki kontrolü ve departman listesini getir
  useEffect(() => {
    // Sayfa yüklendiğinde yetki kontrolü yap
    const checkAdminAccess = () => {
      // Uygulama henüz başlatılmamışsa bekle
      if (!isInitialized) {
        console.log('Auth durumu henüz başlatılmadı, bekleniyor...');
        return;
      }
      
      // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
      if (!isAuthenticated) {
        console.log('Kullanıcı giriş yapmamış, login sayfasına yönlendiriliyor');
        // Yönlendirme yapmadan önce biraz bekle (500ms)
        setTimeout(() => {
          navigate('/giris', { replace: true });
        }, 500);
        return;
      }
      
      // Kullanıcı admin değilse dashboard'a yönlendir
      if (user && user.role !== 'ADMIN') {
        console.warn('Kullanıcı admin değil:', user.role);
        errorToast('Admin paneline erişim yetkiniz bulunmuyor');
        // Yönlendirme yapmadan önce biraz bekle (500ms)
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);
        return;
      }
      
      console.log('Admin erişimi doğrulandı:', user?.role);
    };
    
    // Yetki kontrolünü hemen çalıştır
    checkAdminAccess();
    
    // Departman listesini getir
    const fetchDepartments = async () => {
      try {
        const response = await getDepartments();
        if (response && response.data && Array.isArray(response.data.departments)) {
          setDepartments(response.data.departments);
        }
      } catch (error) {
        console.warn('Departman listesi getirilemedi, varsayılan liste kullanılıyor:', error);
        // Hata durumunda varsayılan listeyi kullan (zaten state'e set edilmiş durumda)
      }
    };
    
    // Departmanları getir
    fetchDepartments();
    
    // isInitialized veya isAuthenticated değiştiğinde tekrar kontrol et
  }, [isInitialized, isAuthenticated, user, navigate, errorToast]);
  
  // Departman değiştiğinde pozisyonları getir
  useEffect(() => {
    // Departman değişikliğini logla
    console.log('Departman değişti, yeni değer:', formData.department);
    
    // Pozisyon hatasını temizle
    setPositionError(null);
    
    // Departman değerini normalize et
    const normalizedDepartment = normalizeDepartmentId(formData.department);
    
    // Departman değeri varsa pozisyonları getir
    if (normalizedDepartment) {
      console.log('Seçilen departman için pozisyonlar getiriliyor:', normalizedDepartment);
      fetchPositions(normalizedDepartment);
    } else {
      // Departman seçilmemişse pozisyon listesini temizle
      console.log('Departman seçilmedi, pozisyon listesi temizleniyor');
      setPositions([]);
    }
  }, [formData.department, fetchPositions]);
  
  // Test kullanıcısı şifresi değiştiğinde modalı göster
  useEffect(() => {
    if (testUserPassword) {
      setShowPasswordModal(true);
    }
  }, [testUserPassword]);
  
  // Form değişikliklerini izle
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Departman değiştiyse pozisyon alanını sıfırla
    if (name === 'department') {
      console.log('Departman seçimi değişti:', value);
      
      // Departman değerini normalize et
      const normalizedValue = normalizeDepartmentId(value);
      console.log('Normalize edilmiş departman:', normalizedValue);
      
      setFormData(prev => ({
        ...prev,
        [name]: value,
        position: '' // Departman değiştiğinde pozisyonu sıfırla
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Değişiklik yapıldığında ilgili hata mesajını temizle
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  // Form doğrulama
  const validateForm = () => {
    const errors = {};
    
    // Ad kontrolü
    if (!formData.firstName.trim()) {
      errors.firstName = 'Ad alanı zorunludur';
    }
    
    // Soyad kontrolü
    if (!formData.lastName.trim()) {
      errors.lastName = 'Soyad alanı zorunludur';
    }
    
    // Email kontrolü
    if (!formData.email.trim()) {
      errors.email = 'E-posta alanı zorunludur';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Geçerli bir e-posta adresi giriniz';
    }
    
    // Şifre kontrolü - artık zorunlu değil, email doğrulama sistemi kullanılacak
    if (formData.password && formData.password.length < 6) {
      errors.password = 'Şifre en az 6 karakter olmalıdır';
    }
    
    // Rol kontrolü
    if (!formData.role) {
      errors.role = 'Rol seçimi zorunludur';
    }
    
    // Departman kontrolü
    if (!formData.department.trim()) {
      errors.department = 'Departman alanı zorunludur';
    }
    
    // Pozisyon kontrolü
    if (!formData.position.trim()) {
      errors.position = 'Pozisyon alanı zorunludur';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Form gönderme
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Form doğrulama
    if (!validateForm()) {
      errorToast('Lütfen form alanlarını kontrol ediniz');
      return;
    }
    
    try {
      // Departman ve pozisyon değerlerinin doğru formatta olduğundan emin olalım
      const normalizedFormData = {
        ...formData,
        department: normalizeDepartmentId(formData.department) || '',
        position: formData.position || ''
      };
      
      console.log('Normalize edilmiş form verileri:', normalizedFormData);
      
      // Kullanıcı oluştur
      const result = await createUser(normalizedFormData);
      
      if (result.success) {
        // Test kullanıcısı oluşturulduysa şifre bilgisini kaydet
        if (result.testPassword && formData.email.endsWith('@example.com')) {
          setCreatedTestUser({
            email: formData.email,
            password: result.testPassword
          });
        }
        
        successToast('Kullanıcı başarıyla oluşturuldu. Doğrulama e-postası gönderildi.');
        
        // Test kullanıcısı değilse kullanıcılar listesine yönlendir
        if (!formData.email.endsWith('@example.com')) {
          navigate('/admin/kullanicilar');
        }
      }
    } catch (error) {
      console.error('Kullanıcı oluşturma hatası:', error);
      // Hata mesajı zaten hook içinde işleniyor
    }
  };
  
  // Eğer sayfa henüz başlatılmadıysa veya kullanıcı yetkisi kontrol ediliyorsa yükleniyor göster
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-b-4 border-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Yetki kontrol ediliyor...</p>
        </div>
      </div>
    );
  }
  
  // Kullanıcı admin değilse içerik gösterme
  if (!user || user.role !== 'ADMIN') {
    return null; // useEffect içinde zaten yönlendirme yapılıyor
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Yeni Kullanıcı Ekle</h1>
        <Button 
          color="secondary"
          onClick={() => navigate('/admin/kullanicilar')}
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Kullanıcılar Listesine Dön
        </Button>
      </div>
      
      <Card className="max-w-2xl mx-auto">
        <div className="p-6">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p className="text-blue-700">
              Bu form sadece adminler tarafından kullanılır. Sisteme yeni kullanıcı eklemek için aşağıdaki bilgileri doldurunuz.
            </p>
          </div>
          
          {/* Hata mesajı */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p>{error}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="firstName">
                Ad
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                className={`shadow appearance-none border ${formErrors.firstName ? 'border-red-500' : 'border-gray-300'} rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
                placeholder="Kullanıcının adı"
              />
              {formErrors.firstName && (
                <p className="text-red-500 text-xs italic mt-1">{formErrors.firstName}</p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="lastName">
                Soyad
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                className={`shadow appearance-none border ${formErrors.lastName ? 'border-red-500' : 'border-gray-300'} rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
                placeholder="Kullanıcının soyadı"
              />
              {formErrors.lastName && (
                <p className="text-red-500 text-xs italic mt-1">{formErrors.lastName}</p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                E-posta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className={`shadow appearance-none border ${formErrors.email ? 'border-red-500' : 'border-gray-300'} rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
                placeholder="ornek@sirket.com"
              />
              {formErrors.email && (
                <p className="text-red-500 text-xs italic mt-1">{formErrors.email}</p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="department">
                Departman
              </label>
              <select
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className={`shadow appearance-none border ${formErrors.department ? 'border-red-500' : 'border-gray-300'} rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
              >
                <option value="">Seçiniz</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              {formErrors.department && (
                <p className="text-red-500 text-xs italic mt-1">{formErrors.department}</p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="position">
                Pozisyon
              </label>
              <div className="relative">
                <select
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  disabled={isLoadingPositions || !formData.department}
                  className={`shadow appearance-none border ${formErrors.position ? 'border-red-500' : 'border-gray-300'} rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${(isLoadingPositions || !formData.department) ? 'bg-gray-100' : ''}`}
                >
                  <option value="">
                    {isLoadingPositions 
                      ? 'Yükleniyor...' 
                      : !formData.department 
                        ? 'Önce departman seçiniz' 
                        : 'Seçiniz'}
                  </option>
                  {!isLoadingPositions && positions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.name}
                    </option>
                  ))}
                </select>
                {isLoadingPositions && (
                  <div className="absolute right-10 top-1/2 transform -translate-y-1/2 flex items-center">
                    <div className="w-4 h-4 border-t-2 border-b-2 border-primary-600 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              {formErrors.position && (
                <p className="text-red-500 text-xs italic mt-1">{formErrors.position}</p>
              )}
              {positionError && !isLoadingPositions && formData.department && (
                <p className="text-amber-500 text-xs mt-1">
                  {positionError} - Varsayılan pozisyonlar kullanılıyor
                </p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                Şifre (Opsiyonel)
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className={`shadow appearance-none border ${formErrors.password ? 'border-red-500' : 'border-gray-300'} rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
                placeholder="En az 6 karakter (opsiyonel)"
              />
              {formErrors.password && (
                <p className="text-red-500 text-xs italic mt-1">{formErrors.password}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">
                Not: Şifre belirtmezseniz, kullanıcıya e-posta doğrulama linki gönderilecek ve kendi şifresini belirleyebilecek.
              </p>
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="role">
                Kullanıcı Rolü
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={`shadow appearance-none border ${formErrors.role ? 'border-red-500' : 'border-gray-300'} rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
              >
                <option value="ADMIN">Yönetici (ADMIN)</option>
                <option value="MANAGER">Yönetici (MANAGER)</option>
                <option value="OFFICER">Memur (OFFICER)</option>
                <option value="OBSERVER">Gözlemci (OBSERVER)</option>
              </select>
              {formErrors.role && (
                <p className="text-red-500 text-xs italic mt-1">{formErrors.role}</p>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <Button
                type="submit"
                color="primary"
                disabled={loading || isLoadingPositions}
                className="w-full"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Kullanıcı Oluşturuluyor...
                  </>
                ) : (
                  'Kullanıcı Oluştur'
                )}
              </Button>
            </div>
          </form>
        </div>
      </Card>
      
      {/* Test kullanıcısı şifre modalı */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          navigate('/admin/kullanicilar');
        }}
        title="Test Kullanıcısı Bilgileri"
      >
        {createdTestUser && (
          <div>
            <div className="bg-green-100 border-l-4 border-green-500 p-4 mb-4">
              <p className="text-green-700">Test kullanıcısı başarıyla oluşturuldu!</p>
            </div>
            
            <div className="mb-4">
              <p className="font-bold mb-2">Kullanıcı Bilgileri:</p>
              <div className="bg-gray-100 p-4 rounded-md">
                <p><strong>E-posta:</strong> {createdTestUser.email}</p>
                <p><strong>Şifre:</strong> {createdTestUser.password}</p>
              </div>
            </div>
            
            <p className="text-red-600 text-sm mb-4">
              <strong>Önemli:</strong> Bu şifreyi not alın, daha sonra görüntülenemeyecektir!
            </p>
            
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setShowPasswordModal(false);
                  navigate('/admin/kullanicilar');
                }}
              >
                Tamam
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CreateUser;