import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-secondary-200 py-3 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="mb-3 sm:mb-0">
          <p className="text-xs text-gray-500">
            © {currentYear} Evrak Yönetim Sistemi. Tüm hakları saklıdır.
          </p>
        </div>
        <div className="flex space-x-4">
          <Link to="/yardim" className="text-xs text-gray-500 hover:text-primary-600">
            Yardım
          </Link>
          <Link to="/destek" className="text-xs text-gray-500 hover:text-primary-600">
            Destek
          </Link>
          <Link to="/gizlilik" className="text-xs text-gray-500 hover:text-primary-600">
            Gizlilik Politikası
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 