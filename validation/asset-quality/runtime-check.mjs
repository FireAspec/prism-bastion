/** Read-only renderer diagnostics. Import from browser console in a running development build. */
export async function measureRuntime(canvas=document.querySelector('#game-canvas'),sampleMs=2000){
 if(!(canvas instanceof HTMLCanvasElement))throw Error('Game canvas missing');
 if(!Number.isFinite(sampleMs)||sampleMs<500||sampleMs>10000)throw Error('Sample 500–10000 ms');
 const dpr=devicePixelRatio,b=canvas.getBoundingClientRect(),ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Canvas2D unavailable');
 const frameMs=[];await new Promise(resolve=>{let start,previous;function frame(t){if(start===undefined)start=t;if(previous!==undefined)frameMs.push(t-previous);previous=t;if(t-start>=sampleMs)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 const sorted=[...frameMs].sort((a,b)=>a-b),average=frameMs.reduce((a,b)=>a+b,0)/frameMs.length;
 return {screenPhysical:[Math.round(screen.width*dpr),Math.round(screen.height*dpr)],dpr,css:[b.width,b.height],canvas:[canvas.width,canvas.height],dprMatch:Math.abs(canvas.width-b.width*dpr)<=1&&Math.abs(canvas.height-b.height*dpr)<=1,filterEnabled:ctx.imageSmoothingEnabled,filterQuality:ctx.imageSmoothingQuality,canvasBytesEstimate:canvas.width*canvas.height*4,jsHeapBytes:performance.memory?.usedJSHeapSize??null,frameCount:frameMs.length,averageFrameMs:average,p95FrameMs:sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]??null,estimatedFps:1000/average,resourceTiming:performance.getEntriesByType('resource').map(x=>({name:new URL(x.name).pathname,durationMs:x.duration,decodedBodySize:x.decodedBodySize,transferSize:x.transferSize})),manualReviewRequired:true};
}
