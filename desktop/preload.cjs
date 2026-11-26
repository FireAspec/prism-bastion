'use strict';
const {contextBridge, ipcRenderer}=require('electron');
/** @type {import('../src/contracts/index').DesktopBridge} */
const api={
  setFullscreen: value=>ipcRenderer.invoke('prism:fullscreen',value),
  getVersion: ()=>ipcRenderer.invoke('prism:version'),
  startHost: (options,run)=>ipcRenderer.invoke('prism:host-start',options,run),
  stopHost: ()=>ipcRenderer.invoke('prism:host-stop'),
  getAddresses: ()=>ipcRenderer.invoke('prism:addresses')
};
contextBridge.exposeInMainWorld('prismDesktop',Object.freeze(api));
