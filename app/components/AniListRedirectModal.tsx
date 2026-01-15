import React, { useMemo, useState } from 'react';
import { XIcon, ChevronRight } from './Icons';

interface AniListRedirectModalProps {
  open: boolean;
  expectedRedirectUri: string;
  configuredRedirectUri?: string | null;
  reason?: 'missing' | 'mismatch' | 'confirm' | 'error' | null;
  onClose: () => void;
  onConfirm: () => void;
  onOpenSettings?: () => void;
}

const AniListRedirectModal: React.FC<AniListRedirectModalProps> = ({
  open,
  expectedRedirectUri,
  configuredRedirectUri,
  reason,
  onClose,
  onConfirm,
  onOpenSettings,
}) => {
  const [copied, setCopied] = useState(false);

  const title = useMemo(() => {
    if (reason === 'missing') return 'AniList redirect URL missing';
    if (reason === 'confirm') return 'Confirm AniList redirect URL';
    if (reason === 'error') return 'AniList login failed';
    return 'Update AniList redirect URL';
  }, [reason]);

  const description = useMemo(() => {
    if (reason === 'missing') {
      return 'ManVerse does not have a redirect URL saved. Add the one below in AniList and in Settings.';
    }
    if (reason === 'confirm') {
      return 'LAN hosting changed. Confirm you updated the redirect URL before trying to log in.';
    }
    if (reason === 'error') {
      return 'AniList rejected the redirect URL. Use the exact URL below in AniList and in ManVerse.';
    }
    return 'Your AniList redirect URL does not match the current hosting mode.';
  }, [reason]);

  const handleCopy = async () => {
    if (!expectedRedirectUri) return;
    try {
      await navigator.clipboard.writeText(expectedRedirectUri);
    } catch {
      const fallback = document.createElement('textarea');
      fallback.value = expectedRedirectUri;
      fallback.style.position = 'fixed';
      fallback.style.opacity = '0';
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand('copy');
      document.body.removeChild(fallback);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center px-4 py-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
              AniList login
            </p>
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          <p className="text-sm text-gray-300">{description}</p>

          <div className="rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Expected redirect URL
            </div>
            <div className="mt-2 text-sm text-white break-all">{expectedRedirectUri}</div>
            <button
              onClick={handleCopy}
              className="mt-2 text-xs font-semibold text-primary hover:text-white"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {configuredRedirectUri && (
            <div className="rounded-xl border border-white/10 bg-surfaceHighlight/20 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Configured in ManVerse
              </div>
              <div className="mt-2 text-xs text-gray-300 break-all">{configuredRedirectUri}</div>
            </div>
          )}

          <details className="rounded-xl border border-white/10 bg-surfaceHighlight/20 px-4 py-3 text-sm text-gray-300">
            <summary className="cursor-pointer text-sm font-semibold text-white">
              How to update AniList
            </summary>
            <ol className="mt-3 space-y-2 text-sm text-gray-300 list-decimal list-inside">
              <li>Open AniList developer settings and select your app.</li>
              <li>Replace the redirect URL with the value above.</li>
              <li>Open ManVerse Settings → AniList setup and save the same URL.</li>
            </ol>
            <a
              href="https://anilist.co/settings/developer"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-xs font-semibold text-primary hover:text-white"
            >
              Open AniList developer settings
              <ChevronRight className="w-3 h-3" />
            </a>
          </details>
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => onOpenSettings?.()}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition"
          >
            Open Settings
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-lg bg-primary text-black text-xs font-bold shadow-lg shadow-primary/30 hover:brightness-110 transition"
          >
            I updated it
          </button>
        </div>
      </div>
    </div>
  );
};

export default AniListRedirectModal;
