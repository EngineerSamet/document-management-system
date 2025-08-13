import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Admin sayfalarına erişim kontrolü
  const isAdminRoute = location.pathname.startsWith('/admin');
  const hasAdminAccess = user && user.role === 'ADMIN';

  // Eğer kullanıcı admin sayfalarına erişmeye çalışıyor ve admin değilse dashboard'a yönlendir
  if (isAdminRoute && !hasAdminAccess && !loading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
  if (!loading && !isAuthenticated) {
    return <Navigate to="/giris" replace state={{ from: location }} />;
  }

  // Kullanıcı bilgileri yükleniyorsa loading göster
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      {/* Content area */}
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        
        {/* Main content */}
        <main className="flex-grow p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout; 