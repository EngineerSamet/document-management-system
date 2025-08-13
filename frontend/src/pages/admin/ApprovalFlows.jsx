import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../utils/constants';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { useAdmin } from '../../hooks/useAdmin';
import { formatDate } from '../../utils/formatters';

const ApprovalFlows = () => {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [flowToDelete, setFlowToDelete] = useState(null);
  const { successToast, errorToast } = useNotification();
  const { deleteAllApprovalFlows } = useAdmin();
  
  // Filtreleme ve sıralama için state'ler
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filterType, setFilterType] = useState('all');
  
  // Onay adımları detay modalı için state'ler
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState(null);
  
  // Tüm onay akışlarını silme modalı için state'ler
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    document.title = 'Onay Akışları - Evrak Yönetim Sistemi';
    fetchApprovalFlows();
  }, []);

  // API'den onay akışlarını getir
  const fetchApprovalFlows = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/approval-flows`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      
      console.log('API Yanıtı:', response.data);
      
      // API yanıt yapısını kontrol et
      if (response.data && response.data.data && Array.isArray(response.data.data.approvalFlows)) {
        // Doğru yanıt yapısı
        const approvalFlowsData = response.data.data.approvalFlows;
        
        // Her bir akış için adımları doğru şekilde işle
        const processedFlows = approvalFlowsData.map(flow => {
          // Adımları doğru şekilde işle
          const processedSteps = flow.steps && Array.isArray(flow.steps) 
            ? flow.steps.map(step => {
                // Adım bilgilerini zenginleştir
                return {
                  ...step,
                  // Eksik alanları doldur
                  role: step.role || (step.userId?.role || 'Belirtilmemiş'),
                  department: step.department || (step.userId?.department || ''),
                  position: step.position || (step.userId?.position || '')
                };
              }).sort((a, b) => a.order - b.order) // Adımları sıraya göre sırala
            : [];
          
          return {
            ...flow,
            steps: processedSteps
          };
        });
        
        console.log('İşlenmiş akışlar:', processedFlows);
        setFlows(processedFlows);
      } else if (response.data && Array.isArray(response.data)) {
        // Doğrudan dizi döndürülmüş
        const processedFlows = response.data.map(flow => {
          // Adımları doğru şekilde işle
          const processedSteps = flow.steps && Array.isArray(flow.steps) 
            ? flow.steps.map(step => {
                return {
                  ...step,
                  role: step.role || (step.userId?.role || 'Belirtilmemiş'),
                  department: step.department || (step.userId?.department || ''),
                  position: step.position || (step.userId?.position || '')
                };
              }).sort((a, b) => a.order - b.order)
            : [];
          
          return {
            ...flow,
            steps: processedSteps
          };
        });
        
        console.log('İşlenmiş akışlar (dizi):', processedFlows);
        setFlows(processedFlows);
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        // Alternatif yanıt yapısı
        const processedFlows = response.data.data.map(flow => {
          // Adımları doğru şekilde işle
          const processedSteps = flow.steps && Array.isArray(flow.steps) 
            ? flow.steps.map(step => {
                return {
                  ...step,
                  role: step.role || (step.userId?.role || 'Belirtilmemiş'),
                  department: step.department || (step.userId?.department || ''),
                  position: step.position || (step.userId?.position || '')
                };
              }).sort((a, b) => a.order - b.order)
            : [];
          
          return {
            ...flow,
            steps: processedSteps
          };
        });
        
        console.log('İşlenmiş akışlar (alternatif):', processedFlows);
        setFlows(processedFlows);
      } else {
        // Geçerli bir yanıt yapısı bulunamadı
        console.error('Geçersiz API yanıt yapısı:', response.data);
        setFlows([]);
        setError('Onay akışları alınamadı: Geçersiz veri yapısı');
        errorToast('Onay akışları yüklenirken bir hata oluştu: Geçersiz veri yapısı');
      }
    } catch (error) {
      console.error('Error fetching approval flows:', error);
      setError('Onay akışları yüklenirken bir hata oluştu');
      errorToast('Onay akışları yüklenirken bir hata oluştu');
      setFlows([]); // Hata durumunda boş dizi ayarla
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (flow) => {
    setFlowToDelete(flow);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!flowToDelete) return;
    
    try {
      // MongoDB'de _id veya id kullanılabilir, her ikisini de kontrol et
      const flowId = flowToDelete._id || flowToDelete.id;
      
      if (!flowId) {
        console.error('Onay akışı ID değeri bulunamadı:', flowToDelete);
        errorToast('Onay akışı ID değeri bulunamadı');
        setShowDeleteModal(false);
        return;
      }
      
      await axios.delete(`${API_URL}/api/approval-flows/${flowId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      successToast('Onay akışı başarıyla silindi.');
      setShowDeleteModal(false);
      setFlowToDelete(null);
      fetchApprovalFlows();
    } catch (error) {
      console.error('Error deleting approval flow:', error);
      errorToast('Onay akışı silinirken bir hata oluştu');
    }
  };
  
  // Tüm onay akışlarını silme işlemi
  const handleResetApprovalFlows = async () => {
    try {
      setResetLoading(true);
      
      // Onay akışlarını sil
      const result = await deleteAllApprovalFlows();
      successToast(result.message || 'Tüm onay akışları başarıyla silindi');
      setShowResetModal(false);
      
      // Verileri yenile
      await fetchApprovalFlows();
    } catch (error) {
      console.error('Tüm onay akışlarını silme hatası:', error);
      errorToast(error.response?.data?.message || 'Tüm onay akışları silinirken bir hata oluştu');
    } finally {
      setResetLoading(false);
    }
  };

  // Sıralama fonksiyonu
  const handleSort = (field) => {
    if (sortField === field) {
      // Aynı alan için sıralama yönünü değiştir
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Farklı alan için varsayılan olarak artan sıralama
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtrelenmiş ve sıralanmış akışlar
  const filteredAndSortedFlows = useMemo(() => {
    // Önce filtreleme yap
    let result = [...flows];
    
    // Arama terimine göre filtrele
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      result = result.filter(flow => 
        flow.name?.toLowerCase().includes(lowerSearchTerm) || 
        flow.description?.toLowerCase().includes(lowerSearchTerm) ||
        flow.documentType?.toLowerCase().includes(lowerSearchTerm)
      );
    }
    
    // Akış türüne göre filtrele
    if (filterType !== 'all') {
      result = result.filter(flow => flow.flowType === filterType);
    }
    
    // Sıralama yap
    result.sort((a, b) => {
      let valueA = a[sortField] || '';
      let valueB = b[sortField] || '';
      
      // String değerler için
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }
      
      // Tarih değerleri için
      if (sortField === 'createdAt' || sortField === 'updatedAt') {
        valueA = new Date(valueA).getTime();
        valueB = new Date(valueB).getTime();
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [flows, searchTerm, filterType, sortField, sortDirection]);

  const renderApprovalSteps = (steps, flow = null) => {
    if (!steps || steps.length === 0) {
      return <span className="text-gray-500 italic">Onay adımı bulunamadı</span>;
    }

    // Maksimum gösterilecek adım sayısı
    const maxVisibleSteps = 3;
    const hasMoreSteps = steps.length > maxVisibleSteps;
    const visibleSteps = hasMoreSteps ? steps.slice(0, maxVisibleSteps) : steps;
    
    // Tüm adımları görüntüleme fonksiyonu
    const handleViewAllSteps = () => {
      if (flow) {
        setSelectedFlow(flow);
        setShowStepsModal(true);
      }
    };
    
    return (
      <div 
        className="flex flex-col space-y-2 cursor-pointer" 
        onClick={(e) => {
          e.stopPropagation();
          if (flow) handleViewAllSteps();
        }}
        title="Tüm adımları görüntülemek için tıklayın"
      >
        <div className="flex items-center space-x-1">
          {visibleSteps.map((step, index) => {
            // Rol ve departman bilgisini birleştir
            const stepInfo = step.role || 'Belirtilmemiş';
            const deptInfo = step.department ? ` (${step.department})` : '';
            
            return (
              <div key={index} className="group relative">
                {/* Adım göstergesi */}
                <div className={`
                  h-8 px-2 flex items-center justify-center rounded-md text-xs font-medium
                  ${index === 0 ? 'bg-blue-100 text-blue-800' : 
                    index === 1 ? 'bg-purple-100 text-purple-800' : 
                    index === 2 ? 'bg-green-100 text-green-800' : 
                    'bg-gray-100 text-gray-800'}
                `}>
                  <span className="truncate max-w-[80px]">{index + 1}. {stepInfo}</span>
                </div>
              </div>
            );
          })}
          
          {/* Daha fazla adım varsa göster */}
          {hasMoreSteps && (
            <div className="group relative">
              <div className="h-8 px-2 flex items-center justify-center rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
                +{steps.length - maxVisibleSteps}
              </div>
            </div>
          )}
        </div>
        
        {/* Adım sayısı ve tıklama ipucu */}
        <div className="text-xs text-gray-500 flex items-center">
          <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {steps.length} adım • Detaylar için tıklayın
        </div>
      </div>
    );
  };

  const renderFlowType = (flowType) => {
    let label = 'Standart Onay';
    let bgColor = 'bg-blue-100';
    let textColor = 'text-blue-800';

    switch (flowType) {
      case 'quick':
        label = 'Hızlı Onay';
        bgColor = 'bg-green-100';
        textColor = 'text-green-800';
        break;
      case 'sequential':
      default:
        label = 'Sıralı Onay';
        bgColor = 'bg-blue-100';
        textColor = 'text-blue-800';
        break;
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${bgColor} ${textColor}`}>
        {label}
      </span>
    );
  };

  // Sıralama oku render fonksiyonu
  const renderSortArrow = (field) => {
    if (sortField !== field) return null;
    
    return (
      <span className="ml-1">
        {sortDirection === 'asc' ? (
          <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </span>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4 sm:mb-0">Onay Akışları</h1>
        <div className="flex gap-2">
          <Button
            color="warning"
            onClick={() => setShowResetModal(true)}
            className="whitespace-nowrap"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            Tümünü Sıfırla
          </Button>
        </div>
      </div>
      
      {/* Filtreleme ve arama bölümü */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Ara</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Onay akışı ara..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div className="w-full md:w-48">
            <label htmlFor="filter" className="block text-sm font-medium text-gray-700 mb-1">Akış Türü</label>
            <select
              id="filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="all">Tümü</option>
              <option value="sequential">Sıralı Onay</option>
              <option value="quick">Hızlı Onay</option>
            </select>
          </div>
          
          <div className="w-full md:w-48 self-end">
            <Button 
              variant="secondary" 
              onClick={fetchApprovalFlows}
              className="w-full"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Yenile
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-t-4 border-b-4 border-primary-600 rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          <Button onClick={fetchApprovalFlows} className="mt-2">Yeniden Dene</Button>
        </div>
      ) : filteredAndSortedFlows.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
          </svg>
          <h2 className="text-xl font-medium text-gray-600 mb-2">Onay Akışı Bulunamadı</h2>
          <p className="text-gray-500 mb-6">
            {searchTerm || filterType !== 'all' 
              ? 'Arama kriterlerinize uygun onay akışı bulunamadı. Filtreleri değiştirip tekrar deneyin.'
              : 'Henüz hiç onay akışı tanımlanmamış.'}
          </p>
          {searchTerm || filterType !== 'all' ? (
            <Button onClick={() => { setSearchTerm(''); setFilterType('all'); }}>
              Filtreleri Temizle
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Akış Adı {renderSortArrow('name')}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('flowType')}
                  >
                    <div className="flex items-center">
                      Tür {renderSortArrow('flowType')}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('documentType')}
                  >
                    <div className="flex items-center">
                      Belge Tipi {renderSortArrow('documentType')}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Onay Adımları
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('updatedAt')}
                  >
                    <div className="flex items-center">
                      Son Güncelleme {renderSortArrow('updatedAt')}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedFlows.map((flow, index) => (
                  <tr key={flow._id || flow.id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                          {flow.name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{flow.name}</div>
                          <div className="text-xs text-gray-500 line-clamp-1 max-w-xs">{flow.description || 'Açıklama yok'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderFlowType(flow.flowType)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{flow.documentType || 'Tüm belgeler'}</div>
                    </td>
                    <td className="px-6 py-4">
                      {renderApprovalSteps(flow.steps, flow)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-gray-400 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        {formatDate(flow.updatedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Link
                          to={`/admin/onay-akislari/${flow._id || flow.id}/duzenle`}
                          className="text-primary-600 hover:text-primary-900 p-2 rounded-full hover:bg-primary-50 transition-colors"
                          title="Düzenle"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                          </svg>
                        </Link>
                        <button
                          onClick={() => confirmDelete(flow)}
                          className="text-danger-600 hover:text-danger-900 p-2 rounded-full hover:bg-danger-50 transition-colors"
                          title="Sil"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onay Adımları Detay Modal */}
      {showStepsModal && selectedFlow && (
        <Modal
          isOpen={showStepsModal}
          onClose={() => setShowStepsModal(false)}
          title={`${selectedFlow.name} Onay Akışı`}
          size="xl"
        >
          <div className="p-6 space-y-8">
            {/* Akış bilgileri - kart tasarımı */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl shadow-sm p-6 border border-blue-100 dark:border-gray-600">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <svg className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedFlow.name}</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-300">
                        {selectedFlow.documentType ? `Belge Tipi: ${selectedFlow.documentType}` : 'Tüm belge tipleri için geçerli'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 rounded-md">
                    {renderFlowType(selectedFlow.flowType)}
                  </div>
                </div>
              </div>
              
              {selectedFlow.description && (
                <div className="mt-4 bg-white dark:bg-gray-700 rounded-lg p-4 shadow-inner border border-gray-100 dark:border-gray-600">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-300 mb-1">Açıklama</h3>
                  <p className="text-gray-700 dark:text-gray-200">{selectedFlow.description}</p>
                </div>
              )}
            </div>
            
            {/* Onay Akışı Görselleştirme */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <svg className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Onay Akış Diyagramı
                </h3>
              </div>
              
              {selectedFlow.steps && selectedFlow.steps.length > 0 ? (
                <div className="p-6 overflow-x-auto">
                  <div className="flex items-center min-w-max">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    
                    <div className="h-1 w-8 bg-gray-300 dark:bg-gray-600 mx-2"></div>
                    
                    {selectedFlow.steps.map((step, index) => (
                      <React.Fragment key={index}>
                        <div className="relative group">
                          <div className={`
                            flex flex-col items-center justify-center min-w-[120px] py-3 px-4 rounded-lg
                            ${step.status === 'approved' ? 'bg-green-100 dark:bg-green-900 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200' : 
                              step.status === 'rejected' ? 'bg-red-100 dark:bg-red-900 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200' : 
                              step.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200' : 
                              'bg-blue-50 dark:bg-blue-900 border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-200'}
                            border shadow-sm transition-all duration-200 hover:shadow-md
                          `}>
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white dark:bg-gray-700 mb-2 font-bold">
                              {index + 1}
                            </div>
                            <div className="text-center">
                              <div className="font-medium text-sm">{step.role || 'Belirtilmemiş'}</div>
                              {step.department && (
                                <div className="text-xs opacity-80 mt-1">{step.department}</div>
                              )}
                            </div>
                            {step.status && (
                              <div className={`
                                absolute -top-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center
                                ${step.status === 'approved' ? 'bg-green-500 text-white' : 
                                  step.status === 'rejected' ? 'bg-red-500 text-white' : 
                                  step.status === 'pending' ? 'bg-yellow-500 text-white' : 
                                  'bg-gray-500 text-white'}
                              `}>
                                {step.status === 'approved' ? (
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : step.status === 'rejected' ? (
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                ) : step.status === 'pending' ? (
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                ) : (
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {index < selectedFlow.steps.length - 1 && (
                          <div className="flex items-center mx-2">
                            <div className="h-1 w-8 bg-gray-300 dark:bg-gray-600"></div>
                            <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="h-1 w-8 bg-gray-300 dark:bg-gray-600"></div>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                    
                    <div className="h-1 w-8 bg-gray-300 dark:bg-gray-600 mx-2"></div>
                    
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 flex flex-col items-center justify-center text-center">
                  <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                    <svg className="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Onay adımı bulunamadı</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-md">
                    Bu akış için henüz tanımlanmış onay adımı bulunmuyor. Düzenleme sayfasından onay adımları ekleyebilirsiniz.
                  </p>
                </div>
              )}
            </div>
            
            {/* Adımlar tablosu */}
            {selectedFlow.steps && selectedFlow.steps.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <svg className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Onay Adımları Detayları
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-750">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Adım
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          İsim
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Rol
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Departman
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Durum
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedFlow.steps.map((step, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-medium">
                                {index + 1}
                              </div>
                              <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">Adım {index + 1}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {step.userId?.firstName} {step.userId?.lastName || 'Belirtilmemiş'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {step.role || 'Belirtilmemiş'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {step.department || 'Belirtilmemiş'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {step.status === 'approved' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Onaylandı
                              </span>
                            )}
                            {step.status === 'rejected' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200">
                                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Reddedildi
                              </span>
                            )}
                            {step.status === 'pending' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200">
                                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Bekliyor
                              </span>
                            )}
                            {(!step.status || step.status === 'waiting') && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Sırada
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Akış tipi açıklaması */}
                <div className="p-4 bg-gray-50 dark:bg-gray-750 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Akış Türü: {renderFlowType(selectedFlow.flowType)}</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {selectedFlow.flowType === 'quick' 
                          ? 'Hızlı onay akışında, onaylayıcılardan herhangi biri onayladığında belge onaylanmış sayılır.'
                          : 'Sıralı onay akışında, onaylayıcılar belirtilen sırayla belgeyi onaylar. Bir onaylayıcı onaylamadan sonraki onaylayıcıya geçilmez.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Alt kısım - Butonlar */}
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowStepsModal(false)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Kapat
              </button>
              
              {selectedFlow._id && (
                <Link
                  to={`/admin/onay-akislari/${selectedFlow._id}/duzenle`}
                  className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Düzenle
                </Link>
              )}
            </div>
          </div>
        </Modal>
      )}
      
      {/* Silme Onay Modal */}
      {showDeleteModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-danger-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-danger-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Onay Akışını Sil
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        <strong>{flowToDelete?.name}</strong> isimli onay akışını silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve bu akışa bağlı belgeler etkilenebilir.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-danger-600 text-base font-medium text-white hover:bg-danger-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-danger-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleDelete}
                >
                  Sil
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setFlowToDelete(null);
                  }}
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Tüm Onay Akışlarını Sıfırlama Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => !resetLoading && setShowResetModal(false)}
        title="Tüm Onay Akışlarını Sıfırla"
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
              onClick={() => setShowResetModal(false)}
              disabled={resetLoading}
            >
              İptal
            </Button>
            <Button 
              color="warning" 
              onClick={handleResetApprovalFlows}
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
                'Tüm Onay Akışlarını Sil'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ApprovalFlows; 