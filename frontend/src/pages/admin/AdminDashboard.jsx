import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useDocuments } from '../../hooks/useDocuments';
import { useAdmin } from '../../hooks/useAdmin';
import { useNotification } from '../../hooks/useNotification';
import { formatDate } from '../../utils/formatters';
import axios from 'axios'; // axios'u ekledik

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isInitialized } = useAuth();
  const { deleteAllDocuments, getPendingApprovals } = useDocuments(); // getPendingApprovals'ı buradan alıyoruz
  const { getSystemStats, deleteAllApprovalFlows } = useAdmin();
  const { successToast, errorToast } = useNotification();
  const [stats, setStats] = useState({
    userCount: 0,
    documentCount: 0,
    pendingDocuments: 0,
    approvalFlowCount: 0,
    activeUsers: []
  });
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Onay akışlarını sıfırlama modalı için state'ler
  const [showResetApprovalFlowsModal, setShowResetApprovalFlowsModal] = useState(false);
  const [resetApprovalFlowsLoading, setResetApprovalFlowsLoading] = useState(false);

  // Yetki kontrolü
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
    
    // isInitialized veya isAuthenticated değiştiğinde tekrar kontrol et
  }, [isInitialized, isAuthenticated, user, navigate, errorToast]);

  // Dashboard verilerini getir
  const fetchDashboardData = useCallback(async () => {
    // Uygulama henüz başlatılmamışsa bekle
    if (!isInitialized) {
      console.log('Auth durumu henüz başlatılmadı, dashboard verileri çekilmiyor...');
      return;
    }
    
    // Kullanıcı admin değilse veya oturum açılmamışsa veri çekme
    if (!user || user.role !== 'ADMIN' || !isAuthenticated) {
      console.warn('Admin olmayan kullanıcı veya oturum açılmamış, veri çekilmiyor');
      setLoading(false);
      return;
    }
    
    // Son başarısız dashboard veri çekme işleminden bu yana yeterli zaman geçti mi kontrol et
    const lastFailedDashboardFetch = localStorage.getItem('lastFailedDashboardFetch');
    const cooldownPeriod = 30000; // 30 saniye (daha kısa cooldown)
    
    if (lastFailedDashboardFetch) {
      const timeSinceLastFailure = Date.now() - parseInt(lastFailedDashboardFetch);
      if (timeSinceLastFailure < cooldownPeriod) {
        console.warn(`Son başarısız dashboard veri çekmesinden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
        // Mevcut verilerle devam et, yeni istek yapma
        setLoading(false);
        return;
      }
    }
    
    // Daha önceki başarılı çağrı zamanını kontrol et
    // Çok sık çağrı yapmayı engelle
    const lastSuccessfulDashboardFetch = localStorage.getItem('lastSuccessfulDashboardFetch');
    const minFetchInterval = 60000; // 1 dakika (daha kısa fetch aralığı)
    
    if (lastSuccessfulDashboardFetch) {
      const timeSinceLastSuccess = Date.now() - parseInt(lastSuccessfulDashboardFetch);
      if (timeSinceLastSuccess < minFetchInterval) {
        console.log(`AdminDashboard: Son başarılı dashboard veri çağrısından bu yana sadece ${Math.round(timeSinceLastSuccess/1000)} saniye geçti, yeni istek yapılmıyor`);
        // Önbellekteki verileri kullan
        const cachedStats = localStorage.getItem('cachedSystemStats');
        if (cachedStats) {
          try {
            const parsedStats = JSON.parse(cachedStats);
            
            // Önbellekteki verileri kontrol et
            if (parsedStats && parsedStats.data) {
              const statsData = parsedStats.data;
              
              setStats(prevStats => ({
                ...prevStats,
                userCount: statsData.userCount || 0,
                documentCount: statsData.documentCount || 0,
                pendingDocuments: statsData.pendingDocuments || 0,
                approvalFlowCount: statsData.approvalFlowCount || 0,
                systemHealth: {
                  status: parsedStats.status === 'error' ? 'warning' : 'healthy',
                  lastBackup: new Date(2023, 4, 15),
                  storageUsed: 65,
                  documentRate: [5, 12, 8, 15, 20, 18, 25]
                }
              }));
              console.log('AdminDashboard: Önbellekten yüklenen sistem istatistikleri kullanıldı');
              setLoading(false);
              return;
            } else {
              console.warn('AdminDashboard: Önbellek verisi geçersiz format, API isteği yapılacak');
            }
          } catch (e) {
            console.warn('AdminDashboard: Önbellek verisi bozuk, API isteği yapılacak');
          }
        }
      }
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Gerçek sistem istatistiklerini getir
      const systemStats = await getSystemStats();
      
      // Hata kontrolü - eğer API'den hata döndüyse
      if (systemStats.error) {
        // Hata mesajını kaydet ama toast gösterme
        // Kullanıcı deneyimini bozmamak için sessizce devam et
        console.warn('Sistem istatistikleri alınamadı:', systemStats.error);
        setError(systemStats.error);
      }
      
      // API'den gelen verileri kontrol et ve güvenli bir şekilde kullan
      const data = systemStats.data || {};
      
      // Sistem istatistiklerini güncelle - hata olsa bile varsayılan değerler kullanılacak
      setStats(prevStats => {
        // API yanıtını kontrol et
        if (data && typeof data === 'object') {
          return {
            ...prevStats, // Önceki state'i koru, sadece değişenleri güncelle
            userCount: data.userCount !== undefined ? data.userCount : (systemStats.userCount || 0),
            documentCount: data.documentCount !== undefined ? data.documentCount : (systemStats.documentCount || 0),
            pendingDocuments: data.pendingDocuments !== undefined ? data.pendingDocuments : (systemStats.pendingDocuments || 0),
            approvalFlowCount: data.approvalFlowCount !== undefined ? data.approvalFlowCount : (systemStats.approvalFlowCount || 0),
            systemHealth: {
              status: systemStats.status === 'error' ? 'warning' : 'healthy',
              lastBackup: new Date(2023, 4, 15),
              storageUsed: 65,
              documentRate: [5, 12, 8, 15, 20, 18, 25]
            }
          };
        } else {
          console.warn('AdminDashboard: API yanıtında geçerli veri yok, varsayılan değerler kullanılıyor');
          return {
            ...prevStats,
            userCount: 0,
            documentCount: 0,
            pendingDocuments: 0,
            approvalFlowCount: 0,
            systemHealth: {
              status: 'warning',
              lastBackup: new Date(2023, 4, 15),
              storageUsed: 65,
              documentRate: [5, 12, 8, 15, 20, 18, 25]
            }
          };
        }
      });
      
      // Başarılı API çağrısı, cooldown kaydını temizle
      localStorage.removeItem('lastFailedDashboardFetch');
      
      // Başarılı çağrı zamanını kaydet
      localStorage.setItem('lastSuccessfulDashboardFetch', Date.now().toString());
      
      // Verileri önbelleğe kaydet
      localStorage.setItem('cachedSystemStats', JSON.stringify(systemStats));
      
      setLoading(false);
      
    } catch (error) {
      console.error('Sistem istatistikleri alınamadı:', error);
      
      // Network hatası durumunda son başarısız deneme zamanını kaydet
      if (error.message === 'Network Error' || 
          error.code === 'ERR_NETWORK' || 
          error.code === 'ECONNABORTED' || 
          error.message?.includes('timeout') ||
          error.message?.includes('ERR_INSUFFICIENT_RESOURCES') ||
          error.name === 'AbortError' ||
          error.name === 'CanceledError' ||
          error.code === 'ERR_CANCELED') {
        
        localStorage.setItem('lastFailedDashboardFetch', Date.now().toString());
        console.warn('Network hatası nedeniyle dashboard verisi alınamadı, sonraki denemeler için cooldown uygulanacak');
      }
      
      setError('Yönetici paneli verileri yüklenirken bir hata oluştu');
      setLoading(false);
    }
  }, [getSystemStats, user, isAuthenticated, isInitialized]);

  // Onay bekleyen belgelerin sayısını getir
  const fetchPendingDocumentsCount = useCallback(async () => {
    // Kullanıcı admin değilse veya oturum açılmamışsa veri çekme
    if (!user || user.role !== 'ADMIN' || !isAuthenticated || !isInitialized) {
      return;
    }
    
    try {
      // Onay bekleyen belgelerin sayısını localStorage'dan kontrol et
      // Eğer son 5 dakika içinde alınmışsa tekrar istek yapma
      const lastSuccessfulPendingFetch = localStorage.getItem('lastSuccessfulPendingFetch');
      const minFetchInterval = 300000; // 5 dakika
      
      if (lastSuccessfulPendingFetch) {
        const timeSinceLastSuccess = Date.now() - parseInt(lastSuccessfulPendingFetch);
        if (timeSinceLastSuccess < minFetchInterval) {
          console.log(`AdminDashboard: Son başarılı onay bekleyen belge çağrısından bu yana sadece ${Math.round(timeSinceLastSuccess/1000)} saniye geçti, yeni istek yapılmıyor`);
          return; // Minimum süre geçmeden yeni istek yapma
        }
      }
      
      // Son başarısız API isteğinden bu yana yeterli zaman geçti mi kontrol et
      const lastFailedPendingApiCall = localStorage.getItem('lastFailedPendingApiCall');
      const cooldownPeriod = 120000; // 2 dakika
      
      if (lastFailedPendingApiCall) {
        const timeSinceLastFailure = Date.now() - parseInt(lastFailedPendingApiCall);
        if (timeSinceLastFailure < cooldownPeriod) {
          console.warn(`AdminDashboard: Son başarısız onay bekleyen belge denemesinden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
          return; // Cooldown süresi dolmadan yeni istek yapma
        }
      }
      
      // Onay bekleyen belgelerin sayısını API'den al
      console.log('AdminDashboard: Onay bekleyen belgeler alınıyor...');
      const pendingResponse = await getPendingApprovals(1, 1); // Sadece sayı için 1 belge yeterli
      
      if (pendingResponse && pendingResponse.data && pendingResponse.data.data) {
        // Toplam sayıyı al
        const pendingCount = pendingResponse.data.data.pagination?.total || 0;
        
        // State'i güncelle
        setStats(prevStats => ({
          ...prevStats,
          pendingDocuments: pendingCount
        }));
        
        // Başarılı çağrı zamanını kaydet
        localStorage.setItem('lastSuccessfulPendingFetch', Date.now().toString());
        
        console.log(`AdminDashboard: ${pendingCount} onay bekleyen belge bulundu`);
      }
    } catch (error) {
      console.warn('AdminDashboard: Onay bekleyen belgelerin sayısı alınamadı:', error);
      // Hata durumunda mevcut değeri koru
    }
  }, [getPendingApprovals, user, isAuthenticated, isInitialized]);

  // Aktif kullanıcıları getiren ayrı bir fonksiyon
  // Bu sayede ana dashboard verileri ve kullanıcı verileri ayrı ayrı yönetilebilir
  const fetchActiveUsers = useCallback(async () => {
    // Uygulama henüz başlatılmamışsa bekle
    if (!isInitialized) {
      console.log('Auth durumu henüz başlatılmadı, aktif kullanıcılar çekilmiyor...');
      return;
    }
    
    // Kullanıcı admin değilse veya oturum açılmamışsa veri çekme
    if (!user || user.role !== 'ADMIN' || !isAuthenticated) {
      console.warn('Admin olmayan kullanıcı veya oturum açılmamış, aktif kullanıcılar çekilmiyor');
      return;
    }
    
    try {
      // Son başarısız API isteğinden bu yana yeterli zaman geçti mi kontrol et
      const lastFailedApiCall = localStorage.getItem('lastFailedAdminApiCall');
      const cooldownPeriod = 60000; // 60 saniye
      
      if (lastFailedApiCall) {
        const timeSinceLastFailure = Date.now() - parseInt(lastFailedApiCall);
        if (timeSinceLastFailure < cooldownPeriod) {
          console.warn(`Son başarısız API çağrısından bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
          console.log('Aktif kullanıcı verisi alınamadı, mevcut liste kullanılıyor');
          // Mevcut liste ile devam et, yeni istek yapma
          return;
        }
      }
      
      // AbortController oluştur ve timeout ayarla
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 3000); // 3 saniye timeout
      
      // Admin debug endpoint'ini kullan - tüm kullanıcıları getir
      const usersResponse = await axios.get('/api/admin/users/debug', {
        timeout: 3000, // 3 saniye
        signal: abortController.signal
      });
      
      // Timeout'u temizle
      clearTimeout(timeoutId);
      
      if (usersResponse.data && usersResponse.data.data && usersResponse.data.data.users) {
        // Aktif kullanıcıları filtrele
        const allUsers = usersResponse.data.data.users;
        const activeUsers = allUsers
          .filter(user => user.isActive)
          .map(user => ({
            id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            department: user.department || 'Belirtilmemiş',
            documentCount: 0, // API'den belge sayısı gelmiyorsa 0 olarak ayarla
            lastActive: user.lastLogin || user.updatedAt || user.createdAt // Son giriş tarihi, güncelleme tarihi veya oluşturma tarihi
          }))
          .slice(0, 4); // İlk 4 kullanıcıyı göster
          
        // Başarılı API çağrısı, cooldown kaydını temizle
        localStorage.removeItem('lastFailedAdminApiCall');
        
        // State'i güncelle
        setStats(prevStats => ({
          ...prevStats,
          activeUsers: activeUsers
        }));
      }
    } catch (userError) {
      console.error('Aktif kullanıcıları getirme hatası:', userError);
      
      // Network hatası durumunda son başarısız deneme zamanını kaydet
      if (userError.message === 'Network Error' || 
          userError.code === 'ERR_NETWORK' || 
          userError.code === 'ECONNABORTED' || 
          userError.message.includes('timeout') ||
          userError.message.includes('ERR_INSUFFICIENT_RESOURCES') ||
          userError.name === 'AbortError' ||
          userError.name === 'CanceledError') {
        
        localStorage.setItem('lastFailedAdminApiCall', Date.now().toString());
        console.warn('Network hatası nedeniyle aktif kullanıcı verisi alınamadı, sonraki denemeler için cooldown uygulanacak');
      }
      
      // Varsayılan kullanıcı verileri oluştur
      const defaultUsers = [
        {
          id: '1',
          name: 'Admin User',
          department: 'Yönetim',
          documentCount: 5,
          lastActive: new Date().toISOString()
        }
      ];
      
      // State'i güncelle - varsayılan verilerle
      setStats(prevStats => ({
        ...prevStats,
        activeUsers: prevStats.activeUsers.length > 0 ? prevStats.activeUsers : defaultUsers
      }));
    }
  }, [user, isAuthenticated, isInitialized]);

  // useEffect içinde fetchDashboardData'yı çağır
  useEffect(() => {
    document.title = 'Yönetici Paneli - Evrak Yönetim Sistemi';
    
    // Sayfa yenileme durumunu tespit et ve kaydet
    // Bu bilgi admin.js içinde kullanılacak
    const setPageRefreshFlag = () => {
      sessionStorage.setItem('isPageRefresh', 'true');
    };
    
    // Sayfa yenilendiğinde çalışacak event listener
    window.addEventListener('beforeunload', setPageRefreshFlag);
    
    // İşlemin devam edip etmediğini takip etmek için bir flag
    let isMounted = true;
    
    // Kullanıcı bilgileri hazır olduğunda ve admin ise verileri getir
    if (isInitialized && isAuthenticated && user && user.role === 'ADMIN') {
      // Sayfa yüklendiğinde verileri bir kez getir
      fetchDashboardData().catch(err => {
        if (isMounted) {
          console.error('Dashboard verilerini getirme hatası:', err);
        }
      });
      
      // Onay bekleyen belgelerin sayısını ayrı bir işlemde getir
      // Ancak ilk çağrıdan sonra biraz bekle
      const pendingTimeout = setTimeout(() => {
        if (isMounted) {
          fetchPendingDocumentsCount().catch(err => {
            if (isMounted) {
              console.error('Onay bekleyen belgeleri getirme hatası:', err);
            }
          });
        }
      }, 5000); // 5 saniye gecikme ile çağır (daha uzun gecikme)
      
      // Aktif kullanıcıları ayrı bir işlemde getir
      // Bu sayede ana dashboard verileri daha hızlı yüklenir
      // ve bir API çağrısı başarısız olsa bile diğeri çalışabilir
      const usersTimeout = setTimeout(() => {
        if (isMounted) {
          fetchActiveUsers().catch(err => {
            if (isMounted) {
              console.error('Aktif kullanıcıları getirme hatası:', err);
            }
          });
        }
      }, 1); //  0.001 saniye → yani neredeyse anında çalışır.
      
      // Komponent unmount olduğunda çalışacak temizleme fonksiyonu
      return () => {
        isMounted = false;
        clearTimeout(pendingTimeout);
        clearTimeout(usersTimeout);
        window.removeEventListener('beforeunload', setPageRefreshFlag);
      };
    }
    
    // Komponent unmount olduğunda çalışacak temizleme fonksiyonu
    return () => {
      isMounted = false;
      window.removeEventListener('beforeunload', setPageRefreshFlag);
    };
  }, [fetchDashboardData, fetchPendingDocumentsCount, fetchActiveUsers, isInitialized, isAuthenticated, user]);

  // Tüm belgeleri silme işlemi
  const handleResetSystem = async () => {
    try {
      setResetLoading(true);
      
      // Önce belgeleri sil
      const result = await deleteAllDocuments();
      
      // Onay akışlarını da sil (opsiyonel)
      try {
        await deleteAllApprovalFlows();
        successToast('Tüm belgeler ve onay akışları başarıyla silindi');
      } catch (approvalError) {
        console.error('Onay akışlarını silme hatası:', approvalError);
        successToast('Tüm belgeler silindi, ancak onay akışları silinirken bir hata oluştu');
      }
      
      setShowResetModal(false);
      
      // Verileri yenile
      await fetchDashboardData();
    } catch (error) {
      console.error('Tüm belgeleri silme hatası:', error);
      errorToast(error.response?.data?.message || 'Tüm belgeler silinirken bir hata oluştu');
    } finally {
      setResetLoading(false);
    }
  };
  
  // Sadece onay akışlarını silme işlemi
  const handleResetApprovalFlows = async () => {
    try {
      setResetApprovalFlowsLoading(true);
      
      // Onay akışlarını sil
      const result = await deleteAllApprovalFlows();
      successToast(result.message || 'Tüm onay akışları başarıyla silindi');
      setShowResetApprovalFlowsModal(false);
      
      // Verileri yenile
      await fetchDashboardData();
    } catch (error) {
      console.error('Tüm onay akışlarını silme hatası:', error);
      errorToast(error.response?.data?.message || 'Tüm onay akışları silinirken bir hata oluştu');
    } finally {
      setResetApprovalFlowsLoading(false);
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

  // İstatistik kartları
  const statCards = [
    {
      title: 'Toplam Kullanıcılar',
      value: stats.userCount,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      color: 'text-blue-600 bg-blue-100',
      link: '/admin/kullanicilar'
    },
    {
      title: 'Toplam Belgeler',
      value: stats.documentCount,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'text-green-600 bg-green-100',
      link: '/belgeler'
    },
    {
      title: 'Onay Bekleyenler',
      value: stats.pendingDocuments,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      color: 'text-yellow-600 bg-yellow-100',
      link: '/onay-bekleyenler'
    },
    {
      title: 'Onay Akışları',
      value: stats.approvalFlowCount,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'text-purple-600 bg-purple-100',
      link: '/admin/onay-akislari'
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Yönetici Paneli</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Hoş geldiniz, {user?.firstName} {user?.lastName}
          </div>
          <Button 
            color="warning" 
            onClick={() => setShowResetApprovalFlowsModal(true)}
            className="whitespace-nowrap"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Onay Akışlarını Sıfırla
          </Button>
          <Button 
            color="danger" 
            onClick={() => setShowResetModal(true)}
            className="whitespace-nowrap"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Sistemi Sıfırla
          </Button>
        </div>
      </div>

      {/* Hata mesajı */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {statCards.map((stat, index) => (
          <Link key={index} to={stat.link}>
            <Card className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-5">
                <div className="flex items-center">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-md ${stat.color}`}>
                    {stat.icon}
                  </div>
                  <div className="ml-5">
                    <div className="mt-1 text-3xl font-semibold text-gray-900">
                      {loading ? (
                        <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
                      ) : (
                        <div className="flex items-center">
                          <span>{stat.value}</span>
                          {stat.value > 0 && (
                            <span className="ml-2 text-xs font-normal text-gray-500">
                              {stat.title === 'Onay Bekleyenler' && stat.value > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Bekliyor
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-500 truncate">{stat.title}</div>
                  </div>
                </div>
              </div>
              {stat.title === 'Onay Bekleyenler' && stat.value > 0 && (
                <div className="bg-yellow-50 px-5 py-2 border-t border-yellow-100">
                  <div className="text-xs text-yellow-700">
                    Onay bekleyen belgeler var
                  </div>
                </div>
              )}
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aktif Kullanıcılar */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden h-full">
            <Card.Header className="bg-white">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Aktif Kullanıcılar</h2>
                <Link to="/admin/kullanicilar" className="text-sm text-primary-600 hover:text-primary-800">
                  Tüm Kullanıcıları Görüntüle
                </Link>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {loading ? (
                <div className="flex justify-center items-center p-6">
                  <div className="w-8 h-8 border-t-4 border-b-4 border-primary-600 rounded-full animate-spin"></div>
                </div>
              ) : stats.activeUsers.length === 0 ? (
                <div className="text-center p-6 text-gray-500">
                  Henüz aktif kullanıcı bulunmuyor.
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
                          Departman
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Belge Sayısı
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Son Aktif
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.activeUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700">
                                {user.name.charAt(0)}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{user.department}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{user.documentCount}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(user.lastActive)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>

        {/* Sistem Durumu */}
        
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hızlı Erişim */}
        <Card>
          <Card.Header className="bg-white">
            <h2 className="text-lg font-semibold text-gray-900">Hızlı Erişim</h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/admin/kullanicilar"
                className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">Kullanıcı Ekle</div>
                </div>
              </Link>
              
              <Link
                to="/admin/onay-akislari"
                className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">Onay Akışı Oluştur</div>
                </div>
              </Link>
              
              <Link
                to="/admin/sistem-loglari"
                className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">Sistem Logları</div>
                </div>
              </Link>
              
              <Link
                to="/belge-olustur"
                className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-700">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">Belge Oluştur</div>
                </div>
              </Link>
            </div>
          </Card.Body>
        </Card>
        
        {/* Son Etkinlikler */}
        <Card>
          <Card.Header className="bg-white">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Son Etkinlikler</h2>
              <Link to="/admin/sistem-loglari" className="text-sm text-primary-600 hover:text-primary-800">
                Tüm Logları Görüntüle
              </Link>
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            {loading ? (
              <div className="flex justify-center items-center p-6">
                <div className="w-8 h-8 border-t-4 border-b-4 border-primary-600 rounded-full animate-spin"></div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                <li className="p-4 hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">Yeni kullanıcı oluşturuldu: <span className="font-semibold">Ali Yılmaz</span></p>
                      <p className="text-xs text-gray-500">3 saat önce</p>
                    </div>
                  </div>
                </li>
                
                <li className="p-4 hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">Belge onaylandı: <span className="font-semibold">Finans Raporu Q2</span></p>
                      <p className="text-xs text-gray-500">5 saat önce</p>
                    </div>
                  </div>
                </li>
                
                <li className="p-4 hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">Yeni onay akışı oluşturuldu: <span className="font-semibold">Satış Sözleşme Onayı</span></p>
                      <p className="text-xs text-gray-500">1 gün önce</p>
                    </div>
                  </div>
                </li>
                
                <li className="p-4 hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-red-100 flex items-center justify-center text-red-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">Belge reddedildi: <span className="font-semibold">Müşteri Anlaşması XYZ Ltd.</span></p>
                      <p className="text-xs text-gray-500">2 gün önce</p>
                    </div>
                  </div>
                </li>
              </ul>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Reset Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => !resetLoading && setShowResetModal(false)}
        title="Sistemi Sıfırla"
        size="md"
      >
        <div className="p-4">
          <div className="text-red-600 font-bold mb-4">
            DİKKAT: Bu işlem tüm belgeleri ve onay akışlarını kalıcı olarak silecektir!
          </div>
          <p className="mb-6 text-gray-700">
            Onay bekleyen belgeler ve tanımlı onay akışları da dahil olmak üzere sistemdeki <span className="font-bold">tüm belgeler ve onay akışları</span> silinecektir. Bu işlem geri alınamaz.
          </p>
          <div className="flex justify-end gap-2">
            <Button 
              color="secondary" 
              onClick={() => setShowResetModal(false)}
              disabled={resetLoading}
            >
              İptal
            </Button>
            <Button 
              color="danger" 
              onClick={handleResetSystem}
              disabled={resetLoading}
              className="flex items-center"
            >
              {resetLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  İşleniyor...
                </>
              ) : (
                'Tüm Belgeleri ve Onay Akışlarını Sil'
              )}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Onay Akışlarını Sıfırlama Modal */}
      <Modal
        isOpen={showResetApprovalFlowsModal}
        onClose={() => !resetApprovalFlowsLoading && setShowResetApprovalFlowsModal(false)}
        title="Onay Akışlarını Sıfırla"
        size="md"
      >
        <div className="p-4">
          <div className="text-yellow-600 font-bold mb-4">
            DİKKAT: Bu işlem tüm onay akışlarını kalıcı olarak silecektir!
          </div>
          <p className="mb-6 text-gray-700">
            Sistemdeki <span className="font-bold">tüm onay akışları</span> silinecektir. Bu işlem geri alınamaz ve mevcut belgelerin onay süreçlerini etkileyebilir.
          </p>
          <div className="flex justify-end gap-2">
            <Button 
              color="secondary" 
              onClick={() => setShowResetApprovalFlowsModal(false)}
              disabled={resetApprovalFlowsLoading}
            >
              İptal
            </Button>
            <Button 
              color="warning" 
              onClick={handleResetApprovalFlows}
              disabled={resetApprovalFlowsLoading}
              className="flex items-center"
            >
              {resetApprovalFlowsLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  İşleniyor...
                </>
              ) : (
                'Tüm Onay Akışlarını Sil'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard; 