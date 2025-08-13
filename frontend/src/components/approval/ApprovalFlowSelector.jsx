import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { getApprovalTemplates } from '../../api/documents';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth'; // useAuth hook'unu ekledik

/**
 * Onay akışı seçme bileşeni
 * @param {Object} props - Bileşen props'ları
 * @param {Function} props.onSelect - Seçim yapıldığında çağrılacak fonksiyon
 * @param {boolean} props.loading - Yükleniyor durumu
 * @param {Array} props.users - Kullanıcı listesi (onaylayıcı seçimi için)
 */
const ApprovalFlowSelector = ({ onSelect, loading, users = [] }) => {
  const [selectedType, setSelectedType] = useState('standard');
  const [selectedApprovers, setSelectedApprovers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const { showNotification } = useNotification();
  const previousSelectionRef = useRef(null);
  const { user: currentUser } = useAuth(); // Mevcut oturum açmış kullanıcıyı al
  
  // Onay akışı şablonlarını yükle
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const response = await getApprovalTemplates();
        
        if (response && response.data && response.data.templates) {
          setTemplates(response.data.templates);
        } else {
          // Şablon bulunamadığında boş dizi olarak ayarla
          setTemplates([]);
        }
      } catch (error) {
        console.error('Onay şablonları yüklenirken hata:', error);
        showNotification('Onay şablonları yüklenirken bir hata oluştu', 'error');
        // Hata durumunda boş dizi olarak ayarla
        setTemplates([]);
      } finally {
        setLoadingTemplates(false);
      }
    };
    
    fetchTemplates();
  }, [showNotification]);
  
  // Onay türü değiştiğinde seçimleri sıfırla
  useEffect(() => {
    if (selectedType === 'template') {
      setSelectedApprovers([]);
    } else {
      setSelectedTemplate('');
    }
  }, [selectedType]);
  
  // Seçim değiştiğinde parent'a bildir
  useEffect(() => {
    let currentSelection = null;
    
    if (selectedType === 'template') {
      if (selectedTemplate) {
        currentSelection = {
          type: 'template',
          templateId: selectedTemplate,
          flowType: selectedType
        };
      }
    } else {
      if (selectedApprovers.length > 0) {
        currentSelection = {
          type: 'approvers',
          approvers: selectedApprovers,
          flowType: selectedType
        };
      }
    }
    
    // Eğer seçim değiştiyse veya ilk kez bir seçim yapıldıysa onSelect'i çağır
    if (currentSelection && 
        (JSON.stringify(currentSelection) !== JSON.stringify(previousSelectionRef.current))) {
      previousSelectionRef.current = currentSelection;
      onSelect(currentSelection);
    }
  }, [selectedType, selectedTemplate, selectedApprovers, onSelect]);
  
  // Onaylayıcı ekle/çıkar
  const toggleApprover = (userId) => {
    if (selectedApprovers.includes(userId)) {
      setSelectedApprovers(selectedApprovers.filter(id => id !== userId));
    } else {
      setSelectedApprovers([...selectedApprovers, userId]);
    }
  };
  
  // Kullanıcının onaylayıcı olarak seçilebilir olup olmadığını kontrol et
  const canBeApprover = (user) => {
    // Mevcut kullanıcı kendisini onaylayıcı olarak seçemesin
    if (currentUser && (user._id === currentUser._id || user.id === currentUser._id)) {
      return false; // Kendisi onaylayıcı olarak seçilemez
    }
    
    // Sadece ADMIN ve MANAGER rolleri onaylayıcı olabilir
    const role = user.role ? user.role.toUpperCase() : '';
    return role === 'ADMIN' || role === 'MANAGER';
  };
  
  // Onaylayıcı olarak seçilebilecek kullanıcıları filtrele
  const approverUsers = users.filter(canBeApprover);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Onay Akışı Türü
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setSelectedType('quick')}
            className={`py-2 px-3 text-sm font-medium rounded-md ${
              selectedType === 'quick'
                ? 'bg-green-100 text-green-800 border-2 border-green-300'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Hızlı Onay
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('standard')}
            className={`py-2 px-3 text-sm font-medium rounded-md ${
              selectedType === 'standard'
                ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Standart Onay
          </button>
        </div>
        
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setSelectedType('template')}
            className={`py-2 px-3 text-sm font-medium rounded-md ${
              selectedType === 'template'
                ? 'bg-amber-100 text-amber-800 border-2 border-amber-300'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Şablon Kullan
          </button>
        </div>
      </div>
      
      {/* Onay türüne göre farklı içerik göster */}
      {selectedType === 'template' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Onay Şablonu Seçin
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={loadingTemplates}
          >
            <option value="">Şablon Seçin</option>
            {templates.map((template) => (
              <option key={template._id} value={template._id}>
                {template.name}
              </option>
            ))}
          </select>
          
          {loadingTemplates && (
            <div className="mt-2 text-sm text-gray-500">
              Şablonlar yükleniyor...
            </div>
          )}
          
          {selectedTemplate && templates.find(t => t._id === selectedTemplate) && (
            <div className="mt-3 bg-gray-50 p-3 rounded-md">
              <h4 className="text-sm font-medium text-gray-700">Şablon Bilgileri</h4>
              <p className="text-xs text-gray-500 mt-1">
                {templates.find(t => t._id === selectedTemplate).description}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Onaylayıcı Sayısı: {templates.find(t => t._id === selectedTemplate).steps.length}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Onaylayıcıları Seçin {selectedType === 'quick' && '(İlk seçilen kişi onaylayacak)'}
          </label>
          {approverUsers.length === 0 ? (
            <div className="p-4 text-center text-sm bg-yellow-50 border border-yellow-200 rounded-md">
              {loading ? 'Kullanıcılar yükleniyor...' : 'Onaylayıcı olarak seçilebilecek kullanıcı bulunamadı'}
              {!loading && currentUser && (
                <p className="mt-1 text-xs text-amber-600">
                  Not: Bir kullanıcı kendi oluşturduğu belgeleri onaylayamaz, bu yüzden kendiniz onaylayıcı olarak seçilemezsiniz.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-1 border border-gray-200 rounded-md overflow-hidden max-h-60 overflow-y-auto">
              <ul className="divide-y divide-gray-200">
                {approverUsers.map((user) => (
                  <li key={user._id}>
                    <div className="flex items-center px-4 py-2 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedApprovers.includes(user._id)}
                        onChange={() => toggleApprover(user._id)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label className="ml-3 block">
                        <span className="block text-sm font-medium text-gray-700">
                          {user.firstName} {user.lastName} - {user.role} - {user.department} - {user.position}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {user.department ? `${user.department}` : ''}
                          {user.position && user.department ? ` / ` : ''}
                          {user.position ? `${user.position}` : ''}
                        </span>
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {selectedApprovers.length > 0 && (
            <div className="mt-2 text-sm text-gray-500">
              {selectedApprovers.length} onaylayıcı seçildi
              {selectedType === 'standard' ? (
                <span className="ml-1 text-xs text-blue-600">
                  (Onay sırası seçim sırasına göredir)
                </span>
              ) : null}
            </div>
          )}
        </div>
      )}
      
      {/* Onay türüne göre açıklama */}
      {selectedType === 'quick' && (
        <div className="mt-2 text-sm text-gray-500">
          <p>Hızlı onay akışında, onaylayıcılardan herhangi biri onayladığında belge onaylanmış sayılır.</p>
        </div>
      )}
      
      {selectedType === 'standard' && (
        <div className="mt-2 text-sm text-gray-500">
          <p>Standart onay akışında, onaylayıcılar belirtilen sırayla belgeyi onaylar. Bir onaylayıcı onaylamadan sonraki onaylayıcıya geçilmez.</p>
        </div>
      )}
    </div>
  );
};

ApprovalFlowSelector.propTypes = {
  onSelect: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  users: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      firstName: PropTypes.string.isRequired,
      lastName: PropTypes.string.isRequired,
      department: PropTypes.string,
      position: PropTypes.string,
      role: PropTypes.string
    })
  )
};

export default ApprovalFlowSelector; 