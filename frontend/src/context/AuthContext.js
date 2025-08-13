import React, { createContext, useReducer, useCallback, useEffect, useRef, useMemo } from 'react';
import jwtDecode from 'jwt-decode';
import authApi from '../api/auth';

// Initial state
const initialState = {
  isAuthenticated: false,
  isInitialized: false,
  user: null,
  token: null,
};

// Reducer işlemleri
const handlers = {
  INITIALIZE: (state, action) => {
    const { isAuthenticated, user, token } = action.payload;
    return {
      ...state,
      isAuthenticated,
      isInitialized: true,
      user,
      token,
    };
  },
  LOGIN: (state, action) => {
    const { user, token } = action.payload;
    return {
      ...state,
      isAuthenticated: true,
      user,
      token,
    };
  },
  LOGOUT: (state) => ({
    ...state,
    isAuthenticated: false,
    user: null,
    token: null,
  }),
  REGISTER: (state, action) => {
    const { user, token } = action.payload;
    return {
      ...state,
      isAuthenticated: true,
      user,
      token,
    };
  },
  UPDATE_PROFILE: (state, action) => {
    const { user } = action.payload;
    return {
      ...state,
      user: {
        ...state.user,
        ...user,
      },
    };
  },
  UPDATE_USER_INFO: (state, action) => {
    const { user } = action.payload;
    return {
      ...state,
      user: {
        ...state.user,
        ...user,
      },
    };
  },
};

const reducer = (state, action) => (
  handlers[action.type] ? handlers[action.type](state, action) : state
);

// Context oluşturma
export const AuthContext = createContext({
  ...initialState,
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  register: () => Promise.resolve(),
  updateProfile: () => Promise.resolve(),
  updateUserInContext: () => {},
  checkAuth: () => Promise.resolve(),
  refreshUserInfo: () => Promise.resolve(),
});

// Provider bileşeni
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  // Token yenileme zamanlayıcısı
  const refreshTimerRef = useRef(null);

  // Kullanıcı bilgilerini localStorage'a kaydet
  const saveUserToLocalStorage = useCallback((user) => {
    if (user) {
      // Kullanıcı bilgilerini localStorage'a kaydet
      localStorage.setItem('user', JSON.stringify(user));
      console.log('Kullanıcı bilgileri localStorage\'a kaydedildi:', user);
    } else {
      // Kullanıcı bilgilerini localStorage'dan sil
      localStorage.removeItem('user');
      console.log('Kullanıcı bilgileri localStorage\'dan silindi');
    }
  }, []);

  // Kullanıcı bilgilerini localStorage'dan yükle
  const loadUserFromLocalStorage = useCallback(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        console.log('Kullanıcı bilgileri localStorage\'dan yüklendi:', user);
        return user;
      } catch (error) {
        console.error('Kullanıcı bilgileri localStorage\'dan yüklenirken hata:', error);
        localStorage.removeItem('user');
        return null;
      }
    }
    return null;
  }, []);

  // Fonksiyonların önceden tanımlanması için referanslar oluşturalım
  // Bu, döngüsel bağımlılık sorununu çözer
  const refreshUserInfoRef = useRef(null);

  // Çıkış yapma fonksiyonu - önce tanımlanmalı
  const logoutImpl = useCallback(() => {
    // Oturum verilerini temizle
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    
    // Zamanlayıcıyı temizle
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    // Context'i güncelle
    dispatch({ type: 'LOGOUT' });
    
    // Sayfayı yenile
    window.location.href = '/giris';
  }, []);
  
  // Logout fonksiyonu - API çağrısı yapan versiyonu
  const logout = useCallback(async () => {
    try {
      // API'ye çıkış isteği gönder
      await authApi.logout();
    } catch (error) {
      console.error('Çıkış yapılırken hata oluştu:', error);
    } finally {
      // Hata olsa bile oturumu temizle
      logoutImpl();
    }
  }, [logoutImpl]);

  // Token ayarlama fonksiyonu
  const setSession = useCallback((token) => {
    if (token) {
      localStorage.setItem('accessToken', token);
      
      // Token süresini kontrol et ve yenileme zamanlayıcısını ayarla
      try {
        const decodedToken = jwtDecode(token);
        const expiresIn = decodedToken.exp * 1000 - Date.now(); // milisaniye cinsinden
        
        // Token süresinin dolmasına 5 dakikadan az kaldıysa uyarı logla
        if (expiresIn < 300000) { // 5 dakika = 300000 ms
          console.warn('Token süresi yakında dolacak:', Math.round(expiresIn / 1000), 'saniye kaldı');
        }
        
        // Token süresinin dolmasına 2 dakika kala yenileme işlemini başlat
        const refreshDelay = Math.max(expiresIn - 120000, 0); // 2 dakika önce, minimum 0
        
        // Önceki zamanlayıcıyı temizle
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
        }
        
        // Yeni zamanlayıcı ayarla
        if (refreshDelay > 0) {
          const timerId = setTimeout(() => {
            console.log('Token yenileme zamanı geldi, yenileniyor...');
            // refreshUserInfo yerine referansını kullan
            if (refreshUserInfoRef.current) {
              refreshUserInfoRef.current();
            }
          }, refreshDelay);
          
          refreshTimerRef.current = timerId;
        }
      } catch (error) {
        console.error('Token decode hatası:', error);
      }
    } else {
      localStorage.removeItem('accessToken');
      
      // Kullanıcı bilgilerini de sil
      saveUserToLocalStorage(null);
      
      // Zamanlayıcıyı temizle
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    }
  }, [saveUserToLocalStorage]);

  // Kullanıcı bilgilerini yenile
  const refreshUserInfo = useCallback(async (forceRefresh = false) => {
    let timeoutId = null;
    const controller = new AbortController();
    
    try {
      console.log('Kullanıcı bilgileri yenileniyor...');
      
      // Token kontrolü
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.warn('Token bulunamadı, kullanıcı bilgileri yenilenemiyor');
        return loadUserFromLocalStorage(); // localStorage'dan kullanıcı bilgilerini döndür
      }
      
      // Son başarısız istekten bu yana yeterli zaman geçti mi kontrol et
      const lastFailedAttempt = localStorage.getItem('lastFailedRefreshAttempt');
      const cooldownPeriod = 120000; // 2 dakika (daha uzun cooldown)
      
      // forceRefresh true ise cooldown kontrolünü atla
      if (lastFailedAttempt && !forceRefresh) {
        const timeSinceLastFailure = Date.now() - parseInt(lastFailedAttempt);
        if (timeSinceLastFailure < cooldownPeriod) {
          console.warn(`Son başarısız denemeden bu yana ${Math.round(timeSinceLastFailure/1000)} saniye geçti, ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} saniye daha beklenecek`);
          return loadUserFromLocalStorage(); // localStorage'dan kullanıcı bilgilerini döndür
        }
      }
      
      // Daha önceki başarılı çağrı zamanını kontrol et
      // Çok sık çağrı yapmayı engelle
      const lastSuccessfulRefresh = localStorage.getItem('lastSuccessfulRefresh');
      const minRefreshInterval = 300000; // 5 dakika
      
      // forceRefresh true ise minRefreshInterval kontrolünü atla
      if (lastSuccessfulRefresh && !forceRefresh) {
        const timeSinceLastSuccess = Date.now() - parseInt(lastSuccessfulRefresh);
        if (timeSinceLastSuccess < minRefreshInterval) {
          console.log(`Son başarılı kullanıcı bilgisi yenilemesinden bu yana sadece ${Math.round(timeSinceLastSuccess/1000)} saniye geçti, yeni istek yapılmıyor`);
          return loadUserFromLocalStorage(); // localStorage'dan kullanıcı bilgilerini döndür
        }
      }
      
      // Timeout ayarla - 8 saniye sonra iptal et
      timeoutId = setTimeout(() => {
        controller.abort();
      }, 8000);
      
      // Kullanıcı bilgilerini getir - artık hata fırlatmıyor, her zaman bir yanıt döndürüyor
      // getMe fonksiyonu kendi içinde AbortController kullanıyor, ancak burada da kullanıyoruz
      // çünkü getMe'nin kendi AbortController'ı çalışmayabilir
      const response = await authApi.getMe(forceRefresh);
      
      // Timeout'u temizle
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Yanıt durumunu kontrol et
      if (response.status === 'error' || response.status === 'cooldown') {
        console.warn('API yanıtı hata içeriyor:', response.message);
        return loadUserFromLocalStorage(); // localStorage'dan kullanıcı bilgilerini döndür
      }
      
      // Kullanıcı bilgileri kontrolü
      if (!response.data || !response.data.user) {
        console.warn('API yanıtı geçersiz format içeriyor, localStorage verisi kullanılacak');
        return loadUserFromLocalStorage(); // localStorage'dan kullanıcı bilgilerini döndür
      }
      
      const { user } = response.data;
      
      // Kullanıcı rolünü büyük harfe çevir (tutarlılık için)
      if (user && user.role) {
        user.role = user.role.toUpperCase();
      }
      
      console.log('Kullanıcı bilgileri başarıyla yenilendi:', user);
      
      // Başarılı istek sonrası son başarısız deneme kaydını temizle
      localStorage.removeItem('lastFailedRefreshAttempt');
      
      // Başarılı çağrı zamanını kaydet
      localStorage.setItem('lastSuccessfulRefresh', Date.now().toString());
      
      // Kullanıcı bilgilerini localStorage'a kaydet
      saveUserToLocalStorage(user);
      
      // Context'i güncelle
      dispatch({
        type: 'UPDATE_USER_INFO',
        payload: { user }
      });
      
      return user;
    } catch (error) {
      // Timeout'u temizle (eğer hala aktifse)
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      console.error('Kullanıcı bilgilerini yenileme hatası:', error);
      
      // Network hatası durumunda son başarısız deneme zamanını kaydet
      if (error.message === 'Network Error' || 
          error.code === 'ERR_NETWORK' || 
          error.code === 'ECONNABORTED' || 
          error.message?.includes('timeout') ||
          error.message?.includes('ERR_INSUFFICIENT_RESOURCES') ||
          error.name === 'AbortError' ||
          error.name === 'CanceledError' ||
          error.code === 'ERR_CANCELED') {
        localStorage.setItem('lastFailedRefreshAttempt', Date.now().toString());
        console.warn('Network hatası nedeniyle kullanıcı bilgileri yenileme işlemi ertelendi');
      }
      
      // API hatası durumunda, token geçerli olabilir ancak kullanıcı bilgileri alınamadı
      if (error.response && error.response.status === 401) {
        // 401 hatası durumunda oturumu sonlandır
        console.warn('Oturum süresi dolmuş, çıkış yapılıyor...');
        logoutImpl(); // logout yerine logoutImpl kullan
        return null; // null döndür
      }
      
      // localStorage'dan mevcut kullanıcı bilgilerini al ve döndür
      return loadUserFromLocalStorage();
    }
  }, [dispatch, loadUserFromLocalStorage, saveUserToLocalStorage, logoutImpl]);

  // refreshUserInfo referansını güncelle
  useEffect(() => {
    refreshUserInfoRef.current = refreshUserInfo;
  }, [refreshUserInfo]);

  // Context üzerinden kullanıcı bilgilerini güncelleme fonksiyonu
  const updateUserInContext = useCallback((userData) => {
    // Kullanıcı bilgilerini localStorage'a kaydet
    saveUserToLocalStorage(userData);
    
    dispatch({
      type: 'UPDATE_USER_INFO',
      payload: { user: userData }
    });
  }, [saveUserToLocalStorage]);

  const login = useCallback(async (email, password) => {
    try {
      const response = await authApi.login(email, password);
      
      // Yanıt yapısını kontrol et - API yanıt yapısına göre düzeltildi
      if (!response || !response.data) {
        throw new Error('Sunucu yanıtı geçersiz');
      }
      
      // API yanıt yapısı: { data: { token, user, refreshToken } }
      const { token, user } = response.data;
      
      // Token ve kullanıcı bilgilerinin varlığını kontrol et
      if (!token) {
        throw new Error('Token bulunamadı');
      }
      
      if (!user) {
        throw new Error('Kullanıcı bilgileri bulunamadı');
      }
      
      // Kullanıcı rolünü büyük harfe çevir (tutarlılık için)
      if (user && user.role) {
        user.role = user.role.toUpperCase();
      }
      
      // Kullanıcı bilgilerini localStorage'a kaydet
      saveUserToLocalStorage(user);
      
      setSession(token);
      dispatch({
        type: 'LOGIN',
        payload: {
          user,
          token,
        },
      });

      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, [setSession, saveUserToLocalStorage]);

  const register = useCallback(async (userData) => {
    try {
      const response = await authApi.register(userData);
      const { token, user } = response.data;

      // Kullanıcı rolünü büyük harfe çevir (tutarlılık için)
      if (user && user.role) {
        user.role = user.role.toUpperCase();
      }

      // Kullanıcı bilgilerini localStorage'a kaydet
      saveUserToLocalStorage(user);

      setSession(token);
      dispatch({
        type: 'REGISTER',
        payload: {
          user,
          token,
        },
      });

      return response;
    } catch (error) {
      throw error;
    }
  }, [setSession, saveUserToLocalStorage]);

  const updateProfile = useCallback(async (userData) => {
    try {
      const response = await authApi.updateProfile(userData);
      const { user } = response.data;

      // Kullanıcı rolünü büyük harfe çevir (tutarlılık için)
      if (user && user.role) {
        user.role = user.role.toUpperCase();
      }

      // Kullanıcı bilgilerini localStorage'a kaydet
      saveUserToLocalStorage(user);

      dispatch({
        type: 'UPDATE_PROFILE',
        payload: {
          user,
        },
      });

      return response;
    } catch (error) {
      throw error;
    }
  }, [saveUserToLocalStorage]);

  const checkAuth = useCallback(async () => {
    try {
      // Başlangıçta token kontrolü
      const token = localStorage.getItem('accessToken');
      
      // Token yoksa direkt olarak çıkış yap
      if (!token) {
        console.log('Token bulunamadı, oturum açılmamış.');
        dispatch({ 
          type: 'INITIALIZE',
          payload: {
            isAuthenticated: false,
            user: null,
            token: null,
          },
        });
        return;
      }
      
      try {
        // Token'ı decode et ve süresini kontrol et
        const decodedToken = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        
        // Token süresinin dolmasına 5 dakikadan az kaldıysa uyarı logla
        if (decodedToken.exp - currentTime < 300) {
          console.warn('Token süresi yakında dolacak:', Math.round(decodedToken.exp - currentTime), 'saniye kaldı');
        }
        
        // Token süresi dolmuşsa çıkış yap
        if (decodedToken.exp < currentTime) {
          console.error('Token süresi dolmuş');
          setSession(null);
          dispatch({ 
            type: 'INITIALIZE',
            payload: {
              isAuthenticated: false,
              user: null,
              token: null,
            },
          });
          return;
        }
        
        // Önce localStorage'dan kullanıcı bilgilerini yüklemeyi dene
        const localUser = loadUserFromLocalStorage();
        
        if (localUser) {
          console.log('Kullanıcı bilgileri localStorage\'dan yüklendi:', localUser);
          
          // Önce token'ı ayarla, sonra state'i güncelle
          setSession(token);
          
          dispatch({
            type: 'INITIALIZE',
            payload: {
              isAuthenticated: true,
              user: localUser,
              token,
            },
          });
          
          // Arka planda kullanıcı bilgilerini yenile
          setTimeout(() => {
            refreshUserInfo().catch(err => {
              console.error('Arka planda kullanıcı bilgilerini yenileme hatası:', err);
            });
          }, 0);
          
          return;
        }
        
        // LocalStorage'da kullanıcı bilgileri yoksa API'den getir
        try {
          console.log('Kullanıcı bilgileri alınıyor...');
          const response = await authApi.getMe();
          
          if (!response || !response.data || !response.data.data || !response.data.data.user) {
            throw new Error('Kullanıcı bilgileri alınamadı');
          }
          
          const { user } = response.data.data;
          
          // Kullanıcı rolünü büyük harfe çevir (tutarlılık için)
          if (user && user.role) {
            user.role = user.role.toUpperCase();
          }
          
          console.log('Kullanıcı bilgileri başarıyla alındı:', user);
          
          // Kullanıcı bilgilerini localStorage'a kaydet
          saveUserToLocalStorage(user);
          
          // Önce token'ı ayarla, sonra state'i güncelle
          setSession(token);
          
          dispatch({
            type: 'INITIALIZE',
            payload: {
              isAuthenticated: true,
              user,
              token,
            },
          });
        } catch (apiError) {
          console.error('Kullanıcı bilgileri alınırken hata:', apiError);
          
          // API hatası durumunda, token geçerli olabilir ancak kullanıcı bilgileri alınamadı
          if (apiError.response && apiError.response.status === 401) {
            // Sadece 401 hatası durumunda token'ı sil
            setSession(null);
            dispatch({ 
              type: 'INITIALIZE',
              payload: {
                isAuthenticated: false,
                user: null,
                token: null,
              },
            });
          } else {
            // Diğer API hataları için token'ı silme, sadece yeniden deneme yapılabilir
            // Bu sayede geçici ağ hataları durumunda kullanıcı oturumu korunur
            console.warn('API hatası nedeniyle kullanıcı bilgileri alınamadı, ancak token geçerli olabilir');
            
            // Token'dan kullanıcı bilgilerini çıkarmaya çalış
            try {
              const { userId, role, email, firstName, lastName } = decodedToken;
              const minimalUser = { 
                id: userId,
                role: role ? role.toUpperCase() : 'USER',
                email: email || 'kullanici@example.com',
                firstName: firstName || 'Kullanıcı',
                lastName: lastName || 'Adı',
              };
              
              console.log('Token içinden minimum kullanıcı bilgisi alındı:', minimalUser);
              
              // Kullanıcı bilgilerini localStorage'a kaydet
              saveUserToLocalStorage(minimalUser);
              
              // Minimum bilgiyle oturumu başlat
              dispatch({
                type: 'INITIALIZE',
                payload: {
                  isAuthenticated: true,
                  user: minimalUser,
                  token,
                },
              });
            } catch (tokenDataError) {
              console.error('Token içinden kullanıcı bilgisi alınamadı:', tokenDataError);
              dispatch({ 
                type: 'INITIALIZE',
                payload: {
                  isAuthenticated: true,  // Token geçerli olduğu için true
                  user: null,
                  token,
                },
              });
            }
          }
        }
      } catch (tokenError) {
        // Token decode hatası - token geçersiz
        console.error('Token decode hatası:', tokenError);
        setSession(null);
        dispatch({ 
          type: 'INITIALIZE',
          payload: {
            isAuthenticated: false,
            user: null,
            token: null,
          },
        });
      }
    } catch (error) {
      console.error('Auth check genel hata:', error);
      dispatch({ 
        type: 'INITIALIZE',
        payload: {
          isAuthenticated: false,
          user: null,
          token: null,
        },
      });
    }
  }, [setSession, refreshUserInfo, saveUserToLocalStorage, loadUserFromLocalStorage]);

  // Periyodik kullanıcı bilgisi yenileme (her 15 dakikada bir)
  const intervalIdRef = useRef(null);
  
  useEffect(() => {
    if (state.isAuthenticated && state.user) {
      // Önceki interval'i temizle
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
      
      // Her 15 dakikada bir kullanıcı bilgilerini yenile
      intervalIdRef.current = setInterval(() => {
        refreshUserInfo().catch(err => {
          console.error('Periyodik kullanıcı bilgisi yenileme hatası:', err);
        });
      }, 15 * 60 * 1000); // 15 dakika
    }
    
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [state.isAuthenticated, state.user]);

  // Uygulama başlangıcında kimlik doğrulama kontrolü - sadece bir kez çalışsın
  useEffect(() => {
    checkAuth();
  }, []); // checkAuth'ı bağımlılık dizisinden çıkardık

  // Zamanlayıcıyı temizle (component unmount olduğunda)
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // Memoize edilmiş context değeri
  const contextValue = useMemo(() => ({
    ...state,
    login,
    logout,
    register,
    updateProfile,
    updateUserInContext,
    checkAuth,
    refreshUserInfo,
  }), [
    state,
    login,
    logout,
    register,
    updateProfile,
    updateUserInContext,
    checkAuth,
    refreshUserInfo
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
