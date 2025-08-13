import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Modern Modal bileşeni
 * @param {Object} props - Bileşen özellikleri
 * @param {boolean} props.isOpen - Modalın açık olup olmadığı
 * @param {Function} props.onClose - Modal kapatma fonksiyonu
 * @param {string} props.title - Modal başlığı
 * @param {React.ReactNode} props.children - Modal içeriği
 * @param {string} props.size - Modal boyutu (sm, md, lg, xl, full)
 * @returns {React.ReactElement}
 */
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  // ESC tuşu ile kapatma
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Scroll'u engelle
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      // Scroll'u serbest bırak
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  // Modal açık değilse render etme
  if (!isOpen) return null;

  // Modal boyutu sınıfları
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4'
  };

  // Arka planı tıklayınca kapatma işleyicisi
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-300"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="relative z-50 transform transition-all duration-300 ease-in-out scale-100 opacity-100"
        style={{
          animation: isOpen ? 'modalFadeIn 0.3s ease-out' : 'none'
        }}
      >
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl ring-1 ring-black ring-opacity-5 ${sizeClasses[size] || sizeClasses.md} overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onClick={onClose}
              aria-label="Kapat"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(100vh-200px)] scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
            {children}
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        /* Özel scrollbar stili */
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollbar-thumb-gray-300::-webkit-scrollbar-thumb {
          background-color: #d1d5db;
          border-radius: 3px;
        }
        
        .scrollbar-thumb-gray-600::-webkit-scrollbar-thumb {
          background-color: #4b5563;
          border-radius: 3px;
        }
        
        .scrollbar-track-transparent::-webkit-scrollbar-track {
          background-color: transparent;
        }
      `}</style>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'full'])
};

export default Modal; 