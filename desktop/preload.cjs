const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('manverse', {
  getSettings: () => ipcRenderer.invoke('manverse:getSettings'),
  updateSetting: (key, value) =>
    ipcRenderer.invoke('manverse:updateSetting', { key, value }),
  getUpdateStatus: () => ipcRenderer.invoke('manverse:getUpdateStatus'),
  installUpdate: () => ipcRenderer.invoke('manverse:installUpdate'),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('manverse:update-status', listener);
    return () => {
      ipcRenderer.removeListener('manverse:update-status', listener);
    };
  },
  getNotifierEvents: () => ipcRenderer.invoke('manverse:getNotifierEvents'),
  markAllNotifierRead: () => ipcRenderer.invoke('manverse:markAllNotifierRead'),
  onNotifierEvents: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('manverse:notifier-events', listener);
    return () => {
      ipcRenderer.removeListener('manverse:notifier-events', listener);
    };
  },
  minimizeWindow: () => ipcRenderer.invoke('manverse:window-minimize'),
  toggleMaximize: () => ipcRenderer.invoke('manverse:window-toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('manverse:window-close'),
  getWindowState: () => ipcRenderer.invoke('manverse:getWindowState'),
  onWindowState: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('manverse:window-state', listener);
    return () => {
      ipcRenderer.removeListener('manverse:window-state', listener);
    };
  },
});
