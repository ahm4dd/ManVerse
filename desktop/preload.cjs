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
});
