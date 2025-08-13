import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { useNotification } from '../../hooks/useNotification';
import { forgotPassword } from '../../api/auth';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const forgotSchema = Yup.object().shape({
  email: Yup.string()
    .email('Geçerli bir e-posta adresi giriniz')
    .required('E-posta adresi gerekli')
});

const ForgotPassword = () => {
  const { successToast, errorToast } = useNotification();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      await forgotPassword(values.email);
      setSubmitted(true);
      successToast('Şifre sıfırlama linki e-posta adresinize gönderildi.');
    } catch (error) {
      console.error('Forgot password error:', error);
      let errorMessage = 'Şifre sıfırlama işlemi sırasında bir hata oluştu.';
      
      if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      }
      
      errorToast(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Şifremi Unuttum</h1>
        <p className="text-gray-600">
          Şifrenizi sıfırlamak için kayıtlı e-posta adresinizi giriniz.
        </p>
      </div>

      {submitted ? (
        <div className="bg-success-50 p-4 rounded-lg border border-success-100 mb-6">
          <h3 className="font-semibold text-success-800 text-lg mb-2">E-posta Gönderildi</h3>
          <p className="text-success-700">
            Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol ediniz.
          </p>
          <p className="mt-4 text-success-600 text-sm">
            E-postayı alamadıysanız, spam klasörünü kontrol edebilir veya bir dakika bekleyip tekrar deneyebilirsiniz.
          </p>
        </div>
      ) : (
        <Formik
          initialValues={{
            email: ''
          }}
          validationSchema={forgotSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, isSubmitting }) => (
            <Form>
              <div className="space-y-4">
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

                <Button
                  type="submit"
                  fullWidth
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  Şifre Sıfırlama Bağlantısı Gönder
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      )}

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Şifrenizi hatırladınız mı?{' '}
          <Link to="/giris" className="font-medium text-primary-600 hover:text-primary-500">
            Giriş yapın
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword; 