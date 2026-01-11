import React, { useMemo, useState } from 'react';
import { XIcon, ChevronRight, ChevronLeft } from './Icons';

interface AniListSetupModalProps {
  open: boolean;
  onClose: () => void;
}

const AniListSetupModal: React.FC<AniListSetupModalProps> = ({ open, onClose }) => {
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(
    () => [
      {
        title: 'Create an AniList application',
        description:
          'AniList requires a client ID and secret so ManVerse can sync your library.',
        bullets: [
          'Open the AniList developer settings.',
          'Create a new application (name it anything you want).',
          'Keep the app type as Web.',
        ],
        cta: {
          label: 'Open AniList developer settings',
          href: 'https://anilist.co/settings/developer',
        },
      },
      {
        title: 'Set the redirect URL',
        description: 'AniList must redirect back to ManVerse after approval.',
        bullets: [
          'Paste this exact URL into the Redirect URL field.',
          'Make sure there are no trailing slashes or typos.',
        ],
        code: 'http://localhost:3001/api/auth/anilist/callback',
      },
      {
        title: 'Add your credentials',
        description: 'Copy the client ID and secret into ManVerse.',
        bullets: [
          'Dev setup: add them to api/.env and restart the API.',
          'Desktop app: set them as system environment variables, then relaunch ManVerse.',
        ],
        code: 'ANILIST_CLIENT_ID=...\nANILIST_CLIENT_SECRET=...',
      },
      {
        title: 'Sign in',
        description: 'Return to ManVerse and connect your account.',
        bullets: [
          'Click “Continue with AniList”.',
          'Approve the permissions in the AniList window.',
          'You are ready to sync.',
        ],
      },
    ],
    [],
  );

  if (!open) return null;

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <h2 className="text-lg font-bold text-white">AniList setup</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-white">{step.title}</h3>
            <p className="text-sm text-gray-400 mt-2">{step.description}</p>
          </div>

          {step.bullets && (
            <ul className="space-y-2 text-sm text-gray-300 list-disc list-inside">
              {step.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          {step.code && (
            <pre className="text-xs text-gray-200 bg-black/40 border border-white/10 rounded-xl p-4 whitespace-pre-wrap">
{step.code}
            </pre>
          )}

          {step.cta && (
            <a
              href={step.cta.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black text-xs font-bold shadow-lg shadow-primary/30 hover:brightness-110 transition"
            >
              {step.cta.label}
              <ChevronRight className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
            disabled={isFirst}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              isFirst
                ? 'text-gray-600 bg-white/5 cursor-not-allowed'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <ChevronLeft className="w-3 h-3" />
            Back
          </button>
          <button
            onClick={() => {
              if (isLast) {
                onClose();
                setStepIndex(0);
                return;
              }
              setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
            }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-black text-xs font-bold shadow-lg shadow-primary/30 hover:brightness-110 transition"
          >
            {isLast ? 'Done' : 'Next'}
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AniListSetupModal;
