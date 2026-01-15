import React, { useEffect, useMemo, useState } from 'react';
import { XIcon } from './Icons';
import { normalizeRedirectUri, normalizeRedirectUriForCompare } from '../lib/anilist-redirect';

interface AniListRedirectModalProps {
  open: boolean;
  expectedRedirectUri: string;
  configuredRedirectUri?: string | null;
  reason?: 'missing' | 'mismatch' | 'confirm' | 'error' | null;
  onClose: () => void;
  onConfirm: () => void;
  onOpenSettings?: () => void;
  onSaveRedirectUri?: (value: string) => Promise<{ ok: boolean; message?: string }>;
}

const AniListRedirectModal: React.FC<AniListRedirectModalProps> = ({
  open,
  expectedRedirectUri,
  configuredRedirectUri,
  reason,
  onClose,
  onConfirm,
  onOpenSettings,
  onSaveRedirectUri,
}) => {
  const [copied, setCopied] = useState(false);
  const [redirectInput, setRedirectInput] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const canOpenSettings = Boolean(onOpenSettings);
  const canSaveRedirect = Boolean(onSaveRedirectUri);

  useEffect(() => {
    if (!open) return;
    setRedirectInput(configuredRedirectUri || expectedRedirectUri);
    setSaveState('idle');
    setSaveMessage(null);
  }, [open, configuredRedirectUri, expectedRedirectUri]);

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
      return 'LAN hosting changed. AniList supports one redirect URL at a time, and the desktop app uses the LAN host when LAN is enabled.';
    }
    if (reason === 'error') {
      return 'AniList rejected the redirect URL. Use the exact URL below in AniList and in ManVerse.';
    }
    return 'Your AniList redirect URL does not match the current hosting mode. AniList supports one redirect URL at a time.';
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

  const handleSave = async () => {
    if (!onSaveRedirectUri) return;
    const trimmed = redirectInput.trim();
    const normalizedInput = normalizeRedirectUri(trimmed);
    if (!normalizedInput) {
      setSaveState('error');
      setSaveMessage('Enter a redirect URL before saving.');
      return;
    }
    const normalizedConfigured = normalizeRedirectUriForCompare(configuredRedirectUri || '');
    const normalizedInputCompare = normalizeRedirectUriForCompare(normalizedInput);
    if (normalizedInputCompare === normalizedConfigured) {
      setSaveState('saved');
      setSaveMessage('This redirect URL is already saved.');
      window.setTimeout(() => setSaveState('idle'), 1500);
      return;
    }
    setSaveState('saving');
    setSaveMessage(null);
    const result = await onSaveRedirectUri(normalizedInput);
    if (result.ok) {
      setSaveState('saved');
      setSaveMessage(result.message || 'Saved. We will re-check the login status.');
      window.setTimeout(() => setSaveState('idle'), 1500);
      return;
    }
    setSaveState('error');
    setSaveMessage(result.message || 'Unable to save the redirect URL yet.');
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

          <div className="rounded-xl border border-white/10 bg-surfaceHighlight/30 px-4 py-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Update ManVerse redirect URL
            </div>
            <input
              type="text"
              value={redirectInput}
              onChange={(event) => {
                setRedirectInput(event.target.value);
                if (saveState !== 'idle') {
                  setSaveState('idle');
                }
                if (saveMessage) {
                  setSaveMessage(null);
                }
              }}
              disabled={!canSaveRedirect || saveState === 'saving'}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:opacity-60"
              placeholder={expectedRedirectUri}
            />
            <div className="flex flex-wrap gap-2 text-xs text-gray-400">
              <button
                type="button"
                onClick={() => setRedirectInput(expectedRedirectUri)}
                className="text-primary hover:text-white"
              >
                Use expected URL
              </button>
              <span className="text-gray-600">•</span>
              <span>
                {canSaveRedirect ? 'Saving restarts the local API.' : 'Open Settings to update this URL.'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={!canSaveRedirect || saveState === 'saving'}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 transition ${
                  canSaveRedirect
                    ? 'text-gray-200 hover:text-white hover:bg-white/5'
                    : 'text-gray-500 cursor-not-allowed'
                }`}
              >
                {saveState === 'saving' ? 'Saving...' : 'Save in ManVerse'}
              </button>
              {saveMessage && (
                <span
                  className={`text-xs ${
                    saveState === 'error' ? 'text-amber-200' : 'text-emerald-200'
                  }`}
                >
                  {saveMessage}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={() => onOpenSettings?.()}
              disabled={!canOpenSettings}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold border border-white/10 transition ${
                canOpenSettings
                  ? 'text-gray-300 hover:text-white hover:bg-white/5'
                  : 'text-gray-500 cursor-not-allowed'
              }`}
            >
              Open app settings
            </button>
            <a
              href="https://anilist.co/settings/developer"
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center px-4 py-2 rounded-lg text-xs font-semibold bg-white/5 text-gray-200 border border-white/10 hover:bg-white/10 transition"
            >
              Open AniList developer settings
            </a>
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
          </details>
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end">
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
