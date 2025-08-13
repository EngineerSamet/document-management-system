import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardActivities } from '../../api/activities';
import { formatTimeAgo } from '../../utils/formatters';

/**
 * Son etkinlikler widget'ı
 * Dashboard için son kullanıcı etkinliklerini gösterir
 */
const RecentActivities = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const data = await getDashboardActivities();
      setActivities(data);
      setError(null);
    } catch (err) {
      console.error('Etkinlik verileri alınamadı:', err);
      setError('Etkinlik verileri yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Etkinlik tipine göre ikon belirle
  const getActivityIcon = (activity) => {
    const { entityType, action } = activity;

    // Kullanıcı işlemleri
    if (entityType === 'user') {
      if (action === 'create') {
        return (
          <div className="bg-green-100 p-2 rounded-full">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
        );
      }
      return (
        <div className="bg-blue-100 p-2 rounded-full">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      );
    }

    // Belge işlemleri
    if (entityType === 'document') {
      if (action === 'create') {
        return (
          <div className="bg-indigo-100 p-2 rounded-full">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        );
      }
      if (action === 'approve') {
        return (
          <div className="bg-green-100 p-2 rounded-full">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      }
      if (action === 'reject') {
        return (
          <div className="bg-red-100 p-2 rounded-full">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      }
      return (
        <div className="bg-gray-100 p-2 rounded-full">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      );
    }

    // Onay akışı işlemleri
    if (entityType === 'approvalFlow') {
      return (
        <div className="bg-purple-100 p-2 rounded-full">
          <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
      );
    }

    // Varsayılan ikon
    return (
      <div className="bg-gray-100 p-2 rounded-full">
        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Son Etkinlikler</h2>
        <Link to="/admin/sistem-loglari" className="text-sm text-primary-600 hover:text-primary-800 flex items-center">
          Tüm Logları Görüntüle
          <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="w-8 h-8 border-t-4 border-b-4 border-primary-600 rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>Henüz etkinlik kaydı bulunmuyor</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity._id} className="flex items-start">
              {getActivityIcon(activity)}
              <div className="ml-3 flex-1">
                <p className="text-sm text-gray-800">{activity.friendlyMessage}</p>
                <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(activity.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentActivities; 