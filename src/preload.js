const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    on: (channel, func) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    send: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  },
});
