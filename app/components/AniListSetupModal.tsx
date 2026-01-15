import React, { useMemo, useState } from 'react';
import { XIcon, ChevronRight, ChevronLeft } from './Icons';
import { getApiUrl } from '../lib/api-client';

interface AniListSetupModalProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

type SetupSection = {
  title: string;
  description?: string;
  bullets?: string[];
  visibility?: 'mobile' | 'desktop' | 'all';
};

type SetupStep = {
  title: string;
  description: string;
  bullets?: string[];
  code?: string;
  note?: string;
  sections?: SetupSection[];
  cta?: {
    label: string;
    href: string;
  };
};

const AniListSetupModal: React.FC<AniListSetupModalProps> = ({
  open,
  onClose,
  onOpenSettings,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const redirectUri = `${getApiUrl()}/api/auth/anilist/callback`;

  const steps = useMemo<SetupStep[]>(
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
          'If you use LAN access, add the LAN API redirect from Settings → Self-hosting.',
        ],
        code: redirectUri,
      },
      {
        title: 'Add your credentials',
        description: 'Copy the client ID and secret into ManVerse. You only do this once.',
        note:
          'If you are using another device (phone/tablet), open Settings and save the credentials there.',
        cta: onOpenSettings
          ? {
              label: 'Open Settings now',
              href: '#settings',
            }
          : undefined,
        sections: [
          {
            title: 'Desktop app (recommended)',
            description: 'Set once inside ManVerse.',
            bullets: [
              'Open Settings → AniList setup.',
              'Paste your Client ID and Client Secret, then click Save credentials.',
              'Return here and click “Continue with AniList”.',
            ],
            visibility: 'desktop',
          },
          {
            title: 'Phone or tablet',
            description: 'Save credentials on the server you are connected to.',
            bullets: [
              'Open Settings from the menu.',
              'Paste Client ID + Secret and save.',
              'Return here and tap “Continue with AniList”.',
            ],
            visibility: 'mobile',
          },
          {
            title: 'Self-hosted (advanced)',
            description: 'Use these if you manage the API manually.',
            bullets: [
              'Linux: create ~/.config/environment.d/manverse.conf, then log out and back in.',
              'Windows: Start > search “Environment Variables” > add User variables.',
              'Developer: add to api/.env and restart with bun run dev:api.',
            ],
            visibility: 'desktop',
          },
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
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-4"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[92dvh] bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <h2 className="text-2xl font-bold text-white">AniList setup</h2>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-5 overflow-y-auto flex-1 min-h-0 overscroll-contain touch-pan-y">
          <div>
            <h3 className="text-2xl font-semibold text-white">{step.title}</h3>
            <p className="text-base text-gray-300 mt-2">{step.description}</p>
          </div>

          {step.note && (
            <div className="rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-300">
              {step.note}
            </div>
          )}

          {step.bullets && (
            <ul className="space-y-2 text-base text-gray-300 list-disc list-inside">
              {step.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          {step.sections && (
            <div className="space-y-4">
              {step.sections.map((section) => (
                <div
                  key={section.title}
                  className={`rounded-xl border border-white/10 bg-surfaceHighlight/30 p-4 ${
                    section.visibility === 'mobile'
                      ? 'md:hidden'
                      : section.visibility === 'desktop'
                      ? 'hidden md:block'
                      : ''
                  }`}
                >
                  <div className="text-base font-semibold text-white">{section.title}</div>
                  {section.description && (
                    <p className="text-sm text-gray-400 mt-1">{section.description}</p>
                  )}
                  {section.bullets && (
                    <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
                      {section.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {step.code && (
            <pre className="text-sm text-gray-200 bg-black/40 border border-white/10 rounded-xl p-4 whitespace-pre-wrap break-all overflow-x-auto">
{step.code}
            </pre>
          )}

          {step.cta && (
            <>
              {step.cta.href === '#settings' ? (
                <button
                  onClick={() => {
                    onOpenSettings?.();
                    onClose();
                    setStepIndex(0);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black text-xs font-bold shadow-lg shadow-primary/30 hover:brightness-110 transition"
                >
                  {step.cta.label}
                  <ChevronRight className="w-3 h-3" />
                </button>
              ) : (
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
            </>
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
