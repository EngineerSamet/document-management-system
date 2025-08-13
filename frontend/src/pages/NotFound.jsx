import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';

const NotFound = () => {
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    document.title = 'Sayfa Bulunamadı - Evrak Yönetim Sistemi';
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 md:p-12 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="text-primary-500">
            <svg className="h-24 w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-4xl font-bold text-gray-800 mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Sayfa Bulunamadı</h2>
        
        <p className="text-gray-600 mb-8">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir. Lütfen URL'yi kontrol edin veya aşağıdaki bağlantıyı kullanarak ana sayfaya dönün.
        </p>
        
        <div className="flex justify-center">
          <Link to={isAuthenticated ? "/dashboard" : "/"}>
            <Button size="lg">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Ana Sayfaya Dön
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound; 