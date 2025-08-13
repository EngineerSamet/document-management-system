import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const Header = ({ sidebarOpen, setSidebarOpen }) => {
  const { user, logout, refreshUserInfo } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
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
        name: 'Kullanıcı Adı'
      };
    }
    
    return {
      initials: getUserInitials(user),
      name: getFullName(user)
    };
  }, [user, getUserInitials, getFullName]);
  
  // Sayfa yüklendiğinde kullanıcı bilgilerini yenile - sadece bir kez çalışsın
  useEffect(() => {
    // API'den kullanıcı bilgilerini yenile
    const timer = setTimeout(() => {
      refreshUserInfo().catch(err => {
        console.error('Kullanıcı bilgilerini yenileme hatası:', err);
      });
    }, 1000); // 1 saniye gecikme ile API isteği yap
    
    return () => clearTimeout(timer);
  }, []); // Boş dependency array - sadece component mount olduğunda çalışsın

  return (
    <header className="sticky top-0 bg-white border-b border-secondary-200 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 -mb-px">
          {/* Sidebar toggle */}
          <div className="flex lg:hidden">
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-controls="sidebar"
            >
              <span className="sr-only">Menüyü aç</span>
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="5" width="16" height="2" />
                <rect x="4" y="11" width="16" height="2" />
                <rect x="4" y="17" width="16" height="2" />
              </svg>
            </button>
          </div>

          {/* Logo (görünür alan nispeten küçük olduğunda) */}
          <div className="flex lg:hidden">
            <Link to="/" className="block">
              <span className="font-bold text-primary-800">Evrak Yönetim</span>
            </Link>
          </div>
          
          {/* Boş alan (flex-grow ile sağ tarafı ittirmek için) */}
          <div className="flex-grow"></div>

          {/* Sağ taraf aksiyon butonları */}
          <div className="flex items-center space-x-3">
            {/* Mobil arama butonu */}
            <div className="flex md:hidden">
              <button
                className="p-2 text-gray-500 rounded-md hover:bg-secondary-100"
                aria-controls="search-modal"
              >
                <span className="sr-only">Ara</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
            
            {/* Kullanıcı menüsü */}
            <div className="relative">
              <button
                className="flex items-center"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className="sr-only">Kullanıcı menüsü</span>
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-white text-sm">
                    {userDisplayData.initials}
                  </div>
                </div>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Kullanıcı dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg overflow-hidden z-10">
                  <div className="py-3 px-4 border-b border-secondary-200">
                    <div className="font-medium text-sm text-gray-800">{userDisplayData.name}</div>
                    <div className="text-xs text-gray-500 truncate">{user?.email || 'kullanici@ornek.com'}</div>
                  </div>
                  <div className="py-1">
                    <Link to="/profil" className="block px-4 py-2 text-sm text-gray-700 hover:bg-secondary-100">
                      Profilim
                    </Link>
                    {user?.role === 'ADMIN' && (
                      <Link to="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-secondary-100">
                        Admin Paneli
                      </Link>
                    )}
                  </div>
                  <div className="py-1 border-t border-secondary-200">
                    <button
                      onClick={logout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-secondary-100"
                    >
                      Çıkış Yap
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 