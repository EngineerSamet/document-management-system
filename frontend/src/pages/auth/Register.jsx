import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import { registerSchema } from '../../utils/validation';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { errorToast, successToast } = useNotification();
  const [showPassword, setShowPassword] = useState(false);
  
  const handleRegister = async (values, { setSubmitting }) => {
    try {
      await register(values);
      successToast('Kayıt işlemi başarıyla tamamlandı!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Register error:', error);
      let errorMessage = 'Kayıt işlemi sırasında bir hata oluştu.';
      
      if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      }
      
      errorToast(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Hesap Oluştur</h1>
        <p className="text-gray-600">Evrak Yönetim Sistemine kayıt olun.</p>
      </div>
      
      <Formik
        initialValues={{
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: '',
          department: '',
          position: '',
          termsAccepted: false,
        }}
        validationSchema={registerSchema}
        onSubmit={handleRegister}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form>
            <div className="space-y-4">
              {/* İsim ve soyisim */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Field name="firstName">
                    {({ field }) => (
                      <Input
                        {...field}
                        label="Ad"
                        placeholder="Adınız"
                        error={touched.firstName && errors.firstName}
                        required
                      />
                    )}
                  </Field>
                </div>
                <div>
                  <Field name="lastName">
                    {({ field }) => (
                      <Input
                        {...field}
                        label="Soyad"
                        placeholder="Soyadınız"
                        error={touched.lastName && errors.lastName}
                        required
                      />
                    )}
                  </Field>
                </div>
              </div>
              
              {/* E-posta */}
              <div>
                <Field name="email">
                  {({ field }) => (
                    <Input
                      {...field}
                      type="email"
                      label="E-posta Adresi"
                      placeholder="ornek@sirket.com"
                      error={touched.email && errors.email}
                      required
                    />
                  )}
                </Field>
              </div>
              
              {/* Şifre */}
              <div>
                <Field name="password">
                  {({ field }) => (
                    <Input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      label="Şifre"
                      placeholder="********"
                      error={touched.password && errors.password}
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
                      required
                    />
                  )}
                </Field>
              </div>
              
              {/* Şifre Tekrarı */}
              <div>
                <Field name="confirmPassword">
                  {({ field }) => (
                    <Input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      label="Şifre Tekrarı"
                      placeholder="********"
                      error={touched.confirmPassword && errors.confirmPassword}
                      required
                    />
                  )}
                </Field>
              </div>
              
              {/* Departman ve Pozisyon */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Field name="department">
                    {({ field }) => (
                      <Input
                        {...field}
                        as="select"
                        label="Departman"
                        error={touched.department && errors.department}
                        required
                      >
                        <option value="">Seçiniz</option>
                        <option value="IT">Bilgi Teknolojileri</option>
                        <option value="HR">İnsan Kaynakları</option>
                        <option value="FINANCE">Finans</option>
                        <option value="MARKETING">Pazarlama</option>
                        <option value="OPERATIONS">Operasyon</option>
                      </Input>
                    )}
                  </Field>
                </div>
                <div>
                  <Field name="position">
                    {({ field }) => (
                      <Input
                        {...field}
                        label="Pozisyon"
                        placeholder="Pozisyonunuz"
                        error={touched.position && errors.position}
                        required
                      />
                    )}
                  </Field>
                </div>
              </div>
              
              {/* Kullanım Koşulları */}
              <div className="flex items-center">
                <Field
                  type="checkbox"
                  name="termsAccepted"
                  id="termsAccepted"
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="termsAccepted" className="ml-2 block text-sm text-gray-700">
                  <span>
                    <Link to="/kullanim-kosullari" className="text-primary-600 hover:text-primary-500">
                      Kullanım Koşulları
                    </Link>
                    'nı ve {' '}
                    <Link to="/gizlilik" className="text-primary-600 hover:text-primary-500">
                      Gizlilik Politikası
                    </Link>
                    'nı kabul ediyorum
                  </span>
                </label>
              </div>
              {touched.termsAccepted && errors.termsAccepted && (
                <p className="mt-1 text-sm text-danger-500">{errors.termsAccepted}</p>
              )}
              
              <Button
                type="submit"
                fullWidth
                loading={isSubmitting}
                className="mt-2"
                disabled={isSubmitting}
              >
                Kayıt Ol
              </Button>
            </div>
          </Form>
        )}
      </Formik>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Zaten hesabınız var mı?{' '}
          <Link to="/giris" className="font-medium text-primary-600 hover:text-primary-500">
            Giriş yapın
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register; 