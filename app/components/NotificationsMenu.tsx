import React, { useState, useEffect } from 'react';
import { anilistApi } from '../lib/anilist';
import { Notification } from '../types';

interface NotificationsMenuProps {
  onClose: () => void;
  user?: any;
}

const NotificationsMenu: React.FC<NotificationsMenuProps> = ({ onClose, user }) => {
  const [activeTab, setActiveTab] = useState<'app' | 'user'>('user');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock App Notifications
  const appNotifications: Notification[] = [
    {
      id: 999,
      type: 'APP_UPDATE',
      title: 'New Feature: Library',
      message: 'You can now view your entire AniList library in a dedicated dashboard.',
      time: '2 hours ago',
      read: false
    },
    {
      id: 998,
      type: 'APP_UPDATE',
      title: 'Welcome to ManVerse',
      message: 'Experience the new immersive reading mode.',
      time: '1 day ago',
      read: true
    }
  ];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (user) {
        const data = await anilistApi.getNotifications();
        // Transform AniList notifications to our simple type
        const mapped = data.map((n: any) => ({
          id: n.id,
          type: 'ANILIST_ACTIVITY',
          title: n.type === 'FOLLOWING' ? 'New Follower' : 'Activity',
          message: n.message || `${n.user.name} interacted with you.`,
          time: new Date(n.createdAt * 1000).toLocaleDateString(),
          read: true,
          image: n.user?.avatar?.medium
        }));
        setNotifications(mapped);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const displayList = activeTab === 'app' ? appNotifications : notifications;

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 mt-3 w-80 md:w-96 bg-surface border border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden ring-1 ring-black/50 animate-fade-in flex flex-col max-h-[500px]">
        
        {/* Header Tabs */}
        <div className="flex border-b border-white/10">
          <button 
            onClick={() => setActiveTab('user')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'user' ? 'bg-surfaceHighlight text-white border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}
          >
            Activity
          </button>
          <button 
            onClick={() => setActiveTab('app')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'app' ? 'bg-surfaceHighlight text-white border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}
          >
            System
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-2 space-y-1">
          {loading ? (
             <div className="py-8 text-center text-gray-500 text-sm">Loading...</div>
          ) : displayList.length > 0 ? (
            displayList.map(item => (
              <div key={item.id} className="p-3 rounded-xl hover:bg-white/5 transition-colors flex gap-3 items-start">
                 {/* Icon/Image */}
                 <div className="flex-shrink-0 mt-1">
                   {item.image ? (
                     <img src={item.image} className="w-8 h-8 rounded-full border border-white/10" alt="avatar" />
                   ) : (
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.type === 'APP_UPDATE' ? 'bg-primary/20 text-primary' : 'bg-gray-700'}`}>
                        {item.type === 'APP_UPDATE' ? '⚡' : '🔔'}
                     </div>
                   )}
                 </div>
                 
                 <div>
                   <h4 className="text-sm font-bold text-gray-200">{item.title}</h4>
                   <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.message}</p>
                   <span className="text-[10px] text-gray-600 mt-1 block">{item.time}</span>
                 </div>
              </div>
            ))
          ) : (
             <div className="py-12 text-center text-gray-500 flex flex-col items-center">
                <span className="text-2xl opacity-50 mb-2">🔕</span>
                <p className="text-sm">No notifications yet.</p>
                {!user && activeTab === 'user' && (
                  <p className="text-xs text-primary mt-2">Login to see activity.</p>
                )}
             </div>
          )}
        </div>
        
        <div className="p-2 border-t border-white/5 bg-surfaceHighlight/30 text-center">
           <button className="text-[10px] text-gray-400 hover:text-white uppercase tracking-wider font-bold">Mark all as read</button>
        </div>
      </div>
    </>
  );
};

export default NotificationsMenu;