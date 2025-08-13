import * as Yup from 'yup';
import { FORM_ERROR_MESSAGES } from './constants';

// Ortak doğrulama şemaları
const email = Yup.string()
  .email(FORM_ERROR_MESSAGES.EMAIL_INVALID)
  .required(FORM_ERROR_MESSAGES.REQUIRED);

const password = Yup.string()
  .min(6, FORM_ERROR_MESSAGES.PASSWORD_MIN_LENGTH)
  .required(FORM_ERROR_MESSAGES.REQUIRED);

const confirmPassword = Yup.string()
  .oneOf([Yup.ref('password')], FORM_ERROR_MESSAGES.PASSWORD_MATCH)
  .required(FORM_ERROR_MESSAGES.REQUIRED);

const firstName = Yup.string()
  .min(2, 'Ad en az 2 karakter olmalıdır')
  .max(50, 'Ad en fazla 50 karakter olabilir')
  .required(FORM_ERROR_MESSAGES.REQUIRED);

const lastName = Yup.string()
  .min(2, 'Soyad en az 2 karakter olmalıdır')
  .max(50, 'Soyad en fazla 50 karakter olabilir')
  .required(FORM_ERROR_MESSAGES.REQUIRED);

const phoneNumber = Yup.string()
  .matches(
    /^(\+90|0)?[0-9]{10}$/,
    'Geçerli bir telefon numarası giriniz (5XX XXX XX XX)'
  );

// Giriş formu doğrulama şeması
export const loginSchema = Yup.object().shape({
  email,
  password: Yup.string().required(FORM_ERROR_MESSAGES.REQUIRED),
  rememberMe: Yup.boolean(),
});

// Kayıt formu doğrulama şeması
export const registerSchema = Yup.object().shape({
  firstName,
  lastName,
  email,
  password,
  confirmPassword,
  department: Yup.string().required(FORM_ERROR_MESSAGES.REQUIRED),
  position: Yup.string().required(FORM_ERROR_MESSAGES.REQUIRED),
  termsAccepted: Yup.boolean()
    .oneOf([true], 'Koşulları kabul etmelisiniz')
    .required(FORM_ERROR_MESSAGES.REQUIRED),
});

// Şifre sıfırlama doğrulama şeması
export const resetPasswordSchema = Yup.object().shape({
  password,
  confirmPassword,
});

// Şifremi unuttum doğrulama şeması
export const forgotPasswordSchema = Yup.object().shape({
  email,
});

// Kullanıcı profil güncelleme doğrulama şeması
export const profileUpdateSchema = Yup.object().shape({
  firstName,
  lastName,
  email,
  department: Yup.string().required(FORM_ERROR_MESSAGES.REQUIRED),
  position: Yup.string().required(FORM_ERROR_MESSAGES.REQUIRED),
  phone: phoneNumber,
  address: Yup.string().max(255, 'Adres en fazla 255 karakter olabilir'),
});

// Şifre değiştirme doğrulama şeması
export const changePasswordSchema = Yup.object().shape({
  currentPassword: Yup.string().required(FORM_ERROR_MESSAGES.REQUIRED),
  newPassword: password,
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], FORM_ERROR_MESSAGES.PASSWORD_MATCH)
    .required(FORM_ERROR_MESSAGES.REQUIRED),
});

// Belge oluşturma doğrulama şeması
export const documentSchema = Yup.object().shape({
  title: Yup.string()
    .min(2, 'Başlık en az 2 karakter olmalıdır')
    .max(100, 'Başlık en fazla 100 karakter olabilir')
    .required(FORM_ERROR_MESSAGES.REQUIRED),
  description: Yup.string()
    .max(500, 'Açıklama en fazla 500 karakter olabilir'),
  content: Yup.string()
    .required(FORM_ERROR_MESSAGES.REQUIRED),
  documentType: Yup.string()
    .required(FORM_ERROR_MESSAGES.REQUIRED),
  tags: Yup.array()
    .of(Yup.string()),
  expirationDate: Yup.date()
    .min(new Date(), 'Son kullanma tarihi bugünden sonra olmalıdır')
    .nullable(),
  attachments: Yup.array()
    .of(
      Yup.object().shape({
        file: Yup.mixed().required('Dosya gereklidir'),
        name: Yup.string().required('Dosya adı gereklidir'),
      })
    ),
});

// Onay akışı doğrulama şeması
export const approvalFlowSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Akış adı en az 2 karakter olmalıdır')
    .max(100, 'Akış adı en fazla 100 karakter olabilir')
    .required(FORM_ERROR_MESSAGES.REQUIRED),
  description: Yup.string()
    .max(255, 'Açıklama en fazla 255 karakter olabilir'),
  type: Yup.string()
    .oneOf(['SEQUENTIAL'], 'Geçerli bir akış tipi seçin')
    .required(FORM_ERROR_MESSAGES.REQUIRED),
  steps: Yup.array()
    .of(
      Yup.object().shape({
        userId: Yup.string().required('Her adım için bir kullanıcı seçilmelidir'),
        order: Yup.number().required('Adım sırası gereklidir'),
      })
    )
    .min(1, 'En az bir onay adımı olmalıdır')
    .required(FORM_ERROR_MESSAGES.REQUIRED),
});
