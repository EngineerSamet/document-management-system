import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import { useNotification } from '../../hooks/useNotification';

const VerifyEmail = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');

        if (!token) {
          setError('Doğrulama token\'ı bulunamadı');
          setLoading(false);
          return;
        }

        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/verify-email`, {
          params: { token }
        });

        setUserId(response.data.data.userId);
        setEmail(response.data.data.email);
        setLoading(false);
      } catch (error) {
        setError(
          error.response?.data?.message || 
          'Doğrulama işlemi sırasında bir hata oluştu'
        );
        setLoading(false);
      }
    };

    verifyToken();
  }, [location.search]);

  const validatePassword = () => {
    if (password.length < 6) {
      setPasswordError('Şifre en az 6 karakter olmalıdır');
      return false;
    }

    if (!/[A-Z]/.test(password)) {
      setPasswordError('Şifre en az bir büyük harf içermelidir');
      return false;
    }

    if (!/[a-z]/.test(password)) {
      setPasswordError('Şifre en az bir küçük harf içermelidir');
      return false;
    }

    if (!/\d/.test(password)) {
      setPasswordError('Şifre en az bir rakam içermelidir');
      return false;
    }

    if (password !== confirmPassword) {
      setPasswordError('Şifreler eşleşmiyor');
      return false;
    }

    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePassword()) {
      return;
    }

    try {
      setLoading(true);
      
      await axios.post(`${process.env.REACT_APP_API_URL}/api/users/set-password`, {
        userId,
        password
      });

      showNotification('Şifreniz başarıyla belirlendi. Giriş yapabilirsiniz.', 'success');
      navigate('/auth/login');
    } catch (error) {
      showNotification(
        error.response?.data?.message || 
        'Şifre belirleme işlemi sırasında bir hata oluştu',
        'error'
      );
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Doğrulama işlemi yapılıyor...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">
              <i className="fas fa-exclamation-circle"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Doğrulama Hatası</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => navigate('/auth/login')} className="w-full">
              Giriş Sayfasına Dön
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Şifre Belirleme</h2>
        <p className="text-gray-600 mb-6 text-center">
          Merhaba, hesabınızı doğrulamak için lütfen şifrenizi belirleyin.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <Input
              type="email"
              value={email}
              disabled
              label="E-posta"
              className="bg-gray-100"
            />
          </div>
          
          <div className="mb-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              label="Şifre"
              placeholder="Şifrenizi girin"
              required
            />
          </div>
          
          <div className="mb-6">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              label="Şifre Tekrar"
              placeholder="Şifrenizi tekrar girin"
              required
            />
            {passwordError && (
              <p className="text-red-500 text-sm mt-1">{passwordError}</p>
            )}
          </div>
          
          <div className="text-sm text-gray-600 mb-6">
            <p>Şifreniz:</p>
            <ul className="list-disc pl-5 mt-1">
              <li>En az 6 karakter uzunluğunda olmalıdır</li>
              <li>En az bir büyük harf içermelidir</li>
              <li>En az bir küçük harf içermelidir</li>
              <li>En az bir rakam içermelidir</li>
            </ul>
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'İşleniyor...' : 'Şifremi Belirle'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default VerifyEmail; 