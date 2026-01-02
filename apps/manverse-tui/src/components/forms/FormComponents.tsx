import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface SelectInputProps {
  label: string;
  options: string[];
  value: string;
}

export const SelectInput: React.FC<SelectInputProps> = ({ label, options, value }) => {
  const selectedIndex = options.indexOf(value);

  return (
    <Box flexDirection="column">
      <Text>{label}: </Text>
      <Box borderStyle="single" borderColor="cyan" padding={1}>
        <Text>{value}</Text>
      </Box>
      {/* Dropdown not currently interactive - placeholder */}
      <Box flexDirection="column" marginTop={1}>
        {options.slice(0, 3).map((option, idx) => (
            <Text
              key={option}
              bold={idx === selectedIndex}
              color={idx === selectedIndex ? 'cyan' : 'white'}
            >
              {idx === selectedIndex ? '› ' : '  '}
              {option}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  password?: boolean;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  password = false,
}) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        {label}:
      </Text>
      <Box marginTop={1}>
        <TextInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          mask={password ? '*' : undefined}
        />
      </Box>
    </Box>
  );
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ label, variant = 'primary' }) => {
  const colors = {
    primary: 'cyan',
    secondary: 'gray',
    danger: 'red',
  };

  return (
    <Box borderStyle="round" borderColor={colors[variant]} padding={1}>
      <Text bold color={colors[variant]}>
        {label}
      </Text>
    </Box>
  );
};
