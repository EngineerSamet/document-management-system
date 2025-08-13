import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDocuments } from '../../hooks/useDocuments';

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const location = useLocation();
  const { user, refreshUserInfo } = useAuth();
  const { getPendingApprovals } = useDocuments();
  const [pendingCount, setPendingCount] = useState(0);
    // State'leri kaldırıp doğrudan useMemo ile hesaplayacağız
  const trigger = useRef(null);
  const sidebar = useRef(null);
  const sidebarOpenRef = useRef(sidebarOpen);
  
  // sidebarOpen değiştiğinde ref'i güncelle
  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);
  
  // Kullanıcı baş harflerini güvenli bir şekilde al - memoize edilmiş
  const getUserInitials = useCallback((userData) => {
    if (!userData) return 'KK';
    
    const firstName = userData.firstName || '';
    const lastName = userData.lastName || '';
    
    // Eğer isim veya soyisim tanımsız veya "undefined" string ise
    if (!firstName || !lastName || firstName === 'undefined' || lastName === 'undefined') {
      // E-posta adresinden ilk harfi al veya varsayılan değer kullan
      if (userData.email) {
        return userData.email.charAt(0).toUpperCase();
      }
      return 'K';
    }
    
    return firstName.charAt(0) + lastName.charAt(0);
  }, []);
  
  // Kullanıcı tam adını güvenli bir şekilde al - memoize edilmiş
  const getFullName = useCallback((userData) => {
    if (!userData) return 'Kullanıcı Adı';
    
    const firstName = userData.firstName || '';
    const lastName = userData.lastName || '';
    
    // Eğer isim veya soyisim tanımsız veya "undefined" string ise
    if (!firstName || !lastName || firstName === 'undefined' || lastName === 'undefined') {
      // E-posta adresini göster veya varsayılan değer kullan
      return userData.email || 'Kullanıcı Adı';
    }
    
    return `${firstName} ${lastName}`;
  }, []);
  
  // Departman ve pozisyon bilgisini güvenli bir şekilde al - memoize edilmiş
  const getDepartmentPosition = useCallback((userData) => {
    if (!userData) return 'Departman / Pozisyon';
    
    const department = userData.department || '';
    const position = userData.position || '';
    
    if (!department && !position) {
      return 'Departman / Pozisyon';
    }
    
    if (!department) {
      return position;
    }
    
    if (!position) {
      return department;
    }
    
    return `${department} / ${position}`;
  }, []);
  
  // Kullanıcı bilgilerini kullanarak memoize edilmiş değerler
  const userDisplayData = useMemo(() => {
    if (!user) {
      return {
        initials: 'KK',
        name: 'Kullanıcı Adı',
        deptPos: 'Departman / Pozisyon'
      };
    }
    
    return {
      initials: getUserInitials(user),
      name: getFullName(user),
      deptPos: getDepartmentPosition(user)
    };
  }, [user, getUserInitials, getFullName, getDepartmentPosition]);
  
  // Kullanıcı bilgilerini güncelle - sadece bir kez çalışsın
  useEffect(() => {
    // API'den kullanıcı bilgilerini yenile
    const timer = setTimeout(() => {
      refreshUserInfo().catch(err => {
        console.error('Kullanıcı bilgilerini yenileme hatası:', err);
      });
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []); // Boş dependency array - sadece component mount olduğunda çalışsın
  
  // Onay bekleyen belgelerin sayısını getir
  useEffect(() => {
    let isMounted = true; // Unmount kontrolü için bayrak
    let pendingCountInterval = null; // Interval temizleme için referans
    
    const fetchPendingCount = async () => {
      if (!user || !isMounted) return;
      
      try {
        // Son başarısız API isteğinden bu yana yeterli zaman geçti mi kontrol et
        const lastFailedApiCall = localStorage.getItem('lastFailedPendingApiCall');
        const cooldownPeriod = 120000; // 2 dakika (daha uzun cooldown)
        
        if (lastFailedApiCall) {
          const timeSinceLastFailure = Date.now() - parseInt(lastFailedApiCall);
          if (timeSinceLastFailure < cooldownPeriod) {
            console.warn(`Sidebar: Son başarısız denemeden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, belge sayısı alınamadı`);
            return; // Cooldown süresi dolmadan yeni istek yapma
          }
        }
        
        // Daha önceki başarılı çağrı zamanını kontrol et
        // Çok sık çağrı yapmayı engelle
        const lastSuccessfulFetch = localStorage.getItem('lastSuccessfulPendingFetch');
        const minFetchInterval = 300000; // 5 dakika
        
        if (lastSuccessfulFetch) {
          const timeSinceLastSuccess = Date.now() - parseInt(lastSuccessfulFetch);
          if (timeSinceLastSuccess < minFetchInterval) {
            console.log(`Sidebar: Son başarılı çağrıdan bu yana sadece ${Math.round(timeSinceLastSuccess/1000)} saniye geçti, yeni istek yapılmıyor`);
            return; // Minimum süre geçmeden yeni istek yapma
          }
        }
        
        console.log('Sidebar: Onay bekleyen belge sayısı alınıyor...');
        
        // getPendingApprovals artık hata fırlatmadığı için direkt olarak çağırabiliriz
        const response = await getPendingApprovals();
        
        // Component unmount olduysa işlemi durdur
        if (!isMounted) return;
        
        // Yanıt kontrolü
        if (!response || !response.data) {
          console.warn('Sidebar: Onay bekleyen belgeler için geçersiz yanıt alındı');
          return;
        }
        
        // Başarılı çağrı zamanını kaydet
        localStorage.setItem('lastSuccessfulPendingFetch', Date.now().toString());
        
        // Veri yapısı kontrolü
        let documents = [];
        
        // Farklı API yanıt yapılarını kontrol et
        if (response.data && response.data.data && response.data.data.documents) {
          // Yeni API yanıt yapısı
          documents = response.data.data.documents;
        } else if (response.data && response.data.documents) {
          // Eski API yanıt yapısı
          documents = response.data.documents;
        }
        
        // Sadece onaylayabileceği belgeleri say (basitleştirilmiş filtre)
        const approvableDocuments = documents.filter(doc => 
          doc.status === 'pending' || doc.status === 'in_review'
        );
        
        // Belge sayısını güncelle
        if (isMounted) {
          setPendingCount(approvableDocuments.length);
          console.log(`Sidebar: ${approvableDocuments.length} onay bekleyen belge bulundu`);
        }
      } catch (error) {
        // Hata durumunda sessizce devam et
        console.error('Sidebar: Onay bekleyen belge sayısı alınamadı:', error);
      }
    };
    
    // Sayfa yüklendiğinde bir kez çalıştır - 1 saniye gecikme ile
    const initialFetchTimeout = setTimeout(() => {
      fetchPendingCount();
    }, 1000);
    
    // 20 dakikada bir güncelle, daha seyrek API çağrısı
    pendingCountInterval = setInterval(() => {
      fetchPendingCount();
    }, 20 * 60 * 1000); // 20 dakika
    
    // Cleanup function
    return () => {
      isMounted = false;
      clearTimeout(initialFetchTimeout);
      clearInterval(pendingCountInterval);
    };
  }, [user]); // getPendingApprovals'ı dependency array'den çıkarıyoruz

  // Mobil cihazlarda sidebar dışına tıklanınca sidebar'ı kapat
  useEffect(() => {
    const clickHandler = ({ target }) => {
      if (!sidebar.current || !trigger.current) return;
      if (!sidebarOpenRef.current || sidebar.current.contains(target) || trigger.current.contains(target)) return;
      
      // setTimeout kullanarak event loop'un bir sonraki tick'inde çalıştır
      // Bu, React'in render döngüsünü bozmaz
      setTimeout(() => {
        setSidebarOpen(false);
      }, 0);
    };
    
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  }, []); // Boş dependency array - sadece mount olduğunda çalışsın

  // ESC tuşuna basılınca sidebar'ı kapat
  useEffect(() => {
    const keyHandler = ({ keyCode }) => {
      if (!sidebarOpenRef.current || keyCode !== 27) return;
      
      // setTimeout kullanarak event loop'un bir sonraki tick'inde çalıştır
      setTimeout(() => {
        setSidebarOpen(false);
      }, 0);
    };
    
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, []); // Boş dependency array - sadece mount olduğunda çalışsın

  // Sayfa değiştiğinde mobil cihazlarda sidebar'ı kapat
  useEffect(() => {
    if (sidebarOpenRef.current && window.innerWidth < 1024) {
      // setTimeout kullanarak event loop'un bir sonraki tick'inde çalıştır
      setTimeout(() => {
        setSidebarOpen(false);
      }, 0);
    }
  }, [location.pathname]); // Sadece location.pathname değiştiğinde çalışsın

  // Menü öğelerini oluşturan fonksiyon
  const renderMenuItems = () => {
    // Tüm kullanıcılar için ortak menü öğeleri
    const commonItems = [
      { path: '/dashboard', label: 'Gösterge Paneli', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { path: '/belgeler', label: 'Belgelerim', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { path: '/belge-olustur', label: 'Yeni Belge', icon: 'M12 4v16m8-8H4' },
      { 
        path: '/onay-bekleyenler', 
        label: 'Onay Bekleyenler', 
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
        badge: pendingCount > 0 ? pendingCount : null
      },
      { path: '/profil', label: 'Profilim', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    ];

    // Sadece admin için ek menü öğeleri
    const adminItems = user && user.role === 'ADMIN' ? [
      { separator: true, label: 'Yönetim' },
      { path: '/admin', label: 'Admin Paneli', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', end: true },
      { path: '/admin/kullanicilar', label: 'Kullanıcı Yönetimi', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
      { path: '/admin/onay-akislari', label: 'Onay Akışları', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
      { path: '/admin/sistem-loglari', label: 'Sistem Logları', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ] : [];

    return [...commonItems, ...adminItems];
  };

  return (
    <>
      {/* Mobil overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden lg:z-auto transition-opacity duration-200 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      ></div>

      {/* Sidebar */}
      <div
        ref={sidebar}
        className={`fixed z-40 left-0 top-0 lg:static lg:left-auto lg:top-auto lg:translate-x-0 h-screen overflow-y-scroll lg:overflow-y-auto no-scrollbar w-64 lg:w-72 lg:sidebar flex-shrink-0 bg-white p-4 transition-all duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-64'
        }`}
      >
        {/* Sidebar başlık */}
        <div className="flex justify-between mb-10 pr-3 sm:px-2">
          <div className="flex items-center">
            <NavLink to="/" className="text-xl font-bold text-primary-800">
              Evrak Yönetim
            </NavLink>
          </div>
          {/* Mobil kapatma butonu */}
          <button
            ref={trigger}
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-controls="sidebar"
          >
            <span className="sr-only">Menüyü kapat</span>
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.7 18.7l1.4-1.4L7.8 13H20v-2H7.8l4.3-4.3-1.4-1.4L4 12z" />
            </svg>
          </button>
        </div>

        {/* Menü öğeleri */}
        <div>
          <h3 className="text-xs uppercase text-gray-500 font-semibold pl-3 mb-2">Ana Menü</h3>
          <ul className="mb-6">
            {renderMenuItems().map((item, index) => {
              if (item.separator) {
                return (
                  <li key={`sep-${index}`} className="py-2">
                    <h3 className="text-xs uppercase text-gray-500 font-semibold pl-3 mb-2">{item.label}</h3>
                  </li>
                );
              }
              
              return (
                <li key={index} className="mb-1">
                  <NavLink
                    end={item.end !== undefined ? item.end : item.path === '/dashboard'}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 rounded-lg transition duration-150 ${
                        isActive
                          ? 'bg-primary-100 text-primary-800'
                          : 'text-gray-600 hover:bg-secondary-100'
                      }`
                    }
                  >
                    <svg className="w-6 h-6 shrink-0 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto bg-primary-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
        
        {/* Kullanıcı bilgileri */}
        <div className="mt-auto pt-3 border-t border-secondary-200">
          <div className="flex items-center px-3 py-3 mb-8">
            <div className="flex-shrink-0 mr-3">
              <div className="w-10 h-10 rounded-full bg-primary-700 flex items-center justify-center text-white">
                {userDisplayData.initials}
              </div>
            </div>
            <div className="truncate">
              <div className="font-medium text-gray-800">{userDisplayData.name}</div>
              <div className="text-xs text-gray-500">{userDisplayData.deptPos}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar; 