import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sol taraf - Logo ve kurumsal bilgiler */}
      <div className="hidden w-1/2 bg-gradient-to-br from-blue-800 to-blue-900 lg:flex lg:flex-col lg:justify-between p-12 shadow-xl">
        <div>
          <div className="mb-10 flex items-center">
            <div className="bg-white text-blue-800 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-lg mr-3">
              EYS
            </div>
            <h1 className="text-3xl font-bold text-white">Evrak Yönetim Sistemi</h1>
          </div>
          
          <div className="mb-16">
            <p className="text-xl text-blue-100 leading-relaxed">
              Kurumunuzun evrak yönetim süreçlerini kolayca yönetin, dijital dönüşümü hızlandırın.
            </p>
          </div>
          
          <div className="space-y-8">
            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-700 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Kolay Belge Yönetimi</h3>
                <p className="text-blue-200 mt-1">Belgeleri hızlıca oluşturun, düzenleyin ve yönetin.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-700 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Güvenli Erişim</h3>
                <p className="text-blue-200 mt-1">Rol tabanlı yetkilendirme ile güvenli belge erişimi.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-700 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Onay Süreçleri</h3>
                <p className="text-blue-200 mt-1">Özelleştirilebilir onay akışları ile iş süreçlerinizi hızlandırın.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-auto pt-8 border-t border-blue-700">
          <p className="text-sm text-blue-300">
            © {new Date().getFullYear()} Evrak Yönetim Sistemi. Tüm hakları saklıdır.
          </p>
        </div>
      </div>
      
      {/* Sağ taraf - Form içeriği */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2 bg-white">
        <div className="w-full max-w-md animate-fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout; 