import chalk from 'chalk';

// Theme colors
export const colors = {
  primary: chalk.cyan,
  secondary: chalk.magenta,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.blue,
  muted: chalk.gray,

  // UI elements
  border: chalk.cyan,
  title: chalk.bold.cyan,
  subtitle: chalk.gray,
  highlight: chalk.bold.yellow,
  link: chalk.underline.cyan,

  // Status
  active: chalk.green,
  inactive: chalk.gray,
  pending: chalk.yellow,
};

// Gradients (for headers)
export const gradients = {
  primary: ['#00D9FF', '#7B2FF7'],
  success: ['#00FF87', '#60EFFF'],
  warning: ['#FFD600', '#FF6B00'],
  error: ['#FF0000', '#FF6B6B'],
};
