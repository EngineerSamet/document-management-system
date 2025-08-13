import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../utils/constants';

const CreateApprovalFlow = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [flowType, setFlowType] = useState('sequential');
  const [steps, setSteps] = useState([
    { type: 'user', userId: '', role: '', department: '', order: 1 }
  ]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Yeni Onay Akışı - Evrak Yönetim Sistemi';
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      setUsers(response.data.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Kullanıcılar yüklenirken bir hata oluştu');
    }
  };

  const handleAddStep = () => {
    setSteps([...steps, { 
      type: 'user', 
      userId: '', 
      role: '', 
      department: '', 
      order: steps.length + 1 
    }]);
  };

  const handleRemoveStep = (index) => {
    const newSteps = [...steps];
    newSteps.splice(index, 1);
    
    // Sıraları yeniden düzenle
    newSteps.forEach((step, idx) => {
      step.order = idx + 1;
    });
    
    setSteps(newSteps);
  };

  const handleStepChange = (index, field, value) => {
    const newSteps = [...steps];
    newSteps[index][field] = value;
    setSteps(newSteps);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        `${API_URL}/api/approval-flows`,
        {
          name,
          description,
          steps,
          isActive: true,
          flowType
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.status === 'success') {
        alert('Onay akışı başarıyla oluşturuldu');
        navigate('/admin/onay-akislari');
      } else {
        throw new Error('Onay akışı oluşturma başarısız');
      }
    } catch (error) {
      console.error('Error creating approval flow:', error);
      setError('Onay akışı oluşturulurken bir hata oluştu: ' + 
        (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Yeni Onay Akışı Oluştur</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
              Onay Akışı Adı
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="name"
              type="text"
              placeholder="Onay akışı adını giriniz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
              Açıklama
            </label>
            <textarea
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="description"
              placeholder="Onay akışı hakkında açıklama"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
            />
          </div>
          
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Onay Akışı Türü</h3>
            <select
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={flowType}
              onChange={(e) => setFlowType(e.target.value)}
              required
            >
              <option value="sequential">Sıralı (Sequential) - Adımlar sırayla onaylanır</option>
              <option value="quick">Hızlı (Quick) - İlk onay geldiğinde tüm akış tamamlanır</option>
            </select>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Onay Adımları</h3>
            
            {steps.map((step, index) => (
              <div key={index} className="border rounded p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">{index + 1}. Adım</h4>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Adımı Sil
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Adım Tipi
                    </label>
                    <select
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      value={step.type}
                      onChange={(e) => handleStepChange(index, 'type', e.target.value)}
                      required
                    >
                      <option value="">Seçiniz</option>
                      <option value="user">Belirli Kullanıcı</option>
                      <option value="role">Role Göre</option>
                      <option value="department">Departmana Göre</option>
                    </select>
                  </div>
                  
                  {step.type === 'user' && (
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Kullanıcı
                      </label>
                      <select
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        value={step.userId}
                        onChange={(e) => handleStepChange(index, 'userId', e.target.value)}
                        required
                      >
                        <option value="">Kullanıcı seçiniz</option>
                        {users.map(user => (
                          <option key={user._id} value={user._id}>
                            {user.firstName} {user.lastName} ({user.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {step.type === 'role' && (
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Rol
                      </label>
                      <select
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        value={step.role}
                        onChange={(e) => handleStepChange(index, 'role', e.target.value)}
                        required
                      >
                        <option value="">Rol seçiniz</option>
                        <option value="ADMIN">Yönetici (Admin)</option>
                        <option value="MANAGER">Müdür (Manager)</option>
                        <option value="OFFICER">Uzman (Officer)</option>
                      </select>
                    </div>
                  )}
                  
                  {step.type === 'department' && (
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Departman
                      </label>
                      <select
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        value={step.department}
                        onChange={(e) => handleStepChange(index, 'department', e.target.value)}
                        required
                      >
                        <option value="">Departman seçiniz</option>
                        <option value="IT">Bilgi Teknolojileri</option>
                        <option value="HR">İnsan Kaynakları</option>
                        <option value="FINANCE">Finans</option>
                        <option value="MARKETING">Pazarlama</option>
                        <option value="SALES">Satış</option>
                        <option value="OPERATIONS">Operasyon</option>
                        <option value="LEGAL">Hukuk</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={handleAddStep}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              + Adım Ekle
            </button>
          </div>
          
          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={() => navigate('/admin/onay-akislari')}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              İptal
            </button>
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              disabled={loading}
            >
              {loading ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateApprovalFlow; 