import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { XIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon } from '../components/Icons';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  notify: (message: string, type?: NotificationType, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((message: string, type: NotificationType = 'info', duration: number = 4000) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-20 right-4 sm:right-6 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {notifications.map((notification) => (
          <div 
            key={notification.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl backdrop-blur-xl border animate-fade-in transition-all transform ${
                notification.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-200' :
                notification.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-200' :
                notification.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200' :
                'bg-blue-500/10 border-blue-500/20 text-blue-200'
            }`}
          >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
               {notification.type === 'success' && <CheckCircleIcon className="w-5 h-5 text-green-400" />}
               {notification.type === 'error' && <AlertCircleIcon className="w-5 h-5 text-red-400" />}
               {notification.type === 'warning' && <AlertCircleIcon className="w-5 h-5 text-yellow-400" />}
               {notification.type === 'info' && <InfoIcon className="w-5 h-5 text-blue-400" />}
            </div>

            {/* Content */}
            <div className="flex-1 text-sm font-medium leading-snug">
              {notification.message}
            </div>

            {/* Close */}
            <button 
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 text-white/40 hover:text-white transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
