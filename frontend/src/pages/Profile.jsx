import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { updateUserProfile, changePassword, getDepartments, getPositions, normalizeDepartmentId, getDepartmentNameById, getPositionNameById } from '../api/users';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { formatDate } from '../utils/formatters';

const profileSchema = Yup.object().shape({
  firstName: Yup.string().required('Ad gerekli'),
  lastName: Yup.string().required('Soyad gerekli'),
  email: Yup.string().email('Geçerli bir e-posta adresi giriniz').required('E-posta gerekli'),
  department: Yup.string().required('Departman gerekli'),
  position: Yup.string().required('Pozisyon gerekli'),
});

const passwordSchema = Yup.object().shape({
  currentPassword: Yup.string().required('Mevcut şifre gerekli'),
  newPassword: Yup.string()
    .min(8, 'Şifre en az 8 karakter olmalıdır')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir'
    )
    .required('Yeni şifre gerekli'),
  confirmNewPassword: Yup.string()
    .oneOf([Yup.ref('newPassword'), null], 'Şifreler eşleşmelidir')
    .required('Şifre tekrarı gerekli')
});

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

const Profile = () => {
  const { user, updateUserInContext, refreshUserInfo } = useAuth();
  const { successToast, errorToast } = useNotification();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [positions, setPositions] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [positionError, setPositionError] = useState(null);
  
  // Kullanıcı bilgilerini useMemo ile hesapla
  const userDisplayData = useMemo(() => {
    if (!user) {
      return {
        initials: '',
        fullName: '',
        deptPos: ''
      };
    }
    
    // Kullanıcı baş harflerini hesapla
    const getUserInitials = () => {
      const firstName = user.firstName || '';
      const lastName = user.lastName || '';
      
      if (!firstName || !lastName || firstName === 'undefined' || lastName === 'undefined') {
        if (user.email) {
          return user.email.charAt(0).toUpperCase();
        }
        return 'K';
      }
      
      return firstName.charAt(0) + lastName.charAt(0);
    };
    
    // Kullanıcı tam adını hesapla
    const getUserFullName = () => {
      const firstName = user.firstName || '';
      const lastName = user.lastName || '';
      
      if (!firstName || !lastName || firstName === 'undefined' || lastName === 'undefined') {
        return user.email || '';
      }
      
      return `${firstName} ${lastName}`;
    };
    
    return {
      initials: getUserInitials(),
      fullName: getUserFullName(),
      deptPos: '' // Bu değer async olarak hesaplanıyor, ayrı bir state'te tutulacak
    };
  }, [user]);
  
  const [userDeptPos, setUserDeptPos] = useState('');
  
  // Form başlangıç değerleri
  const initialValues = useMemo(() => {
    if (!user) {
      return {
        firstName: '',
        lastName: '',
        email: '',
        department: '',
        position: '',
      };
    }
    
    // Departman ID'sini normalize et
    const normalizedDepartment = normalizeDepartmentId(user.department) || '';
    
    return {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      department: normalizedDepartment,
      position: user.position || '',
    };
  }, [user]);
  
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
  
  // Sayfa yüklendiğinde kullanıcı bilgilerini yenile
  useEffect(() => {
    const refreshData = async () => {
      try {
        console.log('Profil: Kullanıcı bilgileri yenileniyor...');
        
        // forceRefresh parametresini true olarak geçerek önbelleği bypass et
        // Bu sayede lastLogin dahil tüm kullanıcı bilgileri API'den taze olarak alınacak
        await refreshUserInfo(true);
        
        console.log('Profil: Kullanıcı bilgileri yenilendi');
      } catch (error) {
        console.error('Kullanıcı bilgilerini yenileme hatası:', error);
      }
    };
    
    // Sayfa başlığını ayarla
    document.title = 'Profil - Evrak Yönetim Sistemi';
    
    refreshData();
  }, []); // refreshUserInfo'yu bağımlılıklardan çıkardık
  
  // Departman listesini getir - Sayfa ilk yüklendiğinde çalışır
  useEffect(() => {
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
  }, []);
  
  // Kullanıcı bilgileri değiştiğinde seçili departmanı güncelle
  useEffect(() => {
    if (user) {
      // Departman ID'sini normalize et
      const normalizedDepartment = normalizeDepartmentId(user.department) || '';
      
      // Seçili departmanı güncelle
      setSelectedDepartment(normalizedDepartment);
      
      // Departman ve pozisyon bilgisini güncelle
      updateUserDeptPos();
    }
  }, [user]);
  
  // Departman değiştiğinde pozisyonları getir
  useEffect(() => {
    // Departman değişikliğini logla
    console.log('Departman değişti, yeni değer:', selectedDepartment);
    
    // Departman değeri varsa pozisyonları getir
    if (selectedDepartment) {
      console.log('Seçilen departman için pozisyonlar getiriliyor:', selectedDepartment);
      fetchPositions(selectedDepartment);
    } else {
      // Departman seçilmemişse pozisyon listesini temizle
      console.log('Departman seçilmedi, pozisyon listesi temizleniyor');
      setPositions([]);
      setPositionError(null);
    }
  }, [selectedDepartment, fetchPositions]);
  
  // Departman ve pozisyon bilgisini güncelle
  const updateUserDeptPos = async () => {
    if (!user) return;
    
    try {
      // Departman adını al
      let deptName = '';
      if (user.department) {
        deptName = await getDepartmentNameById(user.department);
      }
      
      // Pozisyon adını al
      let posName = '';
      if (user.position) {
        posName = await getPositionNameById(user.position, user.department);
      }
      
      // Departman ve pozisyon bilgisini birleştir
      let deptPosText = '';
      
      if (!deptName && !posName) {
        deptPosText = '';
      } else if (!deptName) {
        deptPosText = posName;
      } else if (!posName) {
        deptPosText = deptName;
      } else {
        deptPosText = `${deptName} - ${posName}`;
      }
      
      // State'i güncelle
      setUserDeptPos(deptPosText);
    } catch (error) {
      console.error('Departman/pozisyon bilgisi güncellenirken hata:', error);
      // Hata durumunda boş string kullan
      setUserDeptPos('');
    }
  };
  
  const handleUpdateProfile = async (values, { setSubmitting }) => {
    try {
      setLoading(true);
      
      // Formdan gelen değerleri logla
      console.log('Profil güncelleme değerleri:', values);
      
      // Departman ve pozisyon değerlerinin doğru formatta olduğundan emin olalım
      const updatedValues = {
        ...values,
        // Boş string veya undefined değerleri null olarak ayarla
        department: values.department || null,
        position: values.position || null
      };
      
      console.log('Düzeltilmiş profil güncelleme değerleri:', updatedValues);
      
      // API çağrısı
      const updatedUser = await updateUserProfile(updatedValues);
      
      // API yanıtını kontrol et
      if (updatedUser) {
        console.log('Profil başarıyla güncellendi:', updatedUser);
        
        // Kullanıcı context'ini güncelle
        updateUserInContext(updatedUser);
        
        // Başarı mesajı göster
        successToast('Profil bilgileri başarıyla güncellendi.');
      } else {
        console.warn('API yanıtında kullanıcı bilgisi bulunamadı');
        errorToast('Profil güncellenirken bir sorun oluştu.');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      let errorMessage = 'Profil güncellenirken bir hata oluştu.';
      
      // Hata mesajını özelleştir
      if (error.response) {
        // Sunucu yanıtı varsa
        if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        }
        
        // CastError (geçersiz ID formatı) hatası
        if (error.response.status === 400 && 
            error.response.data && 
            error.response.data.errors && 
            error.response.data.errors.route) {
          console.error('Route yapılandırma hatası:', error.response.data.errors);
          errorMessage = 'Sistem yapılandırma hatası. Lütfen sistem yöneticisine bildirin.';
        }
      }
      
      errorToast(errorMessage);
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };
  
  const handleChangePassword = async (values, { setSubmitting, resetForm }) => {
    try {
      setLoading(true);
      
      // Şifre değiştirme verilerini logla
      console.log('Şifre değiştirme işlemi başlatılıyor...');
      
      // API çağrısı
      await changePassword(values.currentPassword, values.newPassword);
      
      // Başarı mesajı göster
      successToast('Şifreniz başarıyla değiştirildi.');
      
      // Formu sıfırla
      resetForm();
      
      // Şifre görünürlüğünü kapat
      setShowPassword(false);
    } catch (error) {
      console.error('Şifre değiştirme hatası:', error);
      
      // Hata mesajını özelleştir
      let errorMessage = 'Şifre değiştirilirken bir hata oluştu.';
      
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Mevcut şifreniz yanlış.';
        } else if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      
      errorToast(errorMessage);
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };
  
  // Kullanıcı yüklendiyse sayfayı göster
  if (!user) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-12 h-12 border-t-4 border-b-4 border-primary-600 rounded-full animate-spin"></div>
        <span className="ml-3 text-gray-600">Kullanıcı bilgileri yükleniyor...</span>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Profil Bilgilerim</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sol Taraf - Kullanıcı Bilgileri */}
        <div className="md:col-span-2">
          <Card className="mb-6">
            <Card.Header>
              <h2 className="text-xl font-semibold">Kişisel Bilgiler</h2>
            </Card.Header>
            <Card.Body>
              <Formik
                initialValues={initialValues}
                validationSchema={profileSchema}
                onSubmit={handleUpdateProfile}
                enableReinitialize
              >
                {({ errors, touched, isSubmitting, values, setFieldValue }) => (
                  <Form>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Field name="firstName">
                            {({ field }) => (
                              <Input
                                {...field}
                                label="Ad"
                                placeholder="Adınız"
                                error={touched.firstName && errors.firstName}
                                required
                              />
                            )}
                          </Field>
                        </div>
                        <div>
                          <Field name="lastName">
                            {({ field }) => (
                              <Input
                                {...field}
                                label="Soyad"
                                placeholder="Soyadınız"
                                error={touched.lastName && errors.lastName}
                                required
                              />
                            )}
                          </Field>
                        </div>
                      </div>
                      
                      <Field name="email">
                        {({ field }) => (
                          <Input
                            {...field}
                            type="email"
                            label="E-posta Adresi"
                            placeholder="ornek@sirket.com"
                            error={touched.email && errors.email}
                            required
                            disabled
                          />
                        )}
                      </Field>
                      
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Field name="department">
                            {({ field }) => (
                              <>
                                <Input
                                  {...field}
                                  as="select"
                                  label="Departman"
                                  error={touched.department && errors.department}
                                  required
                                  disabled={user.role !== 'ADMIN'} // Sadece admin değiştirebilir
                                  onChange={(e) => {
                                    const newDepartment = e.target.value;
                                    console.log('Departman seçimi değişti:', newDepartment);
                                    
                                    // Departman değerini form state'ine kaydet
                                    setFieldValue('department', newDepartment);
                                    
                                    // Departman değerini component state'ine kaydet
                                    setSelectedDepartment(newDepartment);
                                    
                                    // Departman değiştiğinde pozisyonu sıfırla
                                    setFieldValue('position', '');
                                  }}
                                >
                                  <option value="">Seçiniz</option>
                                  {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>
                                      {dept.name}
                                    </option>
                                  ))}
                                </Input>
                                {user.role !== 'ADMIN' && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Departman değişikliği sadece yöneticiler tarafından yapılabilir.
                                  </p>
                                )}
                              </>
                            )}
                          </Field>
                        </div>
                        <div>
                          <Field name="position">
                            {({ field }) => (
                              <div className="relative">
                                <Input
                                  {...field}
                                  as="select"
                                  label="Pozisyon"
                                  error={touched.position && errors.position}
                                  required
                                  disabled={isLoadingPositions || !values.department}
                                  className={`${(isLoadingPositions || !values.department) ? 'bg-gray-100' : ''}`}
                                >
                                  <option value="">
                                    {isLoadingPositions 
                                      ? 'Yükleniyor...' 
                                      : !values.department 
                                        ? 'Önce departman seçiniz' 
                                        : 'Seçiniz'}
                                  </option>
                                  {!isLoadingPositions && positions.map((pos) => (
                                    <option key={pos.id} value={pos.id}>
                                      {pos.name}
                                    </option>
                                  ))}
                                </Input>
                                {isLoadingPositions && (
                                  <div className="absolute right-10 top-1/2 transform -translate-y-1/2 flex items-center">
                                    <div className="w-4 h-4 border-t-2 border-b-2 border-primary-600 rounded-full animate-spin"></div>
                                  </div>
                                )}
                                {positionError && !isLoadingPositions && values.department && (
                                  <p className="mt-1 text-sm text-amber-500">
                                    {positionError} - Varsayılan pozisyonlar kullanılıyor
                                  </p>
                                )}
                              </div>
                            )}
                          </Field>
                        </div>
                      </div>
                      
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          loading={isSubmitting}
                          disabled={isSubmitting || loading || isLoadingPositions}
                        >
                          Değişiklikleri Kaydet
                        </Button>
                      </div>
                    </div>
                  </Form>
                )}
              </Formik>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h2 className="text-xl font-semibold">Şifre Değiştir</h2>
            </Card.Header>
            <Card.Body>
              <Formik
                initialValues={{
                  currentPassword: '',
                  newPassword: '',
                  confirmNewPassword: ''
                }}
                validationSchema={passwordSchema}
                onSubmit={handleChangePassword}
              >
                {({ errors, touched, isSubmitting }) => (
                  <Form>
                    <div className="space-y-4">
                      <Field name="currentPassword">
                        {({ field }) => (
                          <Input
                            {...field}
                            type={showPassword ? 'text' : 'password'}
                            label="Mevcut Şifre"
                            placeholder="********"
                            error={touched.currentPassword && errors.currentPassword}
                            required
                          />
                        )}
                      </Field>
                      
                      <Field name="newPassword">
                        {({ field }) => (
                          <Input
                            {...field}
                            type={showPassword ? 'text' : 'password'}
                            label="Yeni Şifre"
                            placeholder="********"
                            error={touched.newPassword && errors.newPassword}
                            required
                          />
                        )}
                      </Field>
                      
                      <Field name="confirmNewPassword">
                        {({ field }) => (
                          <Input
                            {...field}
                            type={showPassword ? 'text' : 'password'}
                            label="Yeni Şifre Tekrarı"
                            placeholder="********"
                            error={touched.confirmNewPassword && errors.confirmNewPassword}
                            required
                          />
                        )}
                      </Field>
                      
                      <div className="flex items-center mt-2">
                        <input
                          type="checkbox"
                          id="showPassword"
                          checked={showPassword}
                          onChange={() => setShowPassword(!showPassword)}
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <label htmlFor="showPassword" className="ml-2 block text-sm text-gray-700">
                          Şifreyi Göster
                        </label>
                      </div>
                      
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-2">Şifreniz:</p>
                        <ul className="text-xs text-gray-500 list-disc pl-5">
                          <li>En az 8 karakter uzunluğunda olmalıdır</li>
                          <li>En az bir büyük harf içermelidir</li>
                          <li>En az bir küçük harf içermelidir</li>
                          <li>En az bir rakam içermelidir</li>
                          <li>En az bir özel karakter içermelidir (@$!%*?&)</li>
                        </ul>
                      </div>
                      
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          loading={isSubmitting}
                          disabled={isSubmitting || loading}
                        >
                          Şifreyi Değiştir
                        </Button>
                      </div>
                    </div>
                  </Form>
                )}
              </Formik>
            </Card.Body>
          </Card>
        </div>
        
        {/* Sağ Taraf - Kullanıcı Özeti */}
        <div>
          <Card>
            <Card.Header>
              <h2 className="text-xl font-semibold">Hesap Bilgileri</h2>
            </Card.Header>
            <Card.Body>
              <div className="flex items-center justify-center mb-6">
                <div className="h-24 w-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-2xl font-bold">
                  {userDisplayData.initials}
                </div>
              </div>
              
              <div className="text-center mb-4">
                <h3 className="text-lg font-medium">{userDisplayData.fullName}</h3>
                <p className="text-gray-500">{user.email}</p>
                {userDeptPos ? (
                  <p className="text-sm text-gray-600 mt-1">{userDeptPos}</p>
                ) : (
                  <p className="text-sm text-gray-400 mt-1">Departman/Pozisyon belirtilmemiş</p>
                )}
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 font-medium">Rol:</span>
                  <span className="text-gray-800">{user.role || 'Kullanıcı'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 font-medium">Kayıt Tarihi:</span>
                  <span className="text-gray-800">{formatDate(user.createdAt)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 font-medium">Son Giriş:</span>
                  <span className="text-gray-800">{user.lastLogin ? formatDate(user.lastLogin) : 'Bilgi yok'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 font-medium">Hesap Durumu:</span>
                  <span className={`font-medium ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {user.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;