import React, { useState } from 'react';
import { anilistApi } from '../lib/anilist';
import { XIcon } from './Icons';

const LoginBanner: React.FC = () => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-6 group">
      <div className="absolute inset-0 bg-surfaceHighlight/40 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative z-10 flex-1 text-center sm:text-left">
        <h3 className="text-lg font-bold text-white mb-1">Sync your library</h3>
        <p className="text-sm text-gray-400">
           Connect with AniList to track progress, organize your reading lists, and get personalized recommendations across devices.
        </p>
      </div>

      <div className="relative z-10 flex items-center gap-3">
         <button 
           onClick={async () => {
             try {
               const authUrl = await anilistApi.getLoginUrl();
               window.location.href = authUrl;
             } catch {
               const status = await anilistApi.getCredentialStatus();
               if (!status?.configured) {
                 alert('AniList is not configured yet. Open Settings → AniList setup.');
               } else {
                 alert('AniList login failed. Check your credentials and try again.');
               }
             }
           }}
           className="bg-[#02A9FF] hover:bg-[#0297e6] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-transform active:scale-95"
         >
           Connect AniList
         </button>
         <button 
           onClick={() => setVisible(false)}
           className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
         >
           <XIcon className="w-4 h-4" />
         </button>
      </div>
    </div>
  );
};

export default LoginBanner;
