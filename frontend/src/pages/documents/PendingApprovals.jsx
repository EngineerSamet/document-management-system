import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDocuments } from '../../hooks/useDocuments';
import { useNotification } from '../../hooks/useNotification'; 
import { formatDate, truncateText } from '../../utils/formatters';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';

const PendingApprovals = () => {
  const { getPendingApprovals, approveDocument, rejectDocument, getDocumentDownloadUrl, isLoading: apiLoading } = useDocuments();
  const { successToast, errorToast } = useNotification();
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [processingDocIds, setProcessingDocIds] = useState([]); // İşlem yapılan belge ID'leri
  const [downloadingIds, setDownloadingIds] = useState([]);

  useEffect(() => {
    document.title = 'Onay Bekleyen Belgeler - Evrak Yönetim Sistemi';
    fetchPendingDocuments();
  }, []);

  const fetchPendingDocuments = async () => {
    try {
      setLoading(true);
      const response = await getPendingApprovals();
      
      console.log('Onay bekleyen belgeler cevabı:', response);
      
      if (response && response.data) {
        // Veri yapısı kontrolü
        let documentsData = [];
        
        if (response.data.documents) {
          documentsData = response.data.documents;
        } else if (Array.isArray(response.data)) {
          documentsData = response.data;
        } else if (response.data.data && response.data.data.documents) {
          documentsData = response.data.data.documents;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          documentsData = response.data.data;
        }
        
        console.log('İşlenmiş belge verileri:', documentsData);
        
        // Belgelerin ID alanlarını kontrol et ve normalleştir
        const normalizedDocuments = documentsData.map(doc => {
          if (!doc) return null;
          
          // _id ve id alanlarını kontrol et
          const documentId = doc._id || doc.id;
          
          // Belge durumunu kontrol et (IN_REVIEW veya PENDING olabilir)
          const status = doc.status === 'IN_REVIEW' ? 'PENDING' : doc.status;
          
          // Kullanıcının onaylayabileceği belge mi kontrol et
          const canApprove = doc.canUserApprove !== undefined ? doc.canUserApprove : true;
          
          // Belge sahibi bilgilerini kontrol et
          let creator = doc.createdBy;
          if (creator && typeof creator === 'object') {
            // Tam isim oluştur
            creator.fullName = `${creator.firstName || ''} ${creator.lastName || ''}`.trim();
          }
          
          return {
            ...doc,
            id: documentId,
            _id: documentId,
            status: status,
            canApprove: canApprove,
            createdBy: creator
          };
        }).filter(Boolean); // null değerleri filtrele
        
        // Mevcut kullanıcının bilgilerini al
        const currentUser = user;
        const currentUserId = currentUser?._id;
        
        if (currentUserId) {
          console.log(`Mevcut kullanıcı: ${currentUser.firstName} ${currentUser.lastName} (${currentUserId})`);
        }
        
        // Kullanıcının kendi oluşturduğu belgeler hariç onaylayabileceği belgeleri filtrele
        const approvableDocuments = normalizedDocuments.filter(doc => {
          // Eğer belge yoksa veya createdBy yoksa atla
          if (!doc || !doc.createdBy) {
            console.warn('Belge veya belge sahibi bilgisi eksik:', doc);
            return false;
          }
          
          // Belge oluşturucusu mevcut kullanıcı değilse VE kullanıcı onay akışındaysa göster
          // SOLID prensibi: Single Responsibility - Her kontrol bağımsız ve tek bir görevi yapıyor
          const isCreator = doc.createdBy._id === currentUserId || doc.createdBy.id === currentUserId;
          
          // Kullanıcının onaylama yetkisi kontrolü - backend'den gelen değere güveniyoruz
          // DRY prensibi: Backend'de yapılan kontrolü tekrarlamaktan kaçınıyoruz
          const hasApprovalPermission = doc.canApprove === true || doc.canUserApprove === true;
          
          // Onay akışı bilgilerini kontrol et - mevcut onaylayıcı mı?
          // YAGNI prensibi: Sadece gerekli kontrolü yapıyoruz, gereksiz karmaşıklık eklenmedi
          let isCurrentApprover = doc.isCurrentApprover === true; // Backend'den gelen değere güven
          
          // Backend isCurrentApprover değeri göndermemişse, kendimiz kontrol edelim (eski sürümler için)
          if (doc.isCurrentApprover === undefined && doc.approvalFlow && doc.approvalFlow.steps) {
            // Mevcut adımı bul
            const currentStep = doc.approvalFlow.steps.find(
              step => step.order === doc.approvalFlow.currentStep
            );
            
            // Mevcut adımda kullanıcı var mı kontrol et
            if (currentStep && currentStep.userId) {
              isCurrentApprover = 
                (currentStep.userId._id === currentUserId) || 
                (currentStep.userId.id === currentUserId);
            }
          }
          
          // Debug logları ekleyelim
          console.log(`Belge: ${doc.title}, ID: ${doc._id || doc.id}`);
          console.log(`- Oluşturan: ${doc.createdBy?.firstName || ''} ${doc.createdBy?.lastName || ''} (${doc.createdBy?._id || doc.createdBy?.id})`);
          console.log(`- Kullanıcının oluşturduğu: ${isCreator}`);
          console.log(`- Onay yetkisi var mı: ${hasApprovalPermission}`);
          console.log(`- Backend tarafından mevcut onaylayıcı olarak işaretlenmiş mi: ${doc.isCurrentApprover === true}`);
          console.log(`- Hesaplanan sıradaki onaylayıcı mı: ${isCurrentApprover}`);
          console.log(`- Mevcut adım: ${doc.approvalFlow?.currentStep || 'Belirtilmemiş'}`);
          
          // Filtreleme şartlarını biraz daha esnetelim
          // Kullanıcı belgeyi oluşturmamış VE (canApprove true VEYA isCurrentApprover true)
          const shouldShow = !isCreator && (hasApprovalPermission || isCurrentApprover);
          console.log(`- Belge gösterilecek mi: ${shouldShow}`);
          
          return shouldShow;
        });
        
        console.log(`Toplam ${normalizedDocuments.length} belgeden ${approvableDocuments.length} tanesi onaylanabilir`);
        setDocuments(approvableDocuments);
      } else {
        console.error('Invalid response format:', response);
        setDocuments([]);
        errorToast('Belgeler yüklenirken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Error fetching pending documents:', error);
      setDocuments([]);
      errorToast('Belgeler yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Belgeyi onaylama işlevi işlevinde güncellemeler yapalım
  const handleApproveDocument = async (documentId, comment = '') => {
    try {
      // İşlem yapılan belge ID'sini ekle
      setProcessingDocIds(prev => [...prev, documentId]);
      
      console.log(`Belge onaylama işlemi başlatıldı - Belge ID: ${documentId}`);
      
      const response = await approveDocument(documentId, comment);
      console.log('Belge onaylama cevabı:', response);
      
      successToast('Belge başarıyla onaylandı');
      
      // Listeyi güncelle
      await fetchPendingDocuments();
    } catch (error) {
      console.error('Belge onaylama hatası:', error);
      errorToast('Belge onaylanırken bir hata oluştu');
    } finally {
      // İşlem yapılan belge ID'sini kaldır
      setProcessingDocIds(prev => prev.filter(id => id !== documentId));
    }
  };
  
  // Belgeyi reddetme işlevi
  const handleRejectDocument = async (documentId) => {
    // Kullanıcıdan red sebebi al
    const comment = prompt('Lütfen red sebebini giriniz:');
    
    if (comment === null) {
      // Kullanıcı iptal etti
      return;
    }
    
    try {
      // İşlem yapılan belge ID'sini ekle
      setProcessingDocIds(prev => [...prev, documentId]);
      
      const response = await rejectDocument(documentId, comment);
      console.log('Belge reddetme cevabı:', response);
      
      successToast('Belge reddedildi');
      
      // Listeyi güncelle
      await fetchPendingDocuments();
    } catch (error) {
      console.error('Belge reddetme hatası:', error);
      errorToast('Belge reddedilirken bir hata oluştu');
    } finally {
      // İşlem yapılan belge ID'sini kaldır
      setProcessingDocIds(prev => prev.filter(id => id !== documentId));
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
      
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('İndirme yanıtı:', response);
      
      // Dosyayı indirme
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'document.pdf';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
      
      // Dosya adını belge başlığından al
      const docItem = documents.find(doc => doc.id === documentId || doc._id === documentId);
      if (docItem && docItem.title) {
        filename = `${docItem.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      }
      
      const url2 = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url2;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url2);
    } catch (error) {
      console.error('Belge indirme hatası:', error);
      errorToast('Belge indirilirken bir hata oluştu');
    } finally {
      setDownloadingIds(prev => prev.filter(id => id !== documentId));
    }
  };

  const getFilteredDocuments = () => {
    if (!Array.isArray(documents)) {
      console.warn('Documents is not an array:', documents);
      return [];
    }
    
    return documents
      .filter((doc) => {
        // Arama filtreleri
        if (!doc) return false;
        
        const title = doc.title || '';
        const documentNumber = doc.documentNumber || '';
        const description = doc.description || '';
        const creatorFirstName = doc.createdBy?.firstName || '';
        const creatorLastName = doc.createdBy?.lastName || '';
        
        return (
          title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          creatorFirstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          creatorLastName.toLowerCase().includes(searchTerm.toLowerCase())
        );
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
        } else if (sortBy === 'createdBy') {
          const nameA = `${a.createdBy?.lastName || ''} ${a.createdBy?.firstName || ''}`;
          const nameB = `${b.createdBy?.lastName || ''} ${b.createdBy?.firstName || ''}`;
          comparison = nameA.localeCompare(nameB);
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
  };
  
  const filteredDocuments = getFilteredDocuments();

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Onay Bekleyen Belgeler</h1>

      <Card className="mb-6">
        <Card.Body>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <option value="updatedAt">Son Güncelleme Tarihi</option>
                <option value="createdAt">Oluşturma Tarihi</option>
                <option value="title">Başlık</option>
                <option value="createdBy">Gönderen</option>
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
          </svg>
          <h2 className="text-xl font-medium text-gray-600 mb-2">Onay Bekleyen Belge Yok</h2>
          <p className="text-gray-500">
            {searchTerm ? 'Arama kriterlerinize uygun belge bulunamadı.' : 'Onay bekleyen belge bulunmuyor.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredDocuments.map((document) => (
            <Card key={document.id || document._id} hover>
              <Card.Body>
                <div className="flex flex-col md:flex-row">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <Badge color="warning" className="mr-2">Onay Bekliyor</Badge>
                      {document.priority === 'HIGH' && (
                        <Badge color="danger">Acil</Badge>
                      )}
                    </div>
                    
                    <Link to={`/belgeler/${document.id || document._id}`} className="text-lg font-medium text-gray-900 hover:text-primary-600">
                      {document.title}
                    </Link>
                    
                    {document.documentNumber && (
                      <div className="text-sm text-gray-500 mt-0.5">
                        Belge No: {document.documentNumber}
                      </div>
                    )}
                    
                    {document.description && (
                      <div className="mt-2 text-sm text-gray-600">
                        {truncateText(document.description, 150)}
                      </div>
                    )}
                    
                    {/* Onay akışı bilgileri */}
                    {document.approvalFlow && (
                      <div className="mt-2 text-sm text-gray-600 border-t border-gray-200 pt-2">
                        <div className="font-medium">Onay Akışı: {document.approvalFlow.name || 'Onay Akışı'}</div>
                        <div className="text-xs text-gray-500">
                          Akış Türü: {
                            document.approvalFlow.flowType === 'sequential' ? 'Sıralı Onay' : 
                            document.approvalFlow.flowType === 'quick' ? 'Hızlı Onay' :
                            document.approvalFlow.flowType === 'standard' ? 'Standart' : 
                            document.approvalFlow.flowType
                          }
                        </div>
                        <div className="text-xs text-gray-500">
                          Adım: {document.approvalFlow.currentStep} / {document.approvalFlow.steps?.length || 0}
                        </div>
                        
                        {/* Onay adımları */}
                        {document.approvalFlow.steps && document.approvalFlow.steps.length > 0 && (
                          <div className="mt-1">
                            <div className="text-xs font-medium text-gray-600">Onaylayıcılar:</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {document.approvalFlow.steps.map((step, index) => {
                                const isCurrentStep = step.order === document.approvalFlow.currentStep;
                                const stepUser = step.userId;
                                const fullName = stepUser ? `${stepUser.firstName || ''} ${stepUser.lastName || ''}` : 'Belirsiz';
                                
                                let statusColor = 'bg-gray-200';
                                if (step.status === 'approved') statusColor = 'bg-green-200';
                                else if (step.status === 'rejected') statusColor = 'bg-red-200';
                                else if (isCurrentStep) statusColor = 'bg-yellow-200';
                                
                                return (
                                  <span 
                                    key={index} 
                                    className={`text-xs px-2 py-1 rounded-full ${statusColor} ${isCurrentStep ? 'font-bold' : ''}`}
                                    title={`${fullName} - ${stepUser?.role || 'Belirsiz'} - ${stepUser?.department || 'Belirsiz'}`}
                                  >
                                    {index + 1}. {fullName}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-4 flex flex-wrap items-center text-sm text-gray-500 space-x-4">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                        {document.createdBy?.firstName || ''} {document.createdBy?.lastName || ''}
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        {formatDate(document.createdAt)}
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        {document.type || 'Belge'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 md:mt-0 md:ml-6 flex flex-col md:flex-row items-end md:items-center space-y-2 md:space-y-0 md:space-x-2">
                    {/* Buton grubu - Modern ve hizalı */}
                    <div className="flex items-center space-x-2">
                      {/* Görüntüle butonu */}
                      <Link 
                        to={`/belgeler/${document.id || document._id}`} 
                        className="inline-flex items-center justify-center px-3 py-1.5 text-sm rounded-md font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        Görüntüle
                      </Link>
                      
                      {/* İndir butonu */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDownloadDocument(document.id || document._id);
                        }}
                        disabled={downloadingIds.includes(document.id || document._id)}
                        className="inline-flex items-center justify-center px-3 py-1.5 text-sm rounded-md font-medium bg-primary-600 text-white hover:bg-primary-700 transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {downloadingIds.includes(document.id || document._id) ? (
                          <svg className="w-4 h-4 mr-1.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8 0 0015.357 2"></path>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                          </svg>
                        )}
                        {downloadingIds.includes(document.id || document._id) ? 'İndiriliyor...' : 'İndir'}
                      </button>
                    </div>
                    
                    {/* Onay/Ret butonları */}
                    {(() => {
                      // Onay akışı bilgilerini alalım
                      const approvalFlow = document.approvalFlow;
                      let isCurrentApprover = false;
                      
                      // Onay akışını ve mevcut adımı kontrol et
                      if (approvalFlow && approvalFlow.steps && approvalFlow.steps.length > 0) {
                        // Mevcut adımı bul
                        const currentStep = approvalFlow.steps.find(
                          step => step.order === approvalFlow.currentStep
                        );
                        
                        // Mevcut adımda kullanıcı var mı kontrol et
                        if (currentStep && currentStep.userId) {
                          isCurrentApprover = 
                            (currentStep.userId._id === user?._id) || 
                            (currentStep.userId.id === user?._id);
                        }
                      }
                      
                      // Kullanıcı belgeyi onaylayabilecek durumdaysa butonları göster
                      if (isCurrentApprover || document.canApprove === true) {
                        return (
                          <div className="flex items-center space-x-2 mt-2 md:mt-0 md:ml-2">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                window.confirm('Bu belgeyi onaylamak istediğinizden emin misiniz?') && 
                                handleApproveDocument(document.id || document._id);
                              }}
                              disabled={processingDocIds.includes(document.id || document._id)}
                              className="inline-flex items-center justify-center px-4 py-1.5 text-sm rounded-md font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {processingDocIds.includes(document.id || document._id) ? (
                                <svg className="w-4 h-4 mr-1.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8 0 0015.357 2"></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                              )}
                              {processingDocIds.includes(document.id || document._id) ? 'İşleniyor...' : 'Onayla'}
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                window.confirm('Bu belgeyi reddetmek istediğinizden emin misiniz?') && 
                                handleRejectDocument(document.id || document._id);
                              }}
                              disabled={processingDocIds.includes(document.id || document._id)}
                              className="inline-flex items-center justify-center px-4 py-1.5 text-sm rounded-md font-medium bg-red-600 text-white hover:bg-red-700 transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {processingDocIds.includes(document.id || document._id) ? (
                                <svg className="w-4 h-4 mr-1.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8 0 0015.357 2"></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                              )}
                              {processingDocIds.includes(document.id || document._id) ? 'İşleniyor...' : 'Reddet'}
                            </button>
                          </div>
                        );
                      } else {
                        // Kullanıcı onaylayamaz, bir açıklama gösterilsin
                        return (
                          <span className="inline-flex items-center px-3 py-1 text-sm rounded-md bg-amber-50 text-amber-700 border border-amber-200 mt-2 md:mt-0 md:ml-2">
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            Onaylama sırası sizde değil
                          </span>
                        );
                      }
                    })()}
                  </div>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingApprovals; 