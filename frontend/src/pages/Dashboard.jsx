import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import documentsApi from '../api/documents';
import Card from '../components/ui/Card';
import { formatDate, formatDocumentStatus } from '../utils/formatters';
import { DOCUMENT_STATUS, USER_ROLES } from '../utils/constants';

// StatCard component - follows Single Responsibility Principle
const StatCard = ({ title, value, icon, color, loading }) => (
  <Card className="overflow-hidden">
    <div className="p-5">
      <div className="flex items-center">
        <div className={`flex items-center justify-center h-12 w-12 rounded-md ${color}`}>
          {icon}
        </div>
        <div className="ml-5">
          <div className="mt-1 text-3xl font-semibold text-gray-900">
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              value
            )}
          </div>
          <div className="text-sm font-medium text-gray-500 truncate">{title}</div>
        </div>
      </div>
    </div>
  </Card>
);

// DashboardStatCard component - extends StatCard functionality (Open-Closed Principle)
const DashboardStatCard = ({ statType, stats, loading, role }) => {
  // Card configurations based on stat type
  const cardConfigs = {
    total: {
      title: role === USER_ROLES.ADMIN ? 'Toplam Belgeler' : 
             role === USER_ROLES.MANAGER ? 'Toplam Belgeler' : 'Belgelerim',
      value: stats.totalDocuments || 0,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'text-blue-600 bg-blue-100',
    },
    pending: {
      title: role === USER_ROLES.ADMIN ? 'Onay Bekleyen Belgeler' :
             role === USER_ROLES.MANAGER ? 'Onay Bekleyen Belgeler' : 'Onay Bekleyen Belgelerim',
      value: stats.pendingDocuments || 0,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-yellow-600 bg-yellow-100',
    },
    approved: {
      title: role === USER_ROLES.ADMIN ? 'Onaylanmış Belgeler' :
             role === USER_ROLES.MANAGER ? 'Onaylanmış Belgeler' : 'Onaylanmış Belgelerim',
      value: stats.approvedDocuments || 0,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      color: 'text-green-600 bg-green-100',
    },
    rejected: {
      title: role === USER_ROLES.ADMIN ? 'Reddedilmiş Belgeler' :
             role === USER_ROLES.MANAGER ? 'Reddedilmiş Belgeler' : 'Reddedilmiş Belgelerim',
      value: stats.rejectedDocuments || 0,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      color: 'text-red-600 bg-red-100',
    },
  };

  const config = cardConfigs[statType];
  if (!config) return null;

  return (
    <StatCard
      title={config.title}
      value={config.value}
      icon={config.icon}
      color={config.color}
      loading={loading}
    />
  );
};

// Dashboard component
const Dashboard = () => {
  const { user } = useAuth();
  const { errorToast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    userPendingApprovals: 0,
    recentDocuments: [],
    scope: 'user'
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Rol tabanlı dashboard istatistiklerini al
        const response = await documentsApi.getDashboardStats();
        
        if (response && response.data) {
          console.log('Dashboard istatistikleri:', response.data);
          setStats(response.data);
        } else {
          console.error('Dashboard verileri alınamadı:', response);
          errorToast('Dashboard verileri yüklenirken bir hata oluştu.');
        }
      } catch (error) {
        console.error('Dashboard data fetch error:', error);
        errorToast('Dashboard verileri yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [errorToast]);

  // Get dashboard stat types based on user role
  const getDashboardStatTypes = () => {
    const commonStats = ['total', 'pending', 'approved', 'rejected'];
    
    // Add pending approvals for all users
    const allStats = [...commonStats];
    
    // Add pending approvals card
    allStats.push('pendingApprovals');
    
    return allStats;
  };

  // Get scope text based on user role
  const getScopeText = () => {
    if (stats.scope === 'system') {
      return 'Tüm Sistem';
    } else if (stats.scope === 'department') {
      return `${user?.department || 'Departman'} Departmanı`;
    } else {
      return 'Kişisel Belgelerim';
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary-900">Dashboard</h1>
        <p className="text-secondary-500">
          Hoş geldiniz, {user?.firstName} {user?.lastName}! 
          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
            {getScopeText()}
          </span>
        </p>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {getDashboardStatTypes().map((statType) => (
          <DashboardStatCard
            key={statType}
            statType={statType}
            stats={stats}
            loading={loading}
            role={user?.role}
          />
        ))}
      </div>

      {/* Son Belgeler */}
      <div className="mt-6">
        <Card
          title="Son Belgeler"
          className="overflow-hidden"
          padding="none"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200">
              <thead className="bg-secondary-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Belge Adı
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Durum
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Oluşturulma Tarihi
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Oluşturan
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-secondary-200">
                {loading ? (
                  Array(3).fill(0).map((_, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : stats.recentDocuments && stats.recentDocuments.length > 0 ? (
                  stats.recentDocuments.map((document) => (
                    <tr key={document._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {document.title}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${document.status === DOCUMENT_STATUS.DRAFT ? 'bg-gray-100 text-gray-800' : 
                            document.status === DOCUMENT_STATUS.PENDING ? 'bg-yellow-100 text-yellow-800' :
                            document.status === DOCUMENT_STATUS.APPROVED ? 'bg-green-100 text-green-800' :
                            document.status === DOCUMENT_STATUS.REJECTED ? 'bg-red-100 text-red-800' : 
                            'bg-blue-100 text-blue-800'}
                        `}>
                          {formatDocumentStatus(document.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {formatDate(document.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {document.createdBy ? 
                          `${document.createdBy.firstName} ${document.createdBy.lastName}` : 
                          'Bilinmiyor'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-secondary-500">
                      Henüz belge bulunmuyor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;