import React from 'react';
import { formatTimeAgo } from '../../utils/formatters';
import LogIcons from './LogIcons';

/**
 * Log özet dashboard bileşeni
 * 
 * @param {Object} props - Bileşen özellikleri
 * @param {Array} props.activities - Gösterilecek etkinlikler
 * @param {Function} props.onViewAllClick - Tüm logları görüntüle butonuna tıklandığında çalışacak fonksiyon
 * @returns {JSX.Element}
 */
const LogDashboard = ({ activities = [], onViewAllClick }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Başlık */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Son Etkinlikler
        </h2>
        <button 
          onClick={onViewAllClick}
          className="text-sm text-white hover:text-blue-100 flex items-center transition-colors"
        >
          Tüm Logları Görüntüle
          <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Etkinlik Listesi */}
      <div className="divide-y divide-gray-100">
        {activities.length === 0 ? (
          <div className="p-6 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500">Henüz etkinlik kaydı bulunmuyor</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <LogIcons category={activity.category || activity.action} />
                </div>
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.message}
                    </p>
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(activity.timestamp || activity.createdAt)}
                    </span>
                  </div>
                  {activity.user && (
                    <p className="mt-1 text-xs text-gray-500">
                      {activity.user}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Alt Bilgi */}
      {activities.length > 0 && (
        <div className="bg-gray-50 px-6 py-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">
              Son {activities.length} etkinlik gösteriliyor
            </span>
            <button 
              onClick={onViewAllClick}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Tümünü Görüntüle
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogDashboard;