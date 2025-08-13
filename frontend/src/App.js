import React, { useEffect, useRef } from 'react';
import { useRoutes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import routes from './routes';
import { useAuth } from './hooks/useAuth';

function App() {
  const content = useRoutes(routes);
  const { checkAuth, refreshUserInfo, isAuthenticated, user } = useAuth();
  const refreshIntervalRef = useRef(null);
  const visibilityHandlerRef = useRef(null);
  
  // Uygulama başlangıcında kimlik doğrulama kontrolü - sadece bir kez çalışsın
  useEffect(() => {
    checkAuth();
  }, []); // checkAuth'ı bağımlılık dizisinden çıkardık
  
  // Periyodik olarak kullanıcı bilgilerini yenile
  useEffect(() => {
    // Eğer kullanıcı giriş yapmışsa, periyodik yenileme başlat
    if (isAuthenticated && user) {
      console.log('Periyodik kullanıcı bilgisi yenileme başlatılıyor...');
      
      // Önceki interval'i temizle
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      
      // Görünürlük değişikliğinde kullanıcı bilgilerini yenileme fonksiyonu
      const handleVisibilityChange = async () => {
        // Sayfa görünür olduğunda ve son yenilemeden belirli bir süre geçtiyse bilgileri yenile
        if (document.visibilityState === 'visible') {
          try {
            // Son başarısız API isteğinden bu yana yeterli zaman geçti mi kontrol et
            const lastFailedApiCall = localStorage.getItem('lastFailedUserRefresh');
            const cooldownPeriod = 120000; // 2 dakika (daha uzun cooldown)
            
            if (lastFailedApiCall) {
              const timeSinceLastFailure = Date.now() - parseInt(lastFailedApiCall);
              if (timeSinceLastFailure < cooldownPeriod) {
                console.warn(`App: Son başarısız kullanıcı bilgisi yenileme denemesinden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
                return; // Cooldown süresi dolmadan yeni istek yapma
              }
            }
            
            // Daha önceki başarılı çağrı zamanını kontrol et
            // Çok sık çağrı yapmayı engelle
            const lastSuccessfulRefresh = localStorage.getItem('lastSuccessfulRefresh');
            const minRefreshInterval = 300000; // 5 dakika
            
            if (lastSuccessfulRefresh) {
              const timeSinceLastSuccess = Date.now() - parseInt(lastSuccessfulRefresh);
              if (timeSinceLastSuccess < minRefreshInterval) {
                console.log(`App: Son başarılı kullanıcı bilgisi yenilemesinden bu yana sadece ${Math.round(timeSinceLastSuccess/1000)} saniye geçti, yeni istek yapılmıyor`);
                return; // Minimum süre geçmeden yeni istek yapma
              }
            }
            
            await refreshUserInfo();
          } catch (error) {
            console.error('Görünürlük değişikliğinde kullanıcı bilgisi yenileme hatası:', error);
            
            // Network hatası durumunda son başarısız deneme zamanını kaydet
            if (error.message === 'Network Error' || 
                error.code === 'ERR_NETWORK' || 
                error.code === 'ECONNABORTED' || 
                error.message?.includes('timeout') ||
                error.message?.includes('ERR_INSUFFICIENT_RESOURCES') ||
                error.name === 'AbortError' ||
                error.name === 'CanceledError' ||
                error.code === 'ERR_CANCELED') {
              localStorage.setItem('lastFailedUserRefresh', Date.now().toString());
            }
          }
        }
      };
      
      // Referansa fonksiyonu kaydet
      visibilityHandlerRef.current = handleVisibilityChange;
      
      // Yeni interval oluştur - 60 dakikada bir kullanıcı bilgilerini yenile
      const intervalHandler = async () => {
        try {
          // Son başarısız API isteğinden bu yana yeterli zaman geçti mi kontrol et
          const lastFailedApiCall = localStorage.getItem('lastFailedUserRefresh');
          const cooldownPeriod = 120000; // 2 dakika (daha uzun cooldown)
          
          if (lastFailedApiCall) {
            const timeSinceLastFailure = Date.now() - parseInt(lastFailedApiCall);
            if (timeSinceLastFailure < cooldownPeriod) {
              console.warn(`App: Son başarısız kullanıcı bilgisi yenileme denemesinden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
              return; // Cooldown süresi dolmadan yeni istek yapma
            }
          }
          
          // Daha önceki başarılı çağrı zamanını kontrol et
          // Çok sık çağrı yapmayı engelle
          const lastSuccessfulRefresh = localStorage.getItem('lastSuccessfulRefresh');
          const minRefreshInterval = 1800000; // 30 dakika
          
          if (lastSuccessfulRefresh) {
            const timeSinceLastSuccess = Date.now() - parseInt(lastSuccessfulRefresh);
            if (timeSinceLastSuccess < minRefreshInterval) {
              console.log(`App: Son başarılı kullanıcı bilgisi yenilemesinden bu yana sadece ${Math.round(timeSinceLastSuccess/1000)} saniye geçti, yeni istek yapılmıyor`);
              return; // Minimum süre geçmeden yeni istek yapma
            }
          }
          
          // refreshUserInfo artık hata fırlatmaz, null veya user döndürür
          await refreshUserInfo();
        } catch (error) {
          console.error('Periyodik kullanıcı bilgisi yenileme hatası:', error);
          
          // Network hatası durumunda son başarısız deneme zamanını kaydet
          if (error.message === 'Network Error' || 
              error.code === 'ERR_NETWORK' || 
              error.code === 'ECONNABORTED' || 
              error.message?.includes('timeout') ||
              error.message?.includes('ERR_INSUFFICIENT_RESOURCES') ||
              error.name === 'AbortError' ||
              error.name === 'CanceledError' ||
              error.code === 'ERR_CANCELED') {
            localStorage.setItem('lastFailedUserRefresh', Date.now().toString());
          }
        }
      };
      
      // Interval'i başlat
      refreshIntervalRef.current = setInterval(intervalHandler, 60 * 60 * 1000); // 60 dakika
      
      // Görünürlük değişikliği olayını dinle
      document.addEventListener('visibilitychange', visibilityHandlerRef.current);
      
      // Cleanup function
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
        
        if (visibilityHandlerRef.current) {
          document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
          visibilityHandlerRef.current = null;
        }
      };
    }
    
    // Kullanıcı oturum açmamışsa veya kullanıcı bilgisi yoksa interval'i temizle
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
        visibilityHandlerRef.current = null;
      }
    };
  }, [isAuthenticated, user]); // refreshUserInfo ve refreshInterval'i bağımlılık dizisinden çıkardık

  return (
    <>
      {content}
      <ToastContainer 
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  );
}

export default App;
