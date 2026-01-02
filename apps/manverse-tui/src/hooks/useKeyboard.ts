import { useInput } from 'ink';
import { useAppStore } from '../state/store.js';

/**
 * Global keyboard shortcuts handler
 * Handles app-wide shortcuts like quit, help, etc.
 */
export function useGlobalKeyboard(onQuit?: () => void) {
  useInput((input, key) => {
    // Quit on 'q' (without ctrl)
    if (input === 'q' && !key.ctrl) {
      if (onQuit) {
        onQuit();
      } else {
        process.exit(0);
      }
    }

    // Quit on Ctrl+C
    if (key.ctrl && input === 'c') {
      process.exit(0);
    }

    // Help on '?'
    if (input === '?') {
      // TODO: Show help modal
      console.log('Help modal not yet implemented');
    }
  });
}

/**
 * Screen navigation shortcut hook
 * Provides common navigation shortcuts
 */
export function useScreenNavigation() {
  const { setScreen } = useAppStore();

  useInput((input, key) => {
    if (key.escape) {
      setScreen('dashboard');
    }
  });
}
