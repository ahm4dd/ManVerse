import React from 'react';
import { XIcon } from './Icons';

interface RestartPromptModalProps {
  open: boolean;
  title: string;
  description: string;
  onRestart: () => void;
  onLater: () => void;
}

const RestartPromptModal: React.FC<RestartPromptModalProps> = ({
  open,
  title,
  description,
  onRestart,
  onLater,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onLater} />
      <div className="relative w-full max-w-lg bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">Restart required</p>
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <button
            onClick={onLater}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          <p className="text-sm text-gray-300">{description}</p>
          <div className="rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-xs text-gray-400">
            The app will relaunch and you can continue signing in right away.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={onLater}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 border border-white/10 transition"
          >
            Later
          </button>
          <button
            onClick={onRestart}
            className="px-5 py-2 rounded-lg bg-primary text-black text-xs font-bold shadow-lg shadow-primary/30 hover:brightness-110 transition"
          >
            Restart now
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestartPromptModal;
