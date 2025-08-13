import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getLogs, getRecentActivities } from '../../api/logs';
import { useNotification } from '../../hooks/useNotification';
import Card from '../../components/ui/Card';
import LogFilters from '../../components/admin/LogFilters';
import LogVisualization from '../../components/admin/LogVisualization';
import LogDashboard from '../../components/admin/LogDashboard';
import LogIcons from '../../components/admin/LogIcons';
import { formatDateTime } from '../../utils/formatters';

/**
 * Sistem Logları Sayfası
 * 
 * Bu sayfa, sistem loglarını görüntülemek, filtrelemek ve analiz etmek için kullanılır.
 * Ayrıca, denetim kaydı (audit trail) ve son etkinlikler gibi özellikleri de içerir.
 */
const SystemLogs = () => {
  // Sayfa durumları
  const [logs, setLogs] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('logs'); // 'logs', 'visualization'
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const { errorToast, successToast } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  // Sayfa başlığını ayarla
  useEffect(() => {
    document.title = 'Sistem Logları - Evrak Yönetim Sistemi';
  }, []);

  // URL parametrelerinden filtreleri al
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tabParam = queryParams.get('tab');
    
    if (tabParam && ['logs', 'visualization'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    
    // Diğer filtreleri de URL'den al
    const urlFilters = {};
    
    if (queryParams.get('level')) urlFilters.level = queryParams.get('level');
    if (queryParams.get('module')) urlFilters.module = queryParams.get('module');
    if (queryParams.get('search')) urlFilters.searchTerm = queryParams.get('search');
    if (queryParams.get('dateFrom')) urlFilters.dateFrom = queryParams.get('dateFrom');
    if (queryParams.get('dateTo')) urlFilters.dateTo = queryParams.get('dateTo');
    
    if (Object.keys(urlFilters).length > 0) {
      setFilters(urlFilters);
    }
  }, [location.search]);

  // Logları getir
  useEffect(() => {
    fetchLogs();
    fetchActivities();
  }, [page, filters, activeTab]);

  // Log kayıtlarını getir
  const fetchLogs = async (pageNum = page, newFilters = filters) => {
    if (activeTab !== 'logs') return;
    
    setLoading(true);
    try {
      const params = {
        page: pageNum,
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        ...newFilters
      };

      const response = await getLogs(params);
      setLogs(response.logs || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching logs:', error);
      errorToast('Log kayıtları yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Son etkinlikleri getir
  const fetchActivities = async () => {
    try {
      const data = await getRecentActivities(20);
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      // Sessizce başarısız ol, ana işlevselliği etkilememesi için
    }
  };

  // Filtreleme işlemi
  const handleFilter = (newFilters) => {
    // URL parametrelerini güncelle
    const queryParams = new URLSearchParams();
    
    // Aktif sekme
    queryParams.set('tab', activeTab);
    
    // Filtre parametrelerini URL'ye ekle
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.set(key, value);
      }
    });
    
    // Sayfa numarasını sıfırla
    setPage(1);
    queryParams.set('page', '1');
    
    // Filtreleri güncelle
    setFilters(newFilters);
    
    // URL'yi güncelle
    navigate(`${location.pathname}?${queryParams.toString()}`);
    
    // Logları yeniden yükle
    fetchLogs(1, newFilters);
  };

  // Sekme değiştir
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    
    // URL'yi güncelle
    const queryParams = new URLSearchParams(location.search);
    queryParams.set('tab', tab);
    navigate(`${location.pathname}?${queryParams.toString()}`);
  };

  // Tüm logları görüntüle butonuna tıklandığında
  const handleViewAllLogs = () => {
    setActiveTab('logs');
    setPage(1);
    
    // URL'yi güncelle
    const queryParams = new URLSearchParams();
    queryParams.set('tab', 'logs');
    navigate(`${location.pathname}?${queryParams.toString()}`);
  };

  // Log seviyesine göre renk sınıfları
  const getLogLevelClass = (level) => {
    const classes = {
      error: 'text-danger-600 bg-danger-50 border-danger-200',
      warning: 'text-warning-600 bg-warning-50 border-warning-200',
      info: 'text-info-600 bg-info-50 border-info-200',
      debug: 'text-gray-600 bg-gray-50 border-gray-200',
      critical: 'text-purple-600 bg-purple-50 border-purple-200',
    };
    return classes[level?.toLowerCase()] || 'text-gray-600 bg-gray-50 border-gray-200';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Başlık ve Sekmeler */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-gray-800 mb-4 md:mb-0">Sistem Logları</h1>
          
          <div className="flex space-x-2">
            <button
              onClick={() => handleTabChange('logs')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                activeTab === 'logs'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Log Kayıtları
            </button>
            <button
              onClick={() => handleTabChange('visualization')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                activeTab === 'visualization'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              İstatistikler
            </button>
          </div>
        </div>
      </div>

      {/* Ana İçerik */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol Panel */}
        <div className={`${activeTab === 'visualization' ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {/* Filtreler */}
          {(activeTab === 'logs') && (
            <div className="mb-6">
              <LogFilters onFilter={handleFilter} initialFilters={filters} />
            </div>
          )}

          {/* Log Kayıtları */}
          {activeTab === 'logs' && (
            <div className="bg-white rounded-lg shadow-sm">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="w-12 h-12 border-t-4 border-b-4 border-blue-600 rounded-full animate-spin"></div>
                </div>
              ) : logs.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Log Kaydı Bulunamadı</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Seçili kriterlere göre log kaydı bulunmamaktadır. Filtreleri değiştirerek tekrar deneyebilirsiniz.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tarih/Saat
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Seviye
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Modül
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Mesaj
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Kullanıcı
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDateTime(log.timestamp)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getLogLevelClass(log.level)}`}>
                                {log.level}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <LogIcons category={log.category || log.action} />
                                <span className="ml-2 text-sm text-gray-900">{log.module}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                {log.message}
                                {log.details && (
                                  <div className="mt-1 bg-gray-50 p-2 rounded border border-gray-200 text-xs font-mono overflow-x-auto">
                                    <pre className="whitespace-pre-wrap break-words">
                                      {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : log.details}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {log.userName || (
                                <span className="text-gray-400">Sistem</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Sayfalama */}
                  {totalPages > 1 && (
                    <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                      <div className="flex-1 flex justify-between sm:hidden">
                        <button
                          onClick={() => setPage(page > 1 ? page - 1 : 1)}
                          disabled={page === 1}
                          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 ${
                            page === 1 ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          Önceki
                        </button>
                        <button
                          onClick={() => setPage(page < totalPages ? page + 1 : totalPages)}
                          disabled={page === totalPages}
                          className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 ${
                            page === totalPages ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          Sonraki
                        </button>
                      </div>
                      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">{page}</span>{' '}
                            / <span className="font-medium">{totalPages}</span> sayfa
                          </p>
                        </div>
                        <div>
                          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                            <button
                              onClick={() => setPage(page > 1 ? page - 1 : 1)}
                              disabled={page === 1}
                              className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${
                                page === 1 ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              <span className="sr-only">Önceki</span>
                              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>

                            {/* Sayfa numaraları */}
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              const pageNum = i + 1;
                              return (
                                <button
                                  key={i}
                                  onClick={() => setPage(pageNum)}
                                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${
                                    page === pageNum
                                      ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                      : 'text-gray-500 hover:bg-gray-50'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}

                            {totalPages > 5 && (
                              <>
                                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                  ...
                                </span>
                                <button
                                  onClick={() => setPage(totalPages)}
                                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${
                                    page === totalPages
                                      ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                      : 'text-gray-500 hover:bg-gray-50'
                                  }`}
                                >
                                  {totalPages}
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => setPage(page < totalPages ? page + 1 : totalPages)}
                              disabled={page === totalPages}
                              className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${
                                page === totalPages ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              <span className="sr-only">Sonraki</span>
                              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </nav>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Denetim Kayıtları */}
          {/* İstatistikler */}
          {activeTab === 'visualization' && (
            <LogVisualization logs={logs} />
          )}
        </div>

        {/* Sağ Panel (Sadece İstatistikler sekmesinde görünür) */}
        {activeTab === 'visualization' && (
          <div className="lg:col-span-1">
            <LogDashboard activities={activities} onViewAllClick={handleViewAllLogs} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemLogs;