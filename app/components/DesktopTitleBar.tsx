import React, { useEffect, useState } from 'react';
import { desktopApi } from '../lib/desktop';

const DesktopTitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!desktopApi.isAvailable) return;
    desktopApi.getWindowState?.().then((state) => {
      if (state) setIsMaximized(state.isMaximized);
    });
    const unsubscribe = desktopApi.onWindowState?.((state) => {
      setIsMaximized(state.isMaximized);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');

  if (!desktopApi.isAvailable || isMac) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[80] h-9 bg-[#0b0b0f] border-b border-white/5 flex items-center justify-between px-3"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 tracking-wide">
        <img
          src="/logo.png"
          alt="ManVerse"
          className="w-4 h-4 rounded-sm object-contain"
          style={{ WebkitAppRegion: 'no-drag' }}
        />
        <span>ManVerse</span>
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => desktopApi.minimizeWindow?.()}
          className="h-6 w-10 rounded-md text-gray-300 hover:bg-white/10 transition-colors flex items-center justify-center"
          aria-label="Minimize"
        >
          <span className="w-3.5 h-[2px] bg-current" />
        </button>
        <button
          onClick={() => desktopApi.toggleMaximize?.()}
          className="h-6 w-10 rounded-md text-gray-300 hover:bg-white/10 transition-colors flex items-center justify-center"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          <span
            className={`w-3.5 h-3.5 border border-current ${
              isMaximized ? 'translate-y-[1px] translate-x-[1px]' : ''
            }`}
          />
        </button>
        <button
          onClick={() => desktopApi.closeWindow?.()}
          className="h-6 w-10 rounded-md text-gray-300 hover:bg-red-500/80 hover:text-white transition-colors flex items-center justify-center"
          aria-label="Close"
        >
          <span className="text-[18px] font-semibold leading-none translate-y-[-1px]">×</span>
        </button>
      </div>
    </div>
  );
};

export default DesktopTitleBar;
