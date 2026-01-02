import React from 'react';
import { Box, Text } from 'ink';

interface ModalProps {
  title: string;
  children: React.ReactNode;
  width?: number;
  height?: number;
  onClose?: () => void;
}

export const Modal: React.FC<ModalProps> = ({ title, children, width = 60, height, onClose }) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      width={width}
      height={height}
      padding={1}
    >
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          {title}
        </Text>
        {onClose && <Text dimColor>[Esc] Close</Text>}
      </Box>

      {/* Content */}
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
    </Box>
  );
};

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal title={title} width={50} onClose={onCancel}>
      <Box flexDirection="column" padding={1}>
        <Text>{message}</Text>
        <Box marginTop={2} justifyContent="center" gap={2}>
          <Box borderStyle="round" borderColor="green" padding={1}>
            <Text bold color="green">
              [Y] Confirm
            </Text>
          </Box>
          <Box borderStyle="round" borderColor="red" padding={1}>
            <Text bold color="red">
              [N] Cancel
            </Text>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

interface InfoBoxProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
}

export const InfoBox: React.FC<InfoBoxProps> = ({ type, title, message }) => {
  const colors = {
    info: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
  };

  const icons = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✗',
  };

  return (
    <Box borderStyle="round" borderColor={colors[type]} padding={1}>
      <Box flexDirection="column">
        {title && (
          <Text bold color={colors[type]}>
            {icons[type]} {title}
          </Text>
        )}
        <Text color={colors[type]}>{message}</Text>
      </Box>
    </Box>
  );
};
