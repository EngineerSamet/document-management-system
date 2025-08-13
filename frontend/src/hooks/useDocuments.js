import { useState, useCallback } from 'react';
import axios from 'axios';
import * as documentsApi from '../api/documents';
import { useAuth } from './useAuth';
import { API_URL } from '../utils/constants';

export const useDocuments = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Belge listesini getir
  const getDocuments = async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      let response;
      
      // Admin ise tüm belgeleri getir, değilse sadece kullanıcının belgelerini getir
      if (user && user.role === 'admin') {
        console.log('Admin kullanıcısı için tüm belgeler getiriliyor');
        response = await axios.get(`${API_URL}/api/documents/admin/all`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`
          }
        });
      } else {
        console.log('Kullanıcının belgeleri getiriliyor');
        response = await documentsApi.getUserDocuments();
      }
      
      console.log('Belgeler cevabı:', response);
      
      return response;
    } catch (err) {
      console.error('Belge getirme hatası:', err);
      setError(err.response?.data?.message || 'Belgeler yüklenirken bir hata oluştu');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Belirli bir belgeyi getir
  const getDocumentById = async (id) => {
    try {
      setLoading(true);
      setError(null);
      const response = await documentsApi.getDocument(id);
      return response;
    } catch (err) {
      setError(err.response?.data?.message || 'Belge yüklenirken bir hata oluştu');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Yeni belge oluştur
  const createDocument = useCallback(async (documentData) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('createDocument hook çağrıldı');
      
      // FormData kontrolü
      if (!(documentData instanceof FormData)) {
        console.error('createDocument hook: documentData FormData tipinde değil');
        throw new Error('Belge verileri FormData tipinde olmalıdır');
      }
      
      // Zorunlu alanların kontrolü
      const requiredFields = ['title', 'file'];
      const missingFields = [];
      
      // Her zorunlu alanı kontrol et
      for (const field of requiredFields) {
        const value = documentData.get(field);
        if (!value) {
          missingFields.push(field);
          console.error(`createDocument hook: Eksik zorunlu alan: ${field}`);
        }
      }
      
      // Başlık kontrolü - varsa uzunluk kontrolü yap
      const title = documentData.get('title');
      if (title) {
        if (title.trim().length < 3) {
          console.error(`createDocument hook: Başlık çok kısa: ${title.length} karakter`);
          throw new Error('Başlık en az 3 karakter olmalıdır');
        } else if (title.trim().length > 200) {
          console.error(`createDocument hook: Başlık çok uzun: ${title.length} karakter`);
          throw new Error('Başlık en fazla 200 karakter olabilir');
        }
      }
      
      // Dosya kontrolü - varsa tip ve boyut kontrolü yap
      const file = documentData.get('file');
      if (file) {
        // Dosya tipi kontrolü
        if (file.type !== 'application/pdf') {
          console.error(`createDocument hook: Geçersiz dosya türü: ${file.type}`);
          throw new Error('Sadece PDF dosyaları yüklenebilir');
        }
        
        // Dosya boyutu kontrolü (10MB)
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxFileSize) {
          console.error(`createDocument hook: Dosya boyutu çok büyük: ${file.size} bytes`);
          throw new Error('Dosya boyutu 10MB\'dan küçük olmalıdır');
        }
      }
      
      // Eksik zorunlu alanlar varsa hata fırlat
      if (missingFields.length > 0) {
        const errorMessage = `Doğrulama hataları: ${missingFields.map(field => {
          switch(field) {
            case 'title': return 'Başlık zorunludur';
            case 'file': return 'Dosya zorunludur';
            default: return `${field} zorunludur`;
          }
        }).join(', ')}`;
        
        console.error(`createDocument hook: ${errorMessage}`);
        throw new Error(errorMessage);
      }
      
      // API çağrısı
      console.log('createDocument hook: API çağrısı yapılıyor');
      const result = await documentsApi.createDocument(documentData);
      console.log('createDocument hook: API çağrısı başarılı', result);
      
      setLoading(false);
      return result;
    } catch (err) {
      console.error('Belge oluşturma hook hatası:', err);
      
      // Hata mesajını ayarla
      let errorMessage = err.message || 'Belge oluşturulurken bir hata oluştu';
      
      // Hata türüne göre özel mesajlar
      if (err.isValidationError) {
        // Validasyon hatası
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          try {
            // Alan bazlı hataları göster
            const fieldErrorMessages = Object.entries(err.fieldErrors).map(([field, message]) => {
              // Mesaj bir nesne ise, JSON.stringify ile dönüştür
              const errorValue = typeof message === 'object' && message !== null 
                ? JSON.stringify(message) 
                : String(message);
              return `${field}: ${errorValue}`;
            });
            
            errorMessage = `Doğrulama hataları: ${fieldErrorMessages.join(', ')}`;
          } catch (formatError) {
            console.error('Hata mesajı formatlanırken sorun oluştu:', formatError);
            errorMessage = 'Belge doğrulama hatası oluştu. Lütfen form alanlarını kontrol edin.';
          }
        } else {
          errorMessage = err.message || 'Belge bilgileri geçerli değil';
        }
        
        console.warn('Validasyon hatası:', errorMessage);
      } else if (err.isPermissionError) {
        errorMessage = err.message || 'Bu işlem için yetkiniz bulunmuyor';
        console.warn('Yetki hatası:', errorMessage);
      } else if (err.isAuthError) {
        errorMessage = 'Oturum süresi dolmuş, lütfen tekrar giriş yapın';
        console.warn('Oturum hatası:', errorMessage);
      } else if (err.isNotFoundError) {
        errorMessage = err.message || 'İlgili kaynak bulunamadı';
        console.warn('Kaynak bulunamadı hatası:', errorMessage);
      } else if (err.isNetworkError) {
        errorMessage = 'Sunucuya bağlanılamıyor, lütfen internet bağlantınızı kontrol edin';
        console.warn('Ağ hatası:', errorMessage);
      }
      
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, []);

  // Belge güncelle
  const updateDocument = useCallback(async (documentId, documentData) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await documentsApi.updateDocument(documentId, documentData);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.response?.data?.message || 'Belge güncellenirken bir hata oluştu');
      setLoading(false);
      throw err;
    }
  }, []);

  // Belge sil
  const deleteDocument = useCallback(async (documentId) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await documentsApi.deleteDocument(documentId);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.response?.data?.message || 'Belge silinirken bir hata oluştu');
      setLoading(false);
      throw err;
    }
  }, []);

  // Tüm belgeleri sil (sadece admin)
  const deleteAllDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await documentsApi.deleteAllDocuments();
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.response?.data?.message || 'Tüm belgeler silinirken bir hata oluştu');
      setLoading(false);
      throw err;
    }
  }, []);

  // Belgeyi onaya gönder
  const submitForApproval = useCallback(async (documentId, approvalFlowId = null, approvers = [], flowType = 'standard') => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Belge onaya gönderme işlemi başlatıldı - Belge ID: ${documentId}`);
      
      // Belge ID kontrolü
      if (!documentId) {
        throw new Error('Belge ID parametresi gereklidir');
      }
      
      // approvalFlowId veya approvers kontrolü
      if (!approvalFlowId && (!approvers || !Array.isArray(approvers) || approvers.length === 0)) {
        throw new Error('Onaylayıcılar veya onay akışı şablonu belirtilmelidir');
      }
      
      // Onay akışı türü kontrolü
      const validFlowTypes = ['quick', 'standard', 'sequential'];
      if (flowType && !validFlowTypes.includes(flowType)) {
        throw new Error(`Geçersiz onay akışı türü. Geçerli değerler: ${validFlowTypes.join(', ')}`);
      }
      
      // Belge erişim kontrolünü backend'e bırak, frontend'de kontrol yapmayı kaldır
      console.log(`Belge onaya gönderiliyor: ${documentId}`);
      
      // API çağrısı
      const result = await documentsApi.submitForApproval(documentId, approvalFlowId, approvers, flowType);
      
      // Onay akışının oluşturulmasını beklet (500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Onay akışının oluşturulduğundan emin ol
      let retryCount = 0;
      const maxRetries = 3;
      let approvalFlow = null;
      
      while (retryCount < maxRetries && !approvalFlow) {
        try {
          console.log(`Onay akışı kontrolü yapılıyor (${retryCount + 1}/${maxRetries})...`);
          const response = await documentsApi.getDocumentApprovalFlow(documentId);
          approvalFlow = response?.data?.approvalFlow;
          
          if (!approvalFlow) {
            if (retryCount < maxRetries - 1) {
              console.warn(`Onay akışı henüz oluşturulmamış, tekrar deneniyor...`);
              // Artan bekleme süresi (300ms, 600ms, 900ms)
              await new Promise(resolve => setTimeout(resolve, 300 * (retryCount + 1)));
            }
          } else {
            console.log(`Onay akışı başarıyla doğrulandı: ${approvalFlow._id}`);
          }
        } catch (error) {
          console.warn(`Onay akışı kontrolü sırasında hata: ${error.message}`);
          if (retryCount < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 300 * (retryCount + 1)));
          }
        }
        
        retryCount++;
      }
      
      setLoading(false);
      return result;
    } catch (err) {
      console.error('Belge onaya gönderme hatası:', err);
      
      // Hata mesajını ayarla
      let errorMessage = err.message || 'Belge onaya gönderilirken bir hata oluştu';
      
      // Hata türüne göre işlem yap
      if (err.response) {
        // Sunucu yanıtı ile dönen hatalar
        const statusCode = err.response.status;
        
        if (statusCode === 403) {
          // Yetki hatası
          errorMessage = err.response.data?.message || 'Bu belgeyi onaya gönderme yetkiniz bulunmamaktadır';
          console.warn('Onaya gönderme yetki hatası:', errorMessage);
        } else if (statusCode === 404) {
          // Belge bulunamadı
          errorMessage = err.response.data?.message || 'Belge bulunamadı';
          console.warn('Belge bulunamadı:', errorMessage);
        } else if (statusCode === 400) {
          // Validasyon hatası
          errorMessage = err.response.data?.message || 'Onay akışı bilgileri geçerli değil';
          console.warn('Validasyon hatası:', errorMessage);
        } else if (statusCode === 401) {
          // Oturum hatası
          errorMessage = 'Oturum süresi dolmuş, lütfen tekrar giriş yapın';
          console.warn('Oturum hatası:', errorMessage);
        } else {
          // Diğer sunucu hataları
          errorMessage = err.response.data?.message || `Sunucu hatası: ${statusCode}`;
          console.warn(`Sunucu hatası (${statusCode}):`, errorMessage);
        }
      } else if (err.isPermissionError) {
        // Yetki hatası
        errorMessage = err.message || 'Bu belgeyi onaya gönderme yetkiniz bulunmamaktadır';
        console.warn('Onaya gönderme yetki hatası:', errorMessage);
      } else if (err.isNotFoundError) {
        // Belge bulunamadı
        errorMessage = err.message || 'Belge bulunamadı';
        console.warn('Belge bulunamadı:', errorMessage);
      } else if (err.isValidationError) {
        // Validasyon hatası
        errorMessage = err.message || 'Onay akışı bilgileri geçerli değil';
        console.warn('Validasyon hatası:', errorMessage);
      } else if (err.isAuthError) {
        // Oturum hatası
        errorMessage = 'Oturum süresi dolmuş, lütfen tekrar giriş yapın';
        console.warn('Oturum hatası:', errorMessage);
      } else if (err.isNetworkError) {
        // Ağ hatası
        errorMessage = 'Sunucuya bağlanılamıyor, lütfen internet bağlantınızı kontrol edin';
        console.warn('Ağ hatası:', errorMessage);
      }
      
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, [user]);

  // Onay bekleyen belgeleri getir
  const getPendingApprovals = useCallback(async (page = 1, limit = 10) => {
    setLoading(true);
    setError(null);
    
    try {
      // Son başarısız API isteğinden bu yana yeterli zaman geçti mi kontrol et
      const lastFailedApiCall = localStorage.getItem('lastFailedPendingApiCall');
      const cooldownPeriod = 60000; // 60 saniye
      
      if (lastFailedApiCall) {
        const timeSinceLastFailure = Date.now() - parseInt(lastFailedApiCall);
        if (timeSinceLastFailure < cooldownPeriod) {
          console.warn(`useDocuments: Son başarısız denemeden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
          setLoading(false);
          // Boş bir yanıt döndür, hata fırlatma
          return { 
            data: { 
              data: { 
                documents: [], 
                pagination: { total: 0, page, limit, pages: 1 } 
              }
            }
          };
        }
      }
      
      const result = await documentsApi.getPendingApprovals(page, limit);
      
      // Başarılı API çağrısı, cooldown kaydını temizle
      localStorage.removeItem('lastFailedPendingApiCall');
      
      setLoading(false);
      return result;
    } catch (err) {
      // Network hatası durumunda son başarısız deneme zamanını kaydet
      if (err.message === 'Network Error' || 
          err.code === 'ERR_NETWORK' || 
          err.code === 'ECONNABORTED' || 
          err.message?.includes('timeout') ||
          err.message?.includes('ERR_INSUFFICIENT_RESOURCES') ||
          err.name === 'AbortError' ||
          err.name === 'CanceledError') {
        localStorage.setItem('lastFailedPendingApiCall', Date.now().toString());
        console.warn('useDocuments: Network hatası nedeniyle onay bekleyen belgeler alınamadı, sonraki denemeler için cooldown uygulanacak');
      }
      
      console.error('useDocuments: Onay bekleyen belgeleri getirme hatası:', err);
      setError(err.response?.data?.message || 'Onay bekleyen belgeler alınırken bir hata oluştu');
      setLoading(false);
      
      // Hata fırlatmak yerine boş bir yanıt döndür
      return { 
        data: { 
          data: { 
            documents: [], 
            pagination: { total: 0, page, limit, pages: 1 } 
          }
        }
      };
    }
  }, []);

  // Belgeyi onayla
  const approveDocument = useCallback(async (documentId, comment = '') => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Belge onaylama işlemi başlatıldı - Belge ID: ${documentId}`);
      
      // Belge ID kontrolü
      if (!documentId) {
        throw new Error('Belge ID parametresi gereklidir');
      }
      
      const result = await documentsApi.approveDocument(documentId, comment);
      setLoading(false);
      return result;
    } catch (err) {
      console.error('Belge onaylama hatası:', err);
      
      // Hata mesajını ayarla
      const errorMessage = err.message || 'Belge onaylanırken bir hata oluştu';
      setError(errorMessage);
      
      // Hata türüne göre işlem yap
      if (err.isPermissionError) {
        // Yetki hatası veya belge zaten onaylanmış
        console.warn('Onay yetki hatası veya belge durumu uygun değil:', errorMessage);
      } else if (err.isNotFoundError) {
        // Belge bulunamadı
        console.warn('Belge bulunamadı:', errorMessage);
      } else if (err.isValidationError) {
        // Validasyon hatası
        console.warn('Validasyon hatası:', errorMessage);
      }
      
      setLoading(false);
      throw err;
    }
  }, []);

  // Belgeyi reddet
  const rejectDocument = useCallback(async (documentId, comment = '') => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await documentsApi.rejectDocument(documentId, comment);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.response?.data?.message || 'Belge reddedilirken bir hata oluştu');
      setLoading(false);
      throw err;
    }
  }, []);

  // Onay akışlarını getir
  const getApprovalFlows = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_URL}/api/approval-flows`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      return response;
    } catch (err) {
      setError(err.response?.data?.message || 'Onay akışları yüklenirken bir hata oluştu');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Kullanıcının belgelerini getirme
  const getUserDocuments = async (page = 1, limit = 10) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await documentsApi.getUserDocuments(page, limit);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.response?.data?.message || 'Belgeler alınırken bir hata oluştu');
      setLoading(false);
      throw err;
    }
  };

  return {
    loading,
    error,
    getDocuments,
    getDocumentById,
    createDocument,
    updateDocument,
    deleteDocument,
    deleteAllDocuments,
    submitForApproval,
    getPendingApprovals,
    approveDocument,
    rejectDocument,
    getApprovalFlows,
    getUserDocuments,
    getDocumentDownloadUrl: documentsApi.getDocumentDownloadUrl
  };
};
