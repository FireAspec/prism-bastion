'use strict';
const {app,BrowserWindow,ipcMain,session}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {createHostController,addresses}=require('./host-control.cjs');
const root=path.resolve(__dirname,'..');
const entry=path.join(root,'index.html');
const entryUrl=pathToFileURL(entry).href;
const smoke=process.argv.includes('--desktop-smoke-test');
const multi=smoke||process.argv.includes('--test-multi-instance');
const testProfile=multi?fs.mkdtempSync(path.join(os.tmpdir(),'Prism Bastion тест-')):null;
if(testProfile)app.setPath('userData',testProfile);
let win=null,quitting=false,allowQuit=false;
const host=createHostController((o,r)=>require('./host.cjs').launchHost(o,r));
const allowedFile=url=>{try{const relative=path.relative(root,fileURLToPath(url));return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}catch{return false;}};
function authorize(event){
  if(quitting||!win||win.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==entryUrl)throw new Error('Unauthorized desktop request');
}
function handle(channel,fn){ipcMain.handle(channel,(event,...args)=>{authorize(event);return fn(...args);});}
function noArgs(args){if(args.length)throw new TypeError('Unexpected arguments');}
handle('prism:fullscreen',(...args)=>{if(args.length!==1||typeof args[0]!=='boolean')throw new TypeError('Invalid fullscreen value');win.setFullScreen(args[0]);});
handle('prism:version',(...args)=>{noArgs(args);return app.getVersion();});
handle('prism:addresses',(...args)=>{noArgs(args);return addresses();});
handle('prism:host-start',(...args)=>{if(args.length!==2)throw new TypeError('Invalid host arguments');return host.start(...args);});
handle('prism:host-stop',(...args)=>{noArgs(args);return host.stop();});
async function open(){
  const s=session.defaultSession;
  s.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  s.setPermissionCheckHandler(()=>false);
  s.webRequest.onBeforeRequest((details,cb)=>{
    const url=details.url;
    // Renderer can connect only through WebSocket for multiplayer; HTTP/CDN requests are denied.
    cb({cancel:!(allowedFile(url)||url.startsWith('data:')||url.startsWith('blob:')||url.startsWith('ws://')||url.startsWith('wss://'))});
  });
  win=new BrowserWindow({width:1366,height:768,minWidth:960,minHeight:540,show:false,autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,webviewTag:false,devTools:!app.isPackaged}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(url!==entryUrl)event.preventDefault();});
  win.webContents.on('will-frame-navigate',(event,details)=>{if(!details.isMainFrame||details.url!==entryUrl)event.preventDefault();});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  win.webContents.on('will-redirect',event=>event.preventDefault());
  win.on('closed',()=>{win=null;app.quit();});
  await win.loadFile(entry);
  win.show();
  if(smoke){
    const result=await win.webContents.executeJavaScript(`(async()=>{
      const api=window.prismDesktop;
      const keys=Object.keys(api).sort().join(',');
      if(keys!=='getAddresses,getVersion,setFullscreen,startHost,stopHost'||typeof window.require!=='undefined'||typeof window.process!=='undefined')throw Error('Bridge isolation');
      if(location.protocol!=='file:')throw Error('Not file renderer');
      const script=document.querySelector('script[type="module"]');
      if(!script||!script.src.startsWith('file:'))throw Error('Missing local entry');
      if(!performance.getEntriesByName(script.src).some(e=>e.initiatorType==='script'||e.initiatorType==='other'))throw Error('Renderer script load not observed');
      const version=await api.getVersion(), addresses=await api.getAddresses();
      if(!version||!addresses.includes('127.0.0.1'))throw Error('IPC response');
      let rejected=false;try{await api.startHost({},{});}catch{rejected=true;}
      if(!rejected)throw Error('Invalid host accepted');
      await api.stopHost();
      return {version,addresses,renderer:location.protocol};
    })()`);
    report({ok:true,...result});app.quit();
  }
}
function report(value){
  // Only available in an explicitly launched diagnostic process, not renderer IPC.
  if(smoke&&process.env.PRISM_SMOKE_REPORT)fs.writeFileSync(process.env.PRISM_SMOKE_REPORT,JSON.stringify(value));
}
if(!multi&&!app.requestSingleInstanceLock()){app.quit();}
else{
  app.on('second-instance',()=>{if(win&&!win.isDestroyed()){if(win.isMinimized())win.restore();win.focus();}});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',event=>{
    if(allowQuit)return;
    event.preventDefault();
    if(quitting)return;
    quitting=true;
    host.close().then(()=>{allowQuit=true;app.quit();},()=>{allowQuit=true;app.exit(1);});
  });
  app.on('will-quit',()=>{if(testProfile){try{fs.rmSync(testProfile,{recursive:true,force:true});}catch{}}});
  app.whenReady().then(open).catch(error=>{report({ok:false,error:String(error)});console.error(error);app.quit();});
}
