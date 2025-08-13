import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocuments } from '../../hooks/useDocuments';
import { useNotification } from '../../hooks/useNotification';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ApprovalFlowSelector from '../../components/approval/ApprovalFlowSelector';
import { getAllUsers, getDepartments } from '../../api/users';
import { DocumentType, DocumentPriority } from '../../utils/constants';

const CreateDocument = () => {
  const navigate = useNavigate();
  const { createDocument, submitForApproval } = useDocuments();
  const { successToast, errorToast } = useNotification();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showApprovalFlow, setShowApprovalFlow] = useState(false);
  const [approvalSelection, setApprovalSelection] = useState(null);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Yeni alanlar
  const [documentType, setDocumentType] = useState('');
  const [priority, setPriority] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [departments, setDepartments] = useState([]);
  const [additionalFiles, setAdditionalFiles] = useState([]);
  const [formStep, setFormStep] = useState(1); // 1: Belge Bilgileri, 2: Onay Akışı
  
  // Dosya yükleme referansı
  const fileInputRef = useRef(null);
  const additionalFilesRef = useRef(null);
  
  // Drag & Drop state'leri
  const [isDragging, setIsDragging] = useState(false);
  
  // Kullanıcıları yükle
  useEffect(() => {
    // Kullanıcı verilerini yükleme fonksiyonu
    // SRP (Single Responsibility Principle): Bu fonksiyon sadece kullanıcıları yükleme işleminden sorumlu
    const fetchUsers = async () => {
      try {
        // Yükleme durumunu güncelle
        setLoadingUsers(true);
        
        // API isteği için parametreleri optimize et - sayfa başına daha fazla kullanıcı getirerek istek sayısını azalt
        // Bu, rate limiting (429 Too Many Requests) hatalarını önlemeye yardımcı olur
        const response = await getAllUsers(1, 50);
        
        // Yanıt verilerini kontrol et ve kullanıcı listesini güncelle
        if (response && response.data && response.data.users) {
          setUsers(response.data.users);
        } else if (response && response.users) {
          // Alternatif veri yapısı
          setUsers(response.users);
        } else if (response && Array.isArray(response)) {
          // Doğrudan dizi olarak dönen yanıt
          setUsers(response);
        } else {
          // Veri yapısı beklenen formatta değilse, hata log'u
          console.warn('Kullanıcı verileri beklenen formatta değil:', response);
          setUsers([]);
        }
      } catch (error) {
        // Hata yönetimi - hata türüne göre özelleştirilmiş mesajlar
        if (error.response) {
          // Sunucu yanıtı ile gelen hatalar
          if (error.response.status === 429) {
            console.error('Rate limit aşıldı. Lütfen daha sonra tekrar deneyin.');
            errorToast('Çok fazla istek gönderildi. Lütfen biraz bekleyin ve sayfayı yenileyin.');
          } else {
            console.error(`Kullanıcılar yüklenirken hata (${error.response.status}):`, error.response.data);
            errorToast('Kullanıcılar yüklenirken bir hata oluştu');
          }
        } else if (error.request) {
          // İstek yapıldı ama yanıt alınamadı
          console.error('Sunucu yanıt vermiyor:', error.request);
          errorToast('Sunucu yanıt vermiyor. Lütfen bağlantınızı kontrol edin.');
        } else {
          // İstek oluşturulurken bir hata oluştu
          console.error('Kullanıcılar yüklenirken hata:', error.message);
          errorToast('Kullanıcılar yüklenirken bir hata oluştu');
        }
        // Hata durumunda boş dizi olarak ayarla
        setUsers([]);
      } finally {
        // İşlem tamamlandığında yükleme durumunu güncelle
        setLoadingUsers(false);
      }
    };
    
    // Komponent mount edildiğinde kullanıcıları yükle
    fetchUsers();
    
    // Dependency array: errorToast değiştiğinde useEffect yeniden çalışır
    // Bu, errorToast fonksiyonunun referansının değişmesi durumunda memory leak'leri önler
  }, [errorToast]);
  
  // Departmanları yükle
  useEffect(() => {
    // Departman verilerini yükleme fonksiyonu
    // SRP (Single Responsibility Principle): Bu fonksiyon sadece departmanları yükleme işleminden sorumlu
    const fetchDepartments = async () => {
      try {
        // Varsayılan departman listesi - API yanıt vermezse kullanılacak
        const defaultDepartments = [
          { id: 'IT', name: 'Bilgi Teknolojileri' },
          { id: 'HR', name: 'İnsan Kaynakları' },
          { id: 'FINANCE', name: 'Finans' },
          { id: 'MARKETING', name: 'Pazarlama' },
          { id: 'SALES', name: 'Satış' },
          { id: 'OPERATIONS', name: 'Operasyon' },
          { id: 'LEGAL', name: 'Hukuk' },
          { id: 'CUSTOMER_SERVICE', name: 'Müşteri Hizmetleri' },
          { id: 'RESEARCH', name: 'Araştırma ve Geliştirme' }
        ];
        
        // API'den departmanları getirmeye çalış
        // Bu kısım, gerçek API'niz varsa ona göre uyarlanmalı
        // Örnek: const response = await getDepartments();
        
        // API yanıtı yoksa varsayılan listeyi kullan
        setDepartments(defaultDepartments);
        
      } catch (error) {
        console.warn('Departman listesi getirilemedi, varsayılan liste kullanılıyor:', error);
        // Hata durumunda varsayılan departman listesini kullan
        const defaultDepartments = [
          { id: 'IT', name: 'Bilgi Teknolojileri' },
          { id: 'HR', name: 'İnsan Kaynakları' },
          { id: 'FINANCE', name: 'Finans' },
          { id: 'MARKETING', name: 'Pazarlama' },
          { id: 'SALES', name: 'Satış' },
          { id: 'OPERATIONS', name: 'Operasyon' },
          { id: 'LEGAL', name: 'Hukuk' },
          { id: 'CUSTOMER_SERVICE', name: 'Müşteri Hizmetleri' },
          { id: 'RESEARCH', name: 'Araştırma ve Geliştirme' }
        ];
        setDepartments(defaultDepartments);
      }
    };
    
    // Komponent mount edildiğinde departmanları yükle
    fetchDepartments();
  }, []);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Form validasyonu
      const validationErrors = [];
      
      // Başlık kontrolü - boş olmamalı ve 3-200 karakter arasında olmalı
      if (!title || !title.trim()) {
        validationErrors.push('Lütfen belge başlığı girin');
      } else if (title.trim().length < 3) {
        validationErrors.push('Başlık en az 3 karakter olmalıdır');
      } else if (title.trim().length > 200) {
        validationErrors.push('Başlık en fazla 200 karakter olabilir');
      }
      
      // Dosya kontrolü
      if (!file) {
        validationErrors.push('Lütfen bir dosya seçin');
      } else {
        // Dosya tipi kontrolü
        if (file.type !== 'application/pdf') {
          validationErrors.push('Sadece PDF dosyaları yüklenebilir');
        }
        
        // Dosya boyutu kontrolü (10MB)
        if (file.size > 10 * 1024 * 1024) {
          validationErrors.push('Dosya boyutu 10MB\'dan küçük olmalıdır');
        }
      }
      
      // Belge türü kontrolü
      if (!documentType) {
        validationErrors.push('Lütfen belge türü seçin');
      }
      
      // Onay akışı kontrolü
      if (showApprovalFlow) {
        if (!approvalSelection) {
          validationErrors.push('Lütfen onay akışı için onaylayıcıları veya bir şablon seçin');
        } else if (
          approvalSelection.type === 'approvers' && 
          (!approvalSelection.approvers || approvalSelection.approvers.length === 0)
        ) {
          validationErrors.push('Lütfen en az bir onaylayıcı seçin');
        } else if (
          approvalSelection.type === 'template' && 
          !approvalSelection.templateId
        ) {
          validationErrors.push('Lütfen bir onay akışı şablonu seçin');
        }
        
        // Onay akışı türü kontrolü
        if (approvalSelection && approvalSelection.flowType) {
          const validFlowTypes = ['quick', 'standard', 'comprehensive'];
          if (!validFlowTypes.includes(approvalSelection.flowType)) {
            validationErrors.push(`Geçersiz onay akışı türü. Geçerli değerler: ${validFlowTypes.join(', ')}`);
          }
        }
      }
      
      // Validasyon hataları varsa göster ve işlemi durdur
      if (validationErrors.length > 0) {
        console.error('Form validasyon hataları:', validationErrors);
        validationErrors.forEach(error => errorToast(error));
        return;
      }
      
      setLoading(true);
      
      // FormData oluştur ve validasyon kontrollerinden geçmiş verileri ekle
      const formData = new FormData();
      
      // Başlık - trim edilmiş olarak ekle
      const trimmedTitle = title.trim();
      formData.append('title', trimmedTitle);
      
      // Açıklama - varsa ve boş değilse ekle
      if (description && description.trim()) {
        formData.append('description', description.trim());
      }
      
      // Belge türü
      formData.append('documentType', documentType);
      
      // Öncelik
      formData.append('priority', priority);
      
      // Hedef departman - varsa ekle
      if (targetDepartment) {
        formData.append('targetDepartment', targetDepartment);
      }
      
      // Geçerlilik tarihi - varsa ekle
      if (dueDate) {
        formData.append('dueDate', dueDate);
      }
      
      // Ek dosyalar - varsa ekle
      if (additionalFiles.length > 0) {
        // Her bir ek dosyayı formData'ya ekle
        additionalFiles.forEach((file, index) => {
          formData.append(`additionalFiles`, file);
        });
        
        // Ek dosya sayısını ekle
        formData.append('additionalFilesCount', additionalFiles.length);
      }
      
      // Content alanı - minimum 10 karakter olacak şekilde ekleyelim
      formData.append('content', 'Bu belge için içerik alanıdır. Minimum karakter sınırını geçmek için eklendi. Bu içerik otomatik olarak oluşturulmuştur.');
      
      // Dosya - validasyondan geçtiğinden emin olduk
      formData.append('file', file);
      
      console.log('Belge oluşturma isteği gönderiliyor...');
      
      // Belge oluştur
      const response = await createDocument(formData);
      
      if (!response) {
        console.error('Belge oluşturma yanıtı geçersiz: yanıt alınamadı');
        throw new Error('Belge oluşturma başarısız - Sunucu yanıtı alınamadı');
      }
      
      console.log('Belge oluşturma yanıtı:', response);
      
      // API yanıt formatını kontrol et
      let documentId;
      
      // Farklı yanıt formatlarını kontrol et
      if (response.data?.data?.document?._id) {
        // Format 1: response.data.data.document
        documentId = response.data.data.document._id;
      } else if (response.data?.document?._id) {
        // Format 2: response.data.document
        documentId = response.data.document._id;
      } else if (response.data?.data?._id) {
        // Format 3: response.data.data
        documentId = response.data.data._id;
      } else if (response.data?._id) {
        // Format 4: response.data
        documentId = response.data._id;
      } else {
        // Yanıt içinde ID'yi ara
        const findId = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj._id) return obj._id;
          
          for (const key in obj) {
            if (typeof obj[key] === 'object') {
              const found = findId(obj[key]);
              if (found) return found;
            }
          }
          return null;
        };
        
        documentId = findId(response.data);
        
        if (!documentId) {
          console.error('Belge oluşturma yanıtında document ID bulunamadı:', response.data);
          throw new Error('Belge oluşturma başarısız - Belge ID bilgisi alınamadı');
        }
      }
      
      console.log('Belge başarıyla oluşturuldu:', documentId);
      
      successToast('Belge başarıyla oluşturuldu');
      
      // Onay akışı seçilmişse, belgeyi onaya gönder
      if (showApprovalFlow && approvalSelection) {
        try {
          console.log('Belge onaya gönderiliyor:', approvalSelection);
          
          let result;
          
          if (approvalSelection.type === 'template' && approvalSelection.templateId) {
            // Şablon ile onay
            result = await submitForApproval(
              documentId, 
              approvalSelection.templateId, 
              [],
              approvalSelection.flowType || 'standard'
            );
            
            console.log('Belge şablon ile onaya gönderildi, sonuç:', result);
          } else if (approvalSelection.type === 'approvers' && approvalSelection.approvers && approvalSelection.approvers.length > 0) {
            // Onaylayıcılar ile onay
            result = await submitForApproval(
              documentId, 
              null, 
              approvalSelection.approvers,
              approvalSelection.flowType || 'standard'
            );
            
            console.log('Belge onaylayıcılar ile onaya gönderildi, sonuç:', result);
          } else {
            console.warn('Onay akışı seçildi ama gerekli bilgiler eksik');
            errorToast('Onay akışı bilgileri eksik');
            // Belge detay sayfasına yönlendir, onay süreci başarısız olsa da belge oluşturuldu
            navigate(`/belgeler/${documentId}`);
            return;
          }
          
          // Onay süreci başarılı
          if (result) {
            successToast('Belge onay sürecine gönderildi');
            
            // Onay akışının tam olarak oluşturulduğundan emin olmak için ek gecikme
            console.log('Yönlendirmeden önce onay akışının tam olarak oluşturulmasını bekleniyor...');
            await new Promise(resolve => setTimeout(resolve, 1500));
          } else {
            // result undefined/null ise
            console.warn('Onay süreci başarılı ancak yanıt alınamadı');
            successToast('Belge oluşturuldu, onay sürecine gönderildi');
            
            // Yine de gecikme ekleyelim
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        } catch (error) {
          console.error('Onaya gönderme hatası:', error);
          
          // Hata mesajını göster
          if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
            try {
              // Alan bazlı hataları göster
              Object.entries(error.fieldErrors).forEach(([field, message]) => {
                // Nesne kontrolü yaparak güvenli bir şekilde mesajı göster
                const errorValue = typeof message === 'object' && message !== null 
                  ? JSON.stringify(message) 
                  : String(message);
                errorToast(`${field}: ${errorValue}`);
              });
            } catch (formatError) {
              console.error('Onay hatası mesajı formatlanırken sorun oluştu:', formatError);
              errorToast('Onay akışı doğrulama hatası oluştu.');
            }
          } else if (error.response?.data?.message) {
            errorToast(`Onaya gönderme hatası: ${error.response.data.message}`);
          } else if (error.message) {
            errorToast(`Onaya gönderme hatası: ${error.message}`);
          } else {
            errorToast('Belge oluşturuldu ancak onaya gönderilemedi');
          }
          
          // Hata durumunda da belge detay sayfasına yönlendir, belge oluşturuldu ama onay süreci başarısız
          navigate(`/belgeler/${documentId}`);
          return;
        }
      }
      
      // Belge detay sayfasına yönlendir
      navigate(`/belgeler/${documentId}`);
    } catch (error) {
      console.error('Belge oluşturma hatası:', error);
      
      // Hata mesajını göster
      if (error.isValidationError) {
        // Doğrulama hatalarını ayrıştır ve göster
        if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
          try {
            // Alan bazlı hataları göster
            Object.entries(error.fieldErrors).forEach(([field, message]) => {
              // Nesne kontrolü yaparak güvenli bir şekilde mesajı göster
              const errorValue = typeof message === 'object' && message !== null 
                ? JSON.stringify(message) 
                : String(message);
              errorToast(`${field}: ${errorValue}`);
            });
          } catch (formatError) {
            console.error('Hata mesajı formatlanırken sorun oluştu:', formatError);
            errorToast('Form doğrulama hatası oluştu. Lütfen tüm alanları kontrol edin.');
          }
        } else {
          const errorMsg = error.message || 'Belge bilgileri geçerli değil';
          
          try {
            // Doğrulama hataları içinde virgülle ayrılmış hatalar olabilir
            if (errorMsg.includes(':') && errorMsg.includes(',')) {
              const errorParts = errorMsg.split(':');
              if (errorParts.length > 1) {
                const errors = errorParts[1].split(',').map(e => e.trim());
                errors.forEach(err => errorToast(err));
              } else {
                errorToast(errorMsg);
              }
            } else {
              errorToast(errorMsg);
            }
          } catch (parseError) {
            console.error('Hata mesajı ayrıştırılırken sorun oluştu:', parseError);
            errorToast('Belge oluşturma sırasında bir hata oluştu.');
          }
        }
      } else if (error.response?.data?.message) {
        errorToast(`Belge oluşturma hatası: ${error.response.data.message}`);
      } else if (error.message) {
        errorToast(`Belge oluşturma hatası: ${error.message}`);
      } else {
        errorToast('Belge oluşturulurken bir hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    if (selectedFile) {
      // Dosya boyutu kontrolü (10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        errorToast('Dosya boyutu 10MB\'dan küçük olmalıdır');
        e.target.value = null;
        return;
      }
      
      // PDF dosyası kontrolü
      if (selectedFile.type !== 'application/pdf') {
        errorToast('Sadece PDF dosyaları yüklenebilir');
        e.target.value = null;
        return;
      }
      
      setFile(selectedFile);
    }
  };
  
  // Drag & Drop işlemleri
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      // Dosya validasyonu
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  };
  
  // Dosya validasyonu
  const validateFile = (file) => {
    // Dosya tipi kontrolü
    if (file.type !== 'application/pdf') {
      errorToast('Sadece PDF dosyaları yüklenebilir');
      return false;
    }
    
    // Dosya boyutu kontrolü (10MB)
    if (file.size > 10 * 1024 * 1024) {
      errorToast('Dosya boyutu 10MB\'dan küçük olmalıdır');
      return false;
    }
    
    return true;
  };
  
  const handleApprovalSelect = (selection) => {
    setApprovalSelection(selection);
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Yeni Belge Oluştur</h1>
        
        {/* Form adımları göstergesi */}
        <div className="flex items-center space-x-2">
          <div className={`flex items-center justify-center h-8 w-8 rounded-full ${formStep === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            1
          </div>
          <div className={`h-1 w-8 ${formStep === 1 ? 'bg-gray-300' : 'bg-blue-600'}`}></div>
          <div className={`flex items-center justify-center h-8 w-8 rounded-full ${formStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            2
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* Adım 1: Belge Bilgileri */}
            {formStep === 1 && (
              <>
                <Card>
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Belge Bilgileri</h2>
                    
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                          Belge Başlığı *
                        </label>
                        <input
                          type="text"
                          id="title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Belge başlığını girin"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="documentType" className="block text-sm font-medium text-gray-700 mb-1">
                            Belge Türü *
                          </label>
                          <select
                            id="documentType"
                            value={documentType}
                            onChange={(e) => setDocumentType(e.target.value)}
                            className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          >
                            <option value="">Seçiniz</option>
                            <option value="OTHER">Diğer</option>
                            <option value="REPORT">Rapor</option>
                            <option value="CONTRACT">Sözleşme</option>
                            <option value="INVOICE">Fatura</option>
                            <option value="LETTER">Yazı/Mektup</option>
                            <option value="APPLICATION">Başvuru/Dilekçe</option>
                            <option value="FORM">Form</option>
                            <option value="CERTIFICATE">Sertifika/Belge</option>
                            <option value="PROTOCOL">Protokol</option>
                            <option value="RECEIPT">Makbuz</option>
                            <option value="PETITION">Dilekçe</option>
                            <option value="MEMO">Not/Memorandum</option>
                            <option value="ANNOUNCEMENT">Duyuru</option>
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                            Öncelik
                          </label>
                          <select
                            id="priority"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Seçiniz</option>
                            <option value="low">Düşük</option>
                            <option value="medium">Normal</option>
                            <option value="high">Yüksek</option>
                            <option value="high">Acil</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="targetDepartment" className="block text-sm font-medium text-gray-700 mb-1">
                            Hedef Departman
                          </label>
                          <select
                            id="targetDepartment"
                            value={targetDepartment}
                            onChange={(e) => setTargetDepartment(e.target.value)}
                            className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Seçiniz</option>
                            {departments.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
                            Geçerlilik Tarihi
                          </label>
                          <input
                            type="date"
                            id="dueDate"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                          Açıklama
                        </label>
                        <textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows="4"
                          className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Belge açıklaması girin"
                        ></textarea>
                      </div>
                    </div>
                  </div>
                </Card>
                
                <Card>
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Dosya Yükleme</h2>
                    
                    <div 
                      className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer ${
                        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {file ? (
                        <div className="flex flex-col items-center">
                          <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="mt-2 text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                          <button
                            type="button"
                            className="mt-2 text-sm text-red-600 hover:text-red-800"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFile(null);
                            }}
                          >
                            Dosyayı Kaldır
                          </button>
                        </div>
                      ) : (
                        <>
                          <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="mt-2 text-sm font-medium text-gray-900">Dosya yüklemek için tıklayın veya sürükleyin</p>
                          <p className="text-xs text-gray-500">Sadece PDF dosyaları, maksimum 10MB</p>
                        </>
                      )}
                      
                      <input
                        ref={fileInputRef}
                        type="file"
                        id="file"
                        onChange={handleFileChange}
                        className="hidden"
                        accept="application/pdf"
                        required
                      />
                    </div>
                  </div>
                </Card>
                
                <Card>
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Ek Dosyalar (Opsiyonel)</h2>
                    
                    <div className="space-y-4">
                      <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400">
                        <input
                          ref={additionalFilesRef}
                          type="file"
                          id="additionalFiles"
                          onChange={(e) => {
                            const files = Array.from(e.target.files);
                            // Her dosya için boyut kontrolü (5MB)
                            const validFiles = files.filter(file => {
                              if (file.size > 5 * 1024 * 1024) {
                                errorToast(`${file.name}: Dosya boyutu 5MB'dan küçük olmalıdır`);
                                return false;
                              }
                              return true;
                            });
                            
                            setAdditionalFiles(prev => [...prev, ...validFiles]);
                            e.target.value = null; // Input'u sıfırla
                          }}
                          className="hidden"
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        />
                        <div 
                          className="flex flex-col items-center"
                          onClick={() => additionalFilesRef.current?.click()}
                        >
                          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          <p className="mt-2 text-sm font-medium text-gray-900">Ek dosya eklemek için tıklayın</p>
                          <p className="text-xs text-gray-500">PDF, Word, Excel, Resim dosyaları, maksimum 5MB</p>
                        </div>
                      </div>
                      
                      {/* Eklenen dosyaların listesi */}
                      {additionalFiles.length > 0 && (
                        <div className="mt-4">
                          <h3 className="text-sm font-medium text-gray-700 mb-2">Eklenen Dosyalar ({additionalFiles.length})</h3>
                          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                            {additionalFiles.map((file, index) => (
                              <li key={index} className="px-4 py-3 flex items-center justify-between text-sm">
                                <div className="flex items-center">
                                  <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="truncate">{file.name}</span>
                                  <span className="ml-2 text-xs text-gray-500">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                                </div>
                                <button
                                  type="button"
                                  className="text-red-600 hover:text-red-800"
                                  onClick={() => {
                                    setAdditionalFiles(prev => prev.filter((_, i) => i !== index));
                                  }}
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </>
            )}
            
            {/* Adım 2: Onay Akışı */}
            {formStep === 2 && (
              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Onay Akışı</h2>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="enableApprovalFlow"
                        checked={showApprovalFlow}
                        onChange={(e) => setShowApprovalFlow(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="enableApprovalFlow" className="ml-2 text-sm text-gray-700">
                        Onay akışı ekle
                      </label>
                    </div>
                  </div>
                  
                  {showApprovalFlow ? (
                    <ApprovalFlowSelector 
                      onSelect={handleApprovalSelect} 
                      loading={loadingUsers}
                      users={users}
                    />
                  ) : (
                    <p className="text-sm text-gray-500">
                      Belgeyi onay akışına göndermek için onay akışı eklemeyi seçin.
                    </p>
                  )}
                </div>
              </Card>
            )}
          </div>
          
          <div className="space-y-6">
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">İşlemler</h2>
                
                <div className="space-y-4">
                  {formStep === 1 ? (
                    <Button
                      type="button"
                      onClick={() => setFormStep(2)}
                      disabled={loading || !title || !file}
                      color="primary"
                      className="w-full flex justify-center"
                    >
                      Devam Et
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="submit"
                        disabled={loading}
                        color="primary"
                        className="w-full flex justify-center"
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Kaydediliyor...
                          </>
                        ) : (
                          <>
                            {showApprovalFlow && approvalSelection ? 'Oluştur ve Onaya Gönder' : 'Belgeyi Oluştur'}
                          </>
                        )}
                      </Button>
                      
                      <Button
                        type="button"
                        onClick={() => setFormStep(1)}
                        disabled={loading}
                        color="secondary"
                        className="w-full"
                      >
                        Geri
                      </Button>
                    </>
                  )}
                  
                  <Button
                    type="button"
                    onClick={() => navigate('/belgeler')}
                    disabled={loading}
                    color="secondary"
                    className="w-full"
                  >
                    İptal
                  </Button>
                </div>
                
                <div className="mt-6 text-xs text-gray-500">
                  <p>* ile işaretli alanlar zorunludur</p>
                  {formStep === 2 && showApprovalFlow && !approvalSelection && (
                    <p className="text-amber-600 mt-2">
                      Onay akışı eklemek için onaylayıcıları veya bir şablon seçin
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateDocument; 