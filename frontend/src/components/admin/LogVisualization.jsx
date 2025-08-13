import React, { useState, useEffect } from 'react';

/**
 * Log görselleştirme ve istatistik bileşeni
 * 
 * @param {Object} props - Bileşen özellikleri
 * @param {Array} props.logs - Görselleştirilecek log kayıtları
 * @returns {JSX.Element}
 */
const LogVisualization = ({ logs = [] }) => {
  // İstatistik durumları
  const [stats, setStats] = useState({
    totalLogs: 0,
    byLevel: {},
    byModule: {},
    byCategory: {},
    byDay: {},
    topUsers: []
  });

  // Logları işleyerek istatistikleri hesapla
  useEffect(() => {
    if (!logs || logs.length === 0) {
      setStats({
        totalLogs: 0,
        byLevel: {},
        byModule: {},
        byCategory: {},
        byDay: {},
        topUsers: []
      });
      return;
    }

    // Log sayısı
    const totalLogs = logs.length;

    // Seviyeye göre dağılım
    const byLevel = logs.reduce((acc, log) => {
      const level = log.level || 'unknown';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});

    // Modüle göre dağılım
    const byModule = logs.reduce((acc, log) => {
      const module = log.module || 'unknown';
      acc[module] = (acc[module] || 0) + 1;
      return acc;
    }, {});

    // Kategoriye göre dağılım
    const byCategory = logs.reduce((acc, log) => {
      const category = log.category || 'unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    // Güne göre dağılım
    const byDay = logs.reduce((acc, log) => {
      const date = new Date(log.timestamp || log.createdAt);
      const day = date.toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});

    // En çok log üreten kullanıcılar
    const userCounts = logs.reduce((acc, log) => {
      if (log.userId && log.userName) {
        const userKey = `${log.userId}`;
        if (!acc[userKey]) {
          acc[userKey] = {
            userId: log.userId,
            userName: log.userName,
            count: 0
          };
        }
        acc[userKey].count += 1;
      }
      return acc;
    }, {});

    const topUsers = Object.values(userCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setStats({
      totalLogs,
      byLevel,
      byModule,
      byCategory,
      byDay,
      topUsers
    });
  }, [logs]);

  // Seviye renklerini belirle
  const getLevelColor = (level) => {
    const colors = {
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500',
      debug: 'bg-gray-500',
      critical: 'bg-purple-500'
    };
    return colors[level] || 'bg-gray-300';
  };

  // Modül renklerini belirle
  const getModuleColor = (module) => {
    const colors = {
      auth: 'bg-blue-500',
      user: 'bg-indigo-500',
      document: 'bg-green-500',
      approval: 'bg-purple-500',
      system: 'bg-gray-500',
      file: 'bg-cyan-500',
      audit: 'bg-teal-500',
      search: 'bg-amber-500'
    };
    return colors[module] || 'bg-gray-300';
  };

  // Yüzde hesapla
  const calculatePercentage = (value, total) => {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  };

  // Son 7 gün için tarih etiketleri oluştur
  const getLastSevenDays = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const formattedDate = date.toISOString().split('T')[0];
      days.push(formattedDate);
    }
    return days;
  };

  // Son 7 günün log sayılarını al
  const getLastSevenDaysData = () => {
    const days = getLastSevenDays();
    return days.map(day => stats.byDay[day] || 0);
  };

  // Tarih formatını daha okunabilir hale getir
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Log İstatistikleri</h2>

      {/* Toplam Log Sayısı */}
      <div className="mb-6 text-center">
        <div className="text-3xl font-bold text-gray-700">{stats.totalLogs}</div>
        <div className="text-sm text-gray-500">Toplam Log Kaydı</div>
      </div>

      {/* Log Seviyesi Dağılımı */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Log Seviyesi Dağılımı</h3>
        <div className="space-y-2">
          {Object.entries(stats.byLevel).map(([level, count]) => (
            <div key={level} className="flex items-center">
              <div className="w-24 text-xs text-gray-600">{level.charAt(0).toUpperCase() + level.slice(1)}</div>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getLevelColor(level)}`} 
                  style={{ width: `${calculatePercentage(count, stats.totalLogs)}%` }}
                ></div>
              </div>
              <div className="w-16 text-right text-xs text-gray-600 ml-2">
                {count} ({calculatePercentage(count, stats.totalLogs)}%)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modül Dağılımı */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Modül Dağılımı</h3>
        <div className="space-y-2">
          {Object.entries(stats.byModule).map(([module, count]) => (
            <div key={module} className="flex items-center">
              <div className="w-24 text-xs text-gray-600">{module.charAt(0).toUpperCase() + module.slice(1)}</div>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getModuleColor(module)}`} 
                  style={{ width: `${calculatePercentage(count, stats.totalLogs)}%` }}
                ></div>
              </div>
              <div className="w-16 text-right text-xs text-gray-600 ml-2">
                {count} ({calculatePercentage(count, stats.totalLogs)}%)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Günlük Log Aktivitesi */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Günlük Log Aktivitesi</h3>
        <div className="h-40 flex items-end space-x-1">
          {getLastSevenDays().map((day, index) => {
            const count = stats.byDay[day] || 0;
            const maxValue = Math.max(...Object.values(stats.byDay), 1);
            const height = count ? Math.max((count / maxValue) * 100, 10) : 5;
            
            return (
              <div key={day} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-blue-500 rounded-t"
                  style={{ height: `${height}%` }}
                ></div>
                <div className="text-xs text-gray-500 mt-1 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                  {formatDate(day)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* En Aktif Kullanıcılar */}
      {stats.topUsers.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">En Aktif Kullanıcılar</h3>
          <div className="space-y-2">
            {stats.topUsers.map((user) => (
              <div key={user.userId} className="flex items-center">
                <div className="w-32 truncate text-xs text-gray-600">{user.userName}</div>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500" 
                    style={{ width: `${calculatePercentage(user.count, stats.totalLogs)}%` }}
                  ></div>
                </div>
                <div className="w-12 text-right text-xs text-gray-600 ml-2">
                  {user.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LogVisualization;