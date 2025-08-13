import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDocuments } from '../../hooks/useDocuments';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { formatDate } from '../../utils/formatters';
import { API_URL } from '../../utils/constants';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import ApprovalFlowStatus from '../../components/approval/ApprovalFlowStatus';
import { getDocumentApprovalFlow } from '../../api/documents';
import { CheckIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const DocumentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getDocumentById, approveDocument, rejectDocument, generatePDF } = useDocuments();
  const { successToast, errorToast, confirmToast } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [documentData, setDocumentData] = useState(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [approvalFlow, setApprovalFlow] = useState(null);
  const [loadingApprovalFlow, setLoadingApprovalFlow] = useState(false);

  useEffect(() => {
    fetchDocument();
  }, [id]);

  useEffect(() => {
    if (documentData && documentData._id) {
      fetchApprovalFlow();
    }
  }, [documentData]);

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const response = await getDocumentById(id);
      const documentData = response.data?.document;
      
      if (!documentData) {
        throw new Error('Belge verileri alınamadı');
      }
      
      setDocumentData(documentData);
      window.document.title = `${documentData.title} - Evrak Yönetim Sistemi`;
    } catch (error) {
      console.error('Error fetching document:', error);
      errorToast('Belge yüklenirken bir hata oluştu');
      navigate('/belgeler');
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovalFlow = async () => {
    try {
      setLoadingApprovalFlow(true);
      const response = await getDocumentApprovalFlow(id);
      
      if (response && response.data && response.data.approvalFlow) {
        setApprovalFlow(response.data.approvalFlow);
      } else {
        // Onay akışı bulunamadığında null olarak ayarla
        setApprovalFlow(null);
      }
    } catch (error) {
      console.error('Error fetching approval flow:', error);
      // Hata durumunda null olarak ayarla
      setApprovalFlow(null);
    } finally {
      setLoadingApprovalFlow(false);
    }
  };

  const handleApprove = async () => {
    try {
      setApproving(true);
      await approveDocument(id);
      successToast('Belge başarıyla onaylandı');
      
      // Belge ve onay akışını tekrar yükle
      try {
        await fetchDocument(); // Belge durumunu güncelle
        await fetchApprovalFlow(); // Onay akışını güncelle
        console.log(`Belge ve onay akışı başarıyla yenilendi: ${id}`);
      } catch (refreshError) {
        console.error('Belge veya onay akışı yenilenirken hata:', refreshError);
        // Yenileme hatası kritik değil, kullanıcıya gösterme
      }
    } catch (error) {
      console.error('Onaylama hatası:', error);
      
      // Hata mesajını göster
      if (error.isPermissionError) {
        // Yetki hatası veya belge zaten onaylanmış
        errorToast(error.message || 'Bu belgeyi onaylama yetkiniz yok veya belge zaten onaylanmış');
      } else if (error.isNotFoundError) {
        // Belge bulunamadı
        errorToast('Belge bulunamadı');
      } else if (error.message && error.message.includes('onay akışı bulunamadı')) {
        // Onay akışı bulunamadı - özel mesaj
        errorToast(error.message || 'Bu belge için onay akışı bulunamadı');
      } else {
        // Genel hata
        errorToast(error.message || 'Belge onaylanırken bir hata oluştu');
      }
    } finally {
      setApproving(false);
    }
  };

  const handleRejectClick = () => {
    setShowRejectDialog(true);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      errorToast('Lütfen bir red nedeni girin');
      return;
    }

    try {
      setRejecting(true);
      await rejectDocument(id, rejectReason);
      successToast('Belge başarıyla reddedildi');
      setShowRejectDialog(false);
      
      // Belge ve onay akışını tekrar yükle
      try {
        await fetchDocument();
        await fetchApprovalFlow();
        console.log(`Belge ve onay akışı başarıyla yenilendi: ${id}`);
      } catch (refreshError) {
        console.error('Belge veya onay akışı yenilenirken hata:', refreshError);
        // Yenileme hatası kritik değil, kullanıcıya gösterme
      }
    } catch (error) {
      console.error('Error rejecting document:', error);
      
      // Hata mesajını göster
      if (error.isPermissionError) {
        // Yetki hatası veya belge zaten reddedilmiş
        errorToast(error.message || 'Bu belgeyi reddetme yetkiniz yok veya belge zaten işlenmiş');
      } else if (error.isNotFoundError) {
        // Belge veya onay akışı bulunamadı
        errorToast(error.message || 'Belge veya onay akışı bulunamadı');
      } else if (error.message && error.message.includes('onay akışı bulunamadı')) {
        // Onay akışı bulunamadı - özel mesaj
        errorToast(error.message);
      } else if (error.message && error.message.includes('açıklama gereklidir')) {
        // Red nedeni eksik
        errorToast('Reddetme işlemi için açıklama gereklidir');
      } else {
        // Genel hata
        errorToast(error.message || 'Belge reddedilirken bir hata oluştu');
      }
    } finally {
      setRejecting(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setGeneratingPDF(true);
      
      // API'den PDF dosyasını al
      const token = localStorage.getItem('accessToken');
      const url = `${API_URL}/api/documents/${id}/download`;
      
      console.log('Belge indirme URL:', url);
      console.log('Token:', token ? 'Token var' : 'Token yok');
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error(`PDF indirme hatası: ${response.status} ${response.statusText}`);
        throw new Error(`PDF indirme hatası: ${response.status} ${response.statusText}`);
      }
      
      // Blob olarak al
      const blob = await response.blob();
      
      // Content-Type ve Content-Disposition başlıklarını kontrol et
      const contentType = response.headers.get('content-type') || 'application/pdf';
      const contentDisposition = response.headers.get('content-disposition');
      
      // Dosya adını belirle
      let filename = `${documentData.title || 'document'}.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }
      
      // Uzantıyı content-type'a göre belirle
      if (contentType.includes('pdf')) {
        if (!filename.toLowerCase().endsWith('.pdf')) {
          filename = `${filename}.pdf`;
        }
      } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        if (!filename.toLowerCase().endsWith('.jpg') && !filename.toLowerCase().endsWith('.jpeg')) {
          filename = `${filename}.jpg`;
        }
      } else if (contentType.includes('png')) {
        if (!filename.toLowerCase().endsWith('.png')) {
          filename = `${filename}.png`;
        }
      }
      
      console.log('İndirilen dosya bilgileri:', {
        filename,
        contentType,
        size: blob.size
      });
      
      // Dosya indirme bağlantısı oluştur
      const url2 = window.URL.createObjectURL(new Blob([blob], { type: contentType }));
      
      // Alternatif indirme yöntemi - document.body olmadan çalışır
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        // IE için
        window.navigator.msSaveOrOpenBlob(new Blob([blob], { type: contentType }), filename);
      } else {
        // Modern tarayıcılar için - Global window.document kullan
        const link = window.document.createElement('a');
        if (link) {
          link.href = url2;
          link.setAttribute('download', filename);
          link.style.display = 'none';
          
          // Global window.document.body kullan
          if (window.document.body) {
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
          } else {
            // document.body yoksa doğrudan tıklama
            link.click();
          }
        } else {
          // Hiçbir yöntem çalışmazsa URL'yi aç
          window.open(url2, '_blank');
        }
      }
      
      // URL'yi temizle
      window.URL.revokeObjectURL(url2);
      
      successToast('Belge başarıyla indirildi');
    } catch (error) {
      console.error('Belge indirme hatası:', error);
      errorToast('Belge indirilirken bir hata oluştu');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'gray';
      case 'pending':
        return 'warning';
      case 'approved':
        return 'success';
      case 'rejected':
        return 'danger';
      default:
        return 'gray';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'draft':
        return 'Taslak';
      case 'pending':
        return 'Onay Bekliyor';
      case 'in_review':
        return 'İncelemede';
      case 'approved':
        return 'Onaylandı';
      case 'rejected':
        return 'Reddedildi';
      default:
        return status;
    }
  };

  // Kullanıcı onaylayabilir mi?
  const canUserApprove = useMemo(() => {
    if (!documentData || !user || !approvalFlow) return false;
    
    // Belge onay durumunda değilse onaylanamaz
    if (documentData.status !== 'in_review' && documentData.status !== 'pending') return false;
    
    // Onay akışı yoksa onaylanamaz
    if (!approvalFlow || approvalFlow.status !== 'pending') return false;
    
    const flowType = approvalFlow.flowType;
    
    // Sıralı onay türü için mevcut onaylayıcı kontrolü
    if (documentData.currentApprover && user) {
      return documentData.currentApprover._id === user.id;
    }
    
    return false;
  }, [documentData, user, approvalFlow]);
  
  // Kullanıcı daha önce onaylamış mı kontrol et
  const hasUserAlreadyApproved = useMemo(() => {
    if (!documentData || !user) return false;
    
    // Onay geçmişinde kullanıcının onayı var mı kontrol et
    const userApprovedInHistory = documentData.approvalHistory?.some(
      history => history.userId._id === user.id && history.action === 'approved'
    ) || false;
    
    // Onay akışında kullanıcının adımı approved durumunda mı kontrol et
    const userStepApproved = approvalFlow?.steps?.some(
      step => step.userId._id === user.id && step.status === 'approved'
    ) || false;
    
    // Her iki kontrolden biri true ise kullanıcı zaten onaylamış demektir
    return userApprovedInHistory || userStepApproved;
  }, [documentData, user, approvalFlow]);

  // Kullanıcı admin mi?
  const isAdmin = user && user.role === 'admin';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 border-t-4 border-b-4 border-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-700 mb-2">Belge Bulunamadı</h2>
        <p className="text-gray-500 mb-6">İstediğiniz belge bulunamadı veya erişim izniniz yok.</p>
        <Link to="/belgeler">
          <Button variant="outline">Belgelere Dön</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link to="/belgeler" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
            &larr; Belgelere Dön
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {loading ? 'Belge Yükleniyor...' : documentData?.title || 'Belge Detayı'}
          </h1>
        </div>
        
        {/* Onay/Reddetme ve İndirme Butonları */}
        {documentData && (
          <div className="flex flex-col md:flex-row gap-2">
            {/* PDF İndirme butonu - her zaman göster */}
            <button
              onClick={handleDownloadPDF}
              disabled={generatingPDF}
              className="flex items-center justify-center px-4 py-2 rounded-md font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generatingPDF ? (
                <>
                  <svg className="animate-spin w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>İndiriliyor</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  <span>PDF İndir</span>
                </>
              )}
            </button>

            {/* Onay/Red Butonları - belge durumu uygunsa göster */}
            {documentData && (documentData.status === 'pending' || documentData.status === 'in_review') && (
              <>
                {/* Onayla butonu - sadece onaylama yetkisi varsa ve daha önce onaylamamışsa göster */}
                {canUserApprove && !hasUserAlreadyApproved && (
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="flex items-center justify-center px-4 py-2 rounded-md font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {approving ? (
                      <>
                        <svg className="animate-spin w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Onaylanıyor</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>Onayla</span>
                      </>
                    )}
                  </button>
                )}

                {/* Onay durumu bilgisi - kullanıcı onaylamışsa göster */}
                {hasUserAlreadyApproved && (
                  <div className="flex items-center px-3 py-2 rounded-md bg-green-50 text-green-700 border border-green-200">
                    <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Bu belgeyi zaten onayladınız</span>
                  </div>
                )}

                {/* Onay sırası bilgisi - kullanıcı onaylama yetkisi yoksa göster */}
                {!canUserApprove && !hasUserAlreadyApproved && (documentData.status === 'pending' || documentData.status === 'in_review') && (
                  <div className="flex items-center px-3 py-2 rounded-md bg-gray-50 text-gray-600 border border-gray-200">
                    <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>Şu anda onay sırası sizde değil</span>
                  </div>
                )}

                {/* Reddet butonu - sadece onaylama yetkisi varsa ve daha önce onaylamamışsa göster */}
                {canUserApprove && !hasUserAlreadyApproved && (
                  <button
                    onClick={handleRejectClick}
                    disabled={rejecting}
                    className="flex items-center justify-center px-4 py-2 rounded-md font-medium text-white bg-red-600 hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {rejecting ? (
                      <>
                        <svg className="animate-spin w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Reddediliyor</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                        <span>Reddet</span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2.5"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2.5"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2.5"></div>
        </div>
      ) : documentData ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">{documentData.title}</h2>
                  <Badge color={getStatusColor(documentData.status)}>
                    {getStatusText(documentData.status)}
                  </Badge>
                </div>
                
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{documentData.description}</p>
                </div>
                
                {documentData.tags && documentData.tags.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Etiketler</h3>
                    <div className="flex flex-wrap gap-2">
                      {documentData.tags.map((tag, index) => (
                        <span key={index} className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
            
            {/* Onay Akışı */}
            <ApprovalFlowStatus 
              approvalFlow={approvalFlow} 
              loading={loadingApprovalFlow} 
            />
          </div>
          
          <div className="space-y-6">
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Belge Bilgileri</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Oluşturulma Tarihi</p>
                    <p className="text-sm text-gray-900">{formatDate(documentData.createdAt)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-500">Son Güncelleme</p>
                    <p className="text-sm text-gray-900">{formatDate(documentData.updatedAt)}</p>
                  </div>
                  
                  {documentData.createdBy && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Oluşturan</p>
                      <p className="text-sm text-gray-900">
                        {documentData.createdBy.firstName} {documentData.createdBy.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {documentData.createdBy.department} - {documentData.createdBy.position}
                      </p>
                    </div>
                  )}
                  
                  {documentData.fileName && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Dosya Bilgileri</p>
                      <p className="text-sm text-gray-900">Dosya Adı: {documentData.fileName}</p>
                      <p className="text-xs text-gray-500">
                        Dosya Türü: {documentData.fileType || 'Bilinmiyor'}
                      </p>
                      {documentData.fileSize && (
                        <p className="text-xs text-gray-500">
                          Dosya Boyutu: {(documentData.fileSize / 1024).toFixed(2)} KB
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Belge bulunamadı</h2>
          <p className="text-gray-500 mt-2">İstediğiniz belge bulunamadı veya erişim izniniz yok.</p>
          <Link to="/belgeler" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            Belgelere Dön
          </Link>
        </div>
      )}

      {/* Reddetme Diyaloğu */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all animate-fadeIn">
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-4 mt-0">
                  <h3 className="text-lg font-medium text-gray-900">Belgeyi Reddet</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Lütfen belgeyi reddetme nedeninizi belirtin. Bu bilgi belge sahibine iletilecektir.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-3">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Red nedeninizi yazın..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                rows="4"
              ></textarea>
              
              {!rejectReason.trim() && (
                <p className="mt-1 text-xs text-red-500">Red nedeni belirtmek zorunludur</p>
              )}
            </div>
            
            <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end space-x-2">
              <button
                onClick={() => setShowRejectDialog(false)}
                type="button"
                className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-gray-700 text-base font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
                type="button"
                className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  rejecting || !rejectReason.trim() 
                  ? 'bg-red-400 cursor-not-allowed' 
                  : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                } transition-colors`}
              >
                {rejecting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Reddediliyor...
                  </span>
                ) : (
                  'Reddet'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentDetail; 