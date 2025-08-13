import React, { useState, useEffect } from 'react';
import { LOG_LEVELS, LOG_MODULES, LOG_CATEGORIES } from '../../models/LogCategories';
import Input from '../ui/Input';
import Button from '../ui/Button';

/**
 * Gelişmiş log filtreleme bileşeni
 * 
 * @param {Object} props - Bileşen özellikleri
 * @param {Function} props.onFilter - Filtreleme işlemi için callback fonksiyonu
 * @param {Object} props.initialFilters - Başlangıç filtre değerleri
 * @returns {JSX.Element}
 */
const LogFilters = ({ onFilter, initialFilters = {} }) => {
  // Filtre durumları
  const [searchTerm, setSearchTerm] = useState(initialFilters.searchTerm || '');
  const [level, setLevel] = useState(initialFilters.level || 'all');
  const [module, setModule] = useState(initialFilters.module || 'all');
  const [category, setCategory] = useState(initialFilters.category || 'all');
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom || '');
  const [dateTo, setDateTo] = useState(initialFilters.dateTo || '');
  const [userEmail, setUserEmail] = useState(initialFilters.userEmail || '');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(initialFilters.advanced || false);

  // Varsayılan filtre değerleri
  const defaultFilters = {
    searchTerm: '',
    level: 'all',
    module: 'all',
    category: 'all',
    dateFrom: '',
    dateTo: '',
    userEmail: ''
  };

  // Kategori etiketlerini formatla
  const formatCategoryLabel = (key) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Filtreleme işlemi
  const handleFilter = (e) => {
    e.preventDefault();
    
    // Tüm filtreleri bir nesne olarak topla
    const filters = {
      searchTerm,
      level,
      module,
      category,
      dateFrom,
      dateTo,
      userEmail,
      advanced: showAdvancedFilters
    };
    
    // 'all' değerlerini ve boş değerleri temizle
    const cleanFilters = {};
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key] !== 'all') {
        cleanFilters[key] = filters[key];
      }
    });
    
    onFilter(cleanFilters);
  };

  // Filtreleri sıfırla
  const resetFilters = () => {
    setSearchTerm('');
    setLevel('all');
    setModule('all');
    setCategory('all');
    setDateFrom('');
    setDateTo('');
    setUserEmail('');
    
    onFilter({}); // Boş filtre nesnesi gönder
  };

  // Modül değiştiğinde kategoriyi sıfırla
  useEffect(() => {
    setCategory('all');
  }, [module]);

  // Log seviyesi seçenekleri
  const levelOptions = [
    { value: 'all', label: 'Tüm Seviyeler' },
    { value: LOG_LEVELS.INFO, label: 'Bilgi' },
    { value: LOG_LEVELS.WARNING, label: 'Uyarı' },
    { value: LOG_LEVELS.ERROR, label: 'Hata' },
    { value: LOG_LEVELS.CRITICAL, label: 'Kritik' },
    { value: LOG_LEVELS.DEBUG, label: 'Debug' },
  ];

  // Log modülü seçenekleri - 
  const moduleOptions = [
    { value: 'all', label: 'Tüm Modüller' },
    { value: LOG_MODULES.AUTH, label: 'Kimlik Doğrulama' },
    { value: LOG_MODULES.USER, label: 'Kullanıcı' },
    { value: LOG_MODULES.DOCUMENT, label: 'Belge' },
    { value: LOG_MODULES.APPROVAL, label: 'Onay' },
    { value: LOG_MODULES.SYSTEM, label: 'Sistem' },
    { value: LOG_MODULES.FILE, label: 'Dosya' },
    { value: LOG_MODULES.AUDIT, label: 'Denetim' },
    { value: LOG_MODULES.SEARCH, label: 'Arama' },
  ];

  // Log kategorisi seçenekleri -
  const getCategoryOptions = () => {
    // Sadece "Tüm kategoriler" seçeneğini döndür
    return [
      { value: 'all', label: 'Tüm Kategoriler' }
    ];
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4">
        <form onSubmit={handleFilter}>
          {/* Ana Filtreler */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Arama Kutusu */}
            <div className="md:col-span-3">
              <Input
                id="searchTerm"
                name="searchTerm"
                type="text"
                placeholder="Log içeriğinde ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                }
              />
            </div>

            {/* Log Seviyesi */}
            <div>
              <Input
                id="level"
                name="level"
                as="select"
                label="Log Seviyesi"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              >
                {levelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Input>
            </div>

            {/* Log Modülü */}
            <div>
              <Input
                id="module"
                name="module"
                as="select"
                label="Modül"
                value={module}
                onChange={(e) => setModule(e.target.value)}
              >
                {moduleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Input>
            </div>

            {/* Log Kategorisi */}
            <div>
              <Input
                id="category"
                name="category"
                as="select"
                label="Kategori"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {getCategoryOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Input>
            </div>
          </div>

          {/* Gelişmiş Filtreler */}
          <div className="mt-4">
            <button
              type="button"
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              aria-expanded={showAdvancedFilters}
              aria-controls="advanced-filters"
            >
              <svg 
                className={`w-4 h-4 mr-1 transform transition-transform ${showAdvancedFilters ? 'rotate-90' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              Gelişmiş Filtreler
            </button>
          </div>

          {showAdvancedFilters && (
            <div id="advanced-filters" className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              {/* Tarih Aralığı - Başlangıç */}
              <div>
                <Input
                  id="dateFrom"
                  name="dateFrom"
                  type="date"
                  label="Başlangıç Tarihi"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              {/* Tarih Aralığı - Bitiş */}
              <div>
                <Input
                  id="dateTo"
                  name="dateTo"
                  type="date"
                  label="Bitiş Tarihi"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              
              {/* Kullanıcı E-posta */}
              <div>
                <Input
                  id="userEmail"
                  name="userEmail"
                  type="email"
                  label="Kullanıcı E-posta"
                  placeholder="örnek@domain.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Butonlar */}
          <div className="mt-4 flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={resetFilters}
            >
              Sıfırla
            </Button>
            <Button type="submit">
              Filtrele
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LogFilters;