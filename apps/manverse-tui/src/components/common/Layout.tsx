import React from 'react';
import { Box } from 'ink';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';
import { StatusBar } from './StatusBar.js';
import { ToastContainer } from './Toast.js';

interface LayoutProps {
  title: string;
  showSidebar?: boolean;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ title, showSidebar = true, children }) => {
  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <Header title={title} />

      {/* Main Content Area */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Sidebar */}
        {showSidebar && <Sidebar />}

        {/* Content */}
        <Box flexDirection="column" flexGrow={1}>
          {children}
        </Box>
      </Box>

      {/* Status Bar */}
      <StatusBar />

      {/* Toast Notifications */}
      <ToastContainer />
    </Box>
  );
};
