import React, { createContext, useState, useCallback } from 'react';
import { toast } from 'react-toastify';

// Initial state
const initialState = {
  notifications: []
};

// Context oluşturma
export const NotificationContext = createContext({
  ...initialState,
  showNotification: () => {},
  markAsRead: () => {},
  clearAll: () => {},
  getUnreadCount: () => 0,
  successToast: () => {},
  errorToast: () => {},
  infoToast: () => {},
  warningToast: () => {},
  confirmToast: () => Promise.resolve(false),
});

// Provider bileşeni
export const NotificationProvider = ({ children }) => {
  const [state, setState] = useState(initialState);

  // Yeni bildirim ekle
  const showNotification = useCallback((notification) => {
    const newNotification = {
      id: Date.now(),
      timestamp: new Date(),
      isRead: false,
      ...notification,
    };

    setState((prevState) => ({
      notifications: [newNotification, ...prevState.notifications]
    }));

    return newNotification;
  }, []);

  // Bildirimi okundu olarak işaretle
  const markAsRead = useCallback((id) => {
    setState((prevState) => ({
      notifications: prevState.notifications.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification
      ),
    }));
  }, []);

  // Tüm bildirimleri temizle
  const clearAll = useCallback(() => {
    setState({ notifications: [] });
  }, []);

  // Okunmamış bildirim sayısını getir
  const getUnreadCount = useCallback(() => {
    return state.notifications.filter((notification) => !notification.isRead).length;
  }, [state.notifications]);

  // Toast bildirimleri
  const successToast = useCallback((message, options = {}) => {
    toast.success(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    });
  }, []);

  const errorToast = useCallback((message, options = {}) => {
    toast.error(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    });
  }, []);

  const infoToast = useCallback((message, options = {}) => {
    toast.info(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    });
  }, []);

  const warningToast = useCallback((message, options = {}) => {
    toast.warning(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    });
  }, []);
  
  // Onay toast'u - promise döndürür
  const confirmToast = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      toast.info(
        <div>
          <div className="mb-2">{message}</div>
          <div className="flex justify-end space-x-2">
            <button
              className="px-3 py-1 bg-secondary-200 text-secondary-800 rounded"
              onClick={() => {
                toast.dismiss();
                resolve(false);
              }}
            >
              İptal
            </button>
            <button
              className="px-3 py-1 bg-primary-600 text-white rounded"
              onClick={() => {
                toast.dismiss();
                resolve(true);
              }}
            >
              Onay
            </button>
          </div>
        </div>,
        {
          position: "top-center",
          autoClose: false,
          hideProgressBar: true,
          closeOnClick: false,
          pauseOnHover: true,
          draggable: false,
          closeButton: false,
          ...options
        }
      );
    });
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications: state.notifications,
        showNotification,
        markAsRead,
        clearAll,
        getUnreadCount,
        successToast,
        errorToast,
        infoToast,
        warningToast,
        confirmToast
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
