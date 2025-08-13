import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import { loginSchema } from '../../utils/validation';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { errorToast, successToast } = useNotification();
  const [showPassword, setShowPassword] = useState(false);
  
  // URL'den gelen durum parametresini kontrol et
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionStatus = params.get('session');
    
    if (sessionStatus === 'expired') {
      errorToast('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
    }
  }, [location.search, errorToast]);
  
  const handleLogin = async (values, { setSubmitting, resetForm }) => {
    try {
      console.log('Login başlatılıyor:', { email: values.email });
      const response = await login(values.email, values.password);
      console.log('Login başarılı:', response);
      
      successToast('Başarıyla giriş yaptınız!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Login component hatası:', error);
      let errorMessage = 'Giriş yapılamadı. Lütfen tekrar deneyin.';
      
      // Özel hata mesajları
      if (error.message === 'Token bulunamadı' || error.message === 'Kullanıcı bilgileri bulunamadı') {
        errorMessage = 'Sunucu yanıtında eksik bilgi. Lütfen yönetici ile iletişime geçin.';
      } else if (error.serverMessage) {
        errorMessage = error.serverMessage;
      } else if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'E-posta veya şifre hatalı.';
        } else if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      
      errorToast(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-blue-700 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg">
            EYS
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Evrak Yönetim Sistemi</h1>
        <p className="text-gray-600 max-w-md text-center">
          Kurumunuzun evrak yönetim süreçlerini kolayca yönetin, dijital dönüşümü hızlandırın.
        </p>
      </div>
      
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-100">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Hoş Geldiniz</h2>
          <p className="text-gray-600">Hesabınıza giriş yapın</p>
        </div>
        
        <Formik
          initialValues={{ email: '', password: '', rememberMe: false }}
          validationSchema={loginSchema}
          onSubmit={handleLogin}
        >
          {({ errors, touched, isSubmitting }) => (
            <Form>
              <div className="space-y-5">
                <div>
                  <Field name="email">
                    {({ field }) => (
                      <Input
                        {...field}
                        type="email"
                        label="E-posta Adresi"
                        placeholder="ornek@sirket.com"
                        error={touched.email && errors.email}
                        leftIcon={
                          <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        }
                        className="rounded-lg"
                        required
                      />
                    )}
                  </Field>
                </div>
                
                <div>
                  <Field name="password">
                    {({ field }) => (
                      <Input
                        {...field}
                        type={showPassword ? 'text' : 'password'}
                        label="Şifre"
                        placeholder="********"
                        error={touched.password && errors.password}
                        leftIcon={
                          <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        }
                        rightIcon={
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-gray-500 focus:outline-none"
                          >
                            {showPassword ? (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            )}
                          </button>
                        }
                        className="rounded-lg"
                        required
                      />
                    )}
                  </Field>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Field 
                      type="checkbox" 
                      name="rememberMe" 
                      id="rememberMe" 
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                    />
                    <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                      Beni hatırla
                    </label>
                  </div>
                  
                  <div className="text-sm">
                    <Link to="/sifremi-unuttum" className="font-medium text-blue-600 hover:text-blue-500">
                      Şifremi unuttum
                    </Link>
                  </div>
                </div>
                
                <Button
                  type="submit"
                  fullWidth
                  loading={isSubmitting}
                  className="mt-6 bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-lg shadow-md transition-all duration-300 transform hover:scale-[1.02]"
                  disabled={isSubmitting}
                >
                  Giriş Yap
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
      
      <div className="mt-8 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} Evrak Yönetim Sistemi. Tüm hakları saklıdır.
      </div>
    </div>
  );
};

export default Login; 