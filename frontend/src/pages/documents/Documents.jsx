import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDocuments } from '../../hooks/useDocuments';
import { formatDate, truncateText } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { API_URL } from '../../utils/constants';
import axios from 'axios';
import { useNotification } from '../../hooks/useNotification';
import Modal from '../../components/ui/Modal';

const Documents = () => {
  const { getDocuments, getDocumentDownloadUrl, deleteAllDocuments } = useDocuments();
  const { user } = useAuth();
  const { errorToast, successToast } = useNotification();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [downloadingIds, setDownloadingIds] = useState([]);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    document.title = 'Belgeler - Evrak Yönetim Sistemi';
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await getDocuments();
      
      console.log('Belgeler yanıtı:', response);
      
      // Veri yapısını kontrol et
      let documentsData = [];
      
      if (response && response.data) {
        if (Array.isArray(response.data)) {
          documentsData = response.data;
        } else if (response.data.documents && Array.isArray(response.data.documents)) {
          documentsData = response.data.documents;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          documentsData = response.data.data;
        } else if (response.data.data && response.data.data.documents && Array.isArray(response.data.data.documents)) {
          documentsData = response.data.data.documents;
        }
      }
      
      console.log('İşlenmiş belgeler:', documentsData);
      
      // Belgelerin ID alanlarını normalleştir
      const normalizedDocuments = documentsData.map(doc => {
        const id = doc._id || doc.id;
        return {
          ...doc,
          id,
          _id: id
        };
      });
      
      setDocuments(normalizedDocuments);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Belge indirme işlevi
  const handleDownloadDocument = async (documentId) => {
    try {
      setDownloadingIds(prev => [...prev, documentId]);
      
      const token = localStorage.getItem('accessToken');
      const url = getDocumentDownloadUrl(documentId);
      
      console.log('Belge indirme URL:', url);
      console.log('Token:', token ? 'Token var' : 'Token yok');
      
      // Axios yerine fetch kullanarak indirme
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error(`PDF indirme hatası: ${response.status} ${response.statusText}`);
        throw new Error(`Belge indirme hatası: ${response.status} ${response.statusText}`);
      }
      
      // Blob olarak al
      const blob = await response.blob();
      
      // Content-Type ve Content-Disposition başlıklarını kontrol et
      const contentType = response.headers.get('content-type') || 'application/pdf';
      const contentDisposition = response.headers.get('content-disposition');
      
      // Dosya adını belirle
      let filename = 'document.pdf';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }
      
      // Dosya adını belge başlığından al
      const currentDocument = documents.find(doc => doc.id === documentId || doc._id === documentId);
      if (currentDocument && currentDocument.title && !filename.includes(currentDocument.title)) {
        // Dosya uzantısını belirle
        let extension = '.pdf';
        
        // Content-Type'a göre uzantı belirle
        if (contentType) {
          if (contentType.includes('pdf')) {
            extension = '.pdf';
          } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
            extension = '.jpg';
          } else if (contentType.includes('png')) {
            extension = '.png';
          } else if (contentType.includes('word')) {
            extension = '.docx';
          }
        }
        
        // Dosya adını oluştur
        filename = `${currentDocument.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}${extension}`;
      }
      
      console.log('İndirilecek dosya bilgileri:', {
        filename,
        contentType,
        size: blob.size
      });
      
      // Dosya indirme bağlantısı oluştur
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // Temizlik
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      // Başarılı indirme mesajı
      successToast('Belge başarıyla indirildi');
    } catch (error) {
      console.error('Belge indirme hatası:', error);
      errorToast('Belge indirilirken bir hata oluştu');
    } finally {
      setDownloadingIds(prev => prev.filter(id => id !== documentId));
    }
  };

  // Tüm belgeleri silme fonksiyonu
  const handleResetSystem = async () => {
    try {
      setLoading(true);
      const result = await deleteAllDocuments();
      successToast(result.message || 'Tüm belgeler başarıyla silindi');
      setShowResetModal(false);
      fetchDocuments(); // Belge listesini yenile
    } catch (error) {
      console.error('Tüm belgeleri silme hatası:', error);
      errorToast(error.response?.data?.message || 'Tüm belgeler silinirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'DRAFT':
        return 'gray';
      case 'IN_REVIEW':
      case 'PENDING':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      default:
        return 'gray';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'DRAFT':
        return 'Taslak';
      case 'IN_REVIEW':
      case 'PENDING':
        return 'Onay Bekliyor';
      case 'APPROVED':
        return 'Onaylandı';
      case 'REJECTED':
        return 'Reddedildi';
      default:
        return status;
    }
  };

  const filteredDocuments = documents
    .filter((doc) => {
      if (!doc) return false;
      
      // Arama filtreleri
      const title = doc.title || '';
      const documentNumber = doc.documentNumber || '';
      const description = doc.description || '';
      
      const searchMatch =
        title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        description.toLowerCase().includes(searchTerm.toLowerCase());

      // Durum filtresi
      const statusMatch = filterStatus === 'all' || doc.status === filterStatus;

      return searchMatch && statusMatch;
    })
    .sort((a, b) => {
      // Sıralama
      let comparison = 0;
      
      if (sortBy === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '');
      } else if (sortBy === 'createdAt') {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        comparison = dateA - dateB;
      } else if (sortBy === 'updatedAt') {
        const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
        const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
        comparison = dateA - dateB;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Belgeler</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link to="/belge-olustur">
            <Button color="primary" className="w-full sm:w-auto">
              <i className="fas fa-plus mr-2"></i>Yeni Belge
            </Button>
          </Link>
          {user && user.role === 'admin' && (
            <Button 
              color="danger" 
              className="w-full sm:w-auto"
              onClick={() => setShowResetModal(true)}
            >
              <i className="fas fa-trash mr-2"></i>Sistemi Sıfırla
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <Card.Body>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input
                type="text"
                placeholder="Belge ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                }
              />
            </div>
            
            <div>
              <Input
                as="select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Durum"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="DRAFT">Taslak</option>
                <option value="IN_REVIEW">Onay Bekliyor</option>
                <option value="APPROVED">Onaylandı</option>
                <option value="REJECTED">Reddedildi</option>
              </Input>
            </div>
            
            <div>
              <Input
                as="select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                label="Sıralama"
                rightIcon={
                  <button
                    onClick={toggleSortOrder}
                    className="text-gray-500 focus:outline-none"
                    title={sortOrder === 'asc' ? 'Artan Sıralama' : 'Azalan Sıralama'}
                  >
                    {sortOrder === 'asc' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"></path>
                      </svg>
                    )}
                  </button>
                }
              >
                <option value="title">Başlık</option>
                <option value="createdAt">Oluşturma Tarihi</option>
                <option value="updatedAt">Güncelleme Tarihi</option>
              </Input>
            </div>
          </div>
        </Card.Body>
      </Card>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-t-4 border-b-4 border-primary-600 rounded-full animate-spin"></div>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <h2 className="text-xl font-medium text-gray-600 mb-2">Belge Bulunamadı</h2>
          <p className="text-gray-500 mb-6">
            {searchTerm || filterStatus !== 'all'
              ? 'Arama kriterlerinize uygun belge bulunamadı.'
              : 'Henüz hiç belge oluşturulmamış.'}
          </p>
          <Link to="/belge-olustur">
            <Button>Yeni Belge Oluştur</Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Belge
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durum
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Oluşturan
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tarih
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((document) => (
                  <tr key={document.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <svg className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                          </svg>
                        </div>
                        <div className="ml-4">
                          <Link to={`/belgeler/${document.id}`} className="text-sm font-medium text-gray-900 hover:text-primary-600">
                            {document.title}
                          </Link>
                          {document.documentNumber && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              Belge No: {document.documentNumber}
                            </div>
                          )}
                          {document.description && (
                            <div className="text-xs text-gray-500 mt-1">
                              {truncateText(document.description, 60)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge color={getStatusColor(document.status)}>
                        {getStatusText(document.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {document.createdBy?.firstName} {document.createdBy?.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(document.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex space-x-2 justify-end">
                        <Link to={`/belgeler/${document.id}`} className="text-primary-600 hover:text-primary-900">
                          Görüntüle
                        </Link>
                        <button
                          onClick={() => handleDownloadDocument(document.id)}
                          disabled={downloadingIds.includes(document.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          {downloadingIds.includes(document.id) ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8 0 0015.357 2"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4"></path>
                            </svg>
                          )}
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

      {/* Reset Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Sistemi Sıfırla"
      >
        <div className="p-4">
          <p className="text-red-600 font-bold mb-4">
            DİKKAT: Bu işlem tüm belgeleri kalıcı olarak silecektir!
          </p>
          <p className="mb-4">
            Onay bekleyen belgeler de dahil olmak üzere sistemdeki tüm belgeler silinecektir. Bu işlem geri alınamaz.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <Button color="secondary" onClick={() => setShowResetModal(false)}>
              İptal
            </Button>
            <Button color="danger" onClick={handleResetSystem}>
              Tüm Belgeleri Sil
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Documents; 