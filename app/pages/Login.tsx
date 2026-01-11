import React, { useState } from 'react';
import { Providers, providerShortLabel } from '../lib/providers';
import { anilistApi } from '../lib/anilist';
import { ChevronRight, StarIcon } from '../components/Icons';
import AniListSetupModal from '../components/AniListSetupModal';

interface LoginProps {
  onLoginSuccess?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [showSetup, setShowSetup] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLoginClick = async () => {
    setLoginError(null);
    try {
      const authUrl = await anilistApi.getLoginUrl();
      window.location.href = authUrl;
    } catch (error) {
      setLoginError('AniList is not configured yet. Follow the setup guide to continue.');
      setShowSetup(true);
    }
  };
  
  const handleDemoClick = () => {
    anilistApi.setToken('DEMO_MODE_TOKEN');
    if (onLoginSuccess) {
       onLoginSuccess();
    } else {
       // Fallback
       window.location.reload();
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center relative overflow-hidden bg-background">
      
      {/* Abstract Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-primary/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

      <div className="relative z-10 w-full max-w-4xl px-6 flex flex-col md:flex-row items-center gap-12 md:gap-20">
        
        {/* Text Content */}
        <div className="flex-1 text-center md:text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surfaceHighlight border border-white/10 text-xs font-medium text-primary">
            <StarIcon className="w-3 h-3" fill />
            <span>Official AniList Integration</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight">
            Your Manga. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">
              Everywhere.
            </span>
          </h1>
          
          <p className="text-lg text-gray-400 max-w-lg mx-auto md:mx-0 leading-relaxed">
            Connect your account to automatically track your reading progress, sync your library, and discover new series tailored to your taste.
          </p>

          <div className="flex flex-col gap-4 justify-center md:justify-start pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button 
                onClick={handleLoginClick}
                className="flex items-center gap-3 pl-6 pr-8 py-3.5 bg-[#02A9FF] hover:bg-[#0297e6] text-white font-semibold text-sm tracking-wide rounded-full shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95"
              >
                {/* AniList Logo SVG */}
                <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6.361 2.943 0 21.056h4.942l1.077-3.133H11.4l1.052 3.133H22.9c.766 0 1.432-.658 1.432-1.432V6.169a3.09 3.09 0 0 0-3.232-2.973c-4.493-.057-9.576-.233-14.739-.253zm3.12 4.197h2.17l2.802 8.277h-7.79z"/>
                </svg>
                <span>Continue with AniList</span>
                <ChevronRight className="w-4 h-4 opacity-70 -mr-1" />
              </button>
              
              <button 
                onClick={handleDemoClick}
                className="flex items-center gap-3 px-8 py-3.5 bg-surfaceHighlight hover:bg-white/10 border border-white/10 text-white font-semibold text-sm tracking-wide rounded-full transition-all hover:scale-[1.02] active:scale-95"
              >
                <span>Try Demo Account</span>
              </button>
            </div>

            {loginError && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                {loginError}
              </div>
            )}

            <button
              onClick={() => setShowSetup(true)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              AniList setup guide
              <ChevronRight className="w-3 h-3" />
            </button>
            
            <p className="text-xs text-gray-500 max-w-[400px] leading-snug text-center sm:text-left">
              The demo account lets you test the dashboard and library features without logging in.
            </p>
          </div>
        </div>

        {/* Visual Feature List */}
        <div className="flex-1 w-full max-w-md hidden md:block">
          <div className="bg-surface/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
             <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 border border-green-500/20">
                  ⚡
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Auto-Tracking</h3>
                  <p className="text-sm text-gray-400 mt-1">Never lose your place. Chapters are marked as read automatically as you scroll.</p>
                </div>
             </div>
             
             <div className="w-full h-px bg-white/5" />

             <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  📚
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Unified Library</h3>
                  <p className="text-sm text-gray-400 mt-1">Access your "Reading", "Planning", and "Completed" lists directly from the dashboard.</p>
                </div>
             </div>

             <div className="w-full h-px bg-white/5" />

             <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                  🔍
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Smart Discovery</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Find new series on {providerShortLabel(Providers.AsuraScans)} or AniList instantly with one search bar.
                  </p>
                </div>
             </div>
          </div>
        </div>

      </div>

      <AniListSetupModal open={showSetup} onClose={() => setShowSetup(false)} />
    </div>
  );
};

export default Login;
