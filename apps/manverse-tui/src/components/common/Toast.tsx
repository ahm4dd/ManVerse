import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import { useAppStore, type Toast as ToastType } from '../../state/store.js';

interface ToastProps {
  toast: ToastType;
}

const Toast: React.FC<ToastProps> = ({ toast }) => {
  const { removeToast } = useAppStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  const colors: Record<ToastType['type'], string> = {
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'blue',
  };

  const icons: Record<ToastType['type'], string> = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <Box borderStyle="round" borderColor={colors[toast.type]} paddingX={1}>
      <Text color={colors[toast.type]}>
        {icons[toast.type]} {toast.message}
      </Text>
    </Box>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useAppStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" position="absolute" right={1} top={1}>
      {toasts.map((toast) => (
        <Box key={toast.id} marginBottom={1}>
          <Toast toast={toast} />
        </Box>
      ))}
    </Box>
  );
};
