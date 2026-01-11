const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('manverse', {
  getSettings: () => ipcRenderer.invoke('manverse:getSettings'),
  updateSetting: (key, value) =>
    ipcRenderer.invoke('manverse:updateSetting', { key, value }),
});
