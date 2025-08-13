import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { useNotification } from '../../hooks/useNotification';
import { resetPassword, validateResetToken } from '../../api/auth';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const resetSchema = Yup.object().shape({
  password: Yup.string()
    .min(8, 'Şifre en az 8 karakter olmalıdır')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir'
    )
    .required('Şifre gerekli'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Şifreler eşleşmelidir')
    .required('Şifre tekrarı gerekli')
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { successToast, errorToast } = useNotification();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetCompleted, setResetCompleted] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const resetToken = queryParams.get('token');
    
    if (!resetToken) {
      errorToast('Geçersiz şifre sıfırlama bağlantısı');
      navigate('/sifremi-unuttum');
      return;
    }

    setToken(resetToken);
    
    // Token geçerliliğini kontrol et
    const verifyToken = async () => {
      try {
        await validateResetToken(resetToken);
        setTokenValid(true);
      } catch (error) {
        console.error('Invalid or expired token:', error);
        errorToast('Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş');
        navigate('/sifremi-unuttum');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [location, navigate, errorToast]);

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      await resetPassword(token, values.password);
      successToast('Şifreniz başarıyla sıfırlandı');
      setResetCompleted(true);
    } catch (error) {
      console.error('Reset password error:', error);
      let errorMessage = 'Şifre sıfırlama işlemi sırasında bir hata oluştu.';
      
      if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      }
      
      errorToast(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-t-4 border-b-4 border-primary-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Bağlantı doğrulanıyor...</p>
      </div>
    );
  }

  if (resetCompleted) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-success-50 p-4 rounded-lg border border-success-100 mb-6">
          <h3 className="font-semibold text-success-800 text-lg mb-2">Şifre Sıfırlama Tamamlandı!</h3>
          <p className="text-success-700 mb-4">
            Şifreniz başarıyla değiştirildi. Artık yeni şifrenizle giriş yapabilirsiniz.
          </p>
          <Button 
            onClick={() => navigate('/giris')}
            fullWidth
          >
            Giriş Sayfasına Git
          </Button>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return null; // useEffect içinde yönlendirme yapılacak
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Yeni Şifre Belirleyin</h1>
        <p className="text-gray-600">
          Lütfen yeni şifrenizi belirleyiniz.
        </p>
      </div>

      <Formik
        initialValues={{
          password: '',
          confirmPassword: ''
        }}
        validationSchema={resetSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form>
            <div className="space-y-4">
              {/* Şifre */}
              <div>
                <Field name="password">
                  {({ field }) => (
                    <Input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      label="Yeni Şifre"
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

              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-2">Şifreniz:</p>
                <ul className="text-xs text-gray-500 list-disc pl-5">
                  <li>En az 8 karakter uzunluğunda olmalıdır</li>
                  <li>En az bir büyük harf içermelidir</li>
                  <li>En az bir küçük harf içermelidir</li>
                  <li>En az bir rakam içermelidir</li>
                  <li>En az bir özel karakter içermelidir (@$!%*?&)</li>
                </ul>
              </div>

              <Button
                type="submit"
                fullWidth
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                Şifreyi Sıfırla
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default ResetPassword; 