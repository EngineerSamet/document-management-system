import React from 'react';
import { Navigate } from 'react-router-dom';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';

// Auth Pages
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail'; // Email doğrulama sayfası

// Main Pages
import Dashboard from './pages/Dashboard';
import Documents from './pages/documents/Documents';
import DocumentDetail from './pages/documents/DocumentDetail';
import CreateDocument from './pages/documents/CreateDocument';
import PendingApprovals from './pages/documents/PendingApprovals';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

// Admin Pages
import ApprovalFlows from './pages/admin/ApprovalFlows';
import CreateApprovalFlow from './pages/admin/CreateApprovalFlow';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import CreateUser from './pages/admin/CreateUser';
import SystemLogs from './pages/admin/SystemLogs';

const routes = [
  {
    path: '/',
    element: <Navigate to="/dashboard" />
  },
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { path: 'giris', element: <Login /> },
      { path: 'sifremi-unuttum', element: <ForgotPassword /> },
      { path: 'sifre-sifirlama/:token', element: <ResetPassword /> }
    ]
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'belgeler', element: <Documents /> },
      { path: 'belge-olustur', element: <CreateDocument /> },
      { path: 'belgeler/:id', element: <DocumentDetail /> },
      { path: 'onay-bekleyenler', element: <PendingApprovals /> },
      { path: 'profil', element: <Profile /> },
      { path: 'admin', element: <AdminDashboard /> },
      { path: 'admin/kullanicilar', element: <UserManagement /> },
      { path: 'admin/kullanicilar/yeni', element: <CreateUser /> },
      { path: 'admin/onay-akislari', element: <ApprovalFlows /> },
      { path: 'admin/onay-akislari/yeni', element: <CreateApprovalFlow /> },
      { path: 'admin/sistem-loglari', element: <SystemLogs /> }
    ]
  },
  // Email doğrulama sayfası için yeni route
  {
    path: 'verify',
    element: <VerifyEmail />
  },
  {
    path: '*',
    element: <NotFound />
  }
];

export default routes;
