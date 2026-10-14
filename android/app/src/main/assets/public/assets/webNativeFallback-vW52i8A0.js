import{t as e}from"./index-R564rSFz.js";var t=class extends e{constructor(...e){super(...e),this.overlayElement=null,this.captureIntervalId=null,this.sequenceCounter=0,this.currentStream=null,this.hiddenVideo=null,this.hiddenCanvas=null}async checkPermissions(){return{hasOverlayPermission:!0,hasNotificationPermission:!0}}async requestOverlayPermission(){return{granted:!0}}async startScreenCapture(e){if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia)return{success:!1,message:`Browser does not support getDisplayMedia. Use Chrome/Edge desktop or native Android build.`};try{this.currentStream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:`window`},audio:!1}),this.hiddenVideo=document.createElement(`video`),this.hiddenVideo.autoplay=!0,this.hiddenVideo.playsInline=!0,this.hiddenVideo.muted=!0,this.hiddenVideo.srcObject=this.currentStream,await this.hiddenVideo.play().catch(()=>{}),this.hiddenCanvas=document.createElement(`canvas`);let t=(e?.intervalSeconds||5)*1e3,n=e?.targetWidth||1280,r=e?.quality||.8;return this.captureIntervalId&&clearInterval(this.captureIntervalId),this.captureIntervalId=setInterval(()=>{if(!this.hiddenVideo||!this.hiddenCanvas||!this.currentStream||this.hiddenVideo.videoWidth===0)return;let e=Math.min(1,n/this.hiddenVideo.videoWidth);this.hiddenCanvas.width=Math.round(this.hiddenVideo.videoWidth*e),this.hiddenCanvas.height=Math.round(this.hiddenVideo.videoHeight*e);let t=this.hiddenCanvas.getContext(`2d`);if(t){t.drawImage(this.hiddenVideo,0,0,this.hiddenCanvas.width,this.hiddenCanvas.height);let e=this.hiddenCanvas.toDataURL(`image/jpeg`,r);this.sequenceCounter+=1;let n={imageBase64:e,timestamp:Date.now(),sequenceId:this.sequenceCounter,width:this.hiddenCanvas.width,height:this.hiddenCanvas.height};this.notifyListeners(`onFrameCaptured`,n)}},t),{success:!0}}catch(e){return{success:!1,message:e.message||`Screen capture denied`}}}async stopScreenCapture(){return this.captureIntervalId&&=(clearInterval(this.captureIntervalId),null),this.currentStream&&=(this.currentStream.getTracks().forEach(e=>e.stop()),null),this.hiddenVideo&&=(this.hiddenVideo.srcObject=null,null),{success:!0}}async showFloatingOverlay(e){return this.renderWebFloatingHUD(e),{success:!0}}async updateFloatingOverlay(e){return this.renderWebFloatingHUD(e),{success:!0}}async hideFloatingOverlay(){return this.overlayElement&&=(this.overlayElement.remove(),null),{success:!0}}renderWebFloatingHUD(e){if(!this.overlayElement){this.overlayElement=document.createElement(`div`),this.overlayElement.id=`tradepulse-floating-overlay-badge`,this.overlayElement.style.position=`fixed`,this.overlayElement.style.top=`70px`,this.overlayElement.style.right=`20px`,this.overlayElement.style.zIndex=`99999`,this.overlayElement.style.cursor=`grab`,this.overlayElement.style.userSelect=`none`,document.body.appendChild(this.overlayElement);let e=!1,t=0,n=0,r=0,i=0;this.overlayElement.addEventListener(`mousedown`,a=>{e=!0,t=a.clientX,n=a.clientY;let o=this.overlayElement.getBoundingClientRect();r=o.left,i=o.top}),window.addEventListener(`mousemove`,a=>{if(!e||!this.overlayElement)return;let o=a.clientX-t,s=a.clientY-n;this.overlayElement.style.left=`${r+o}px`,this.overlayElement.style.top=`${i+s}px`,this.overlayElement.style.right=`auto`}),window.addEventListener(`mouseup`,()=>{e=!1})}let t=!!(e.errorReason||e.aiState===`ERROR`||e.aiState===`TIMEOUT`),n=!t&&e.direction===`WAIT`&&(e.verdictTitle&&(e.verdictTitle.includes(`পাওয়া যায়নি`)||e.verdictTitle.includes(`খুঁজে পাইনি`)||e.verdictTitle.includes(`নেই`)||e.verdictTitle.includes(`NOT_FOUND`))||e.confidence<=0||e.durationText===`--:--`),r=!t&&e.aiState===`ANALYZING`&&!n,i=t?`#ef4444`:e.direction===`UP`?`#10b981`:e.direction===`DOWN`?`#ef4444`:`#f59e0b`,a=t?`linear-gradient(135deg, rgba(127, 29, 29, 0.95), rgba(15, 23, 42, 0.95))`:e.direction===`UP`?`linear-gradient(135deg, rgba(6, 78, 59, 0.95), rgba(15, 23, 42, 0.95))`:e.direction===`DOWN`?`linear-gradient(135deg, rgba(127, 29, 29, 0.95), rgba(15, 23, 42, 0.95))`:`linear-gradient(135deg, rgba(120, 53, 15, 0.95), rgba(15, 23, 42, 0.95))`,o=e.symbol||`AUD/CHF`,s=e.frameCount?`#${e.frameCount}`:`#1`,c=e.latencyMs?`${e.latencyMs}ms`:`0ms`,l=e.resolution||`720p`;if(t)this.overlayElement.innerHTML=`
        <div style="background: ${a}; border: 2px solid ${i}; border-radius: 18px; padding: 10px 16px; box-shadow: 0 14px 35px rgba(0,0,0,0.7); backdrop-filter: blur(14px); min-width: 240px; color: #fff; font-family: ui-sans-serif, system-ui, sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 12px; font-weight: 900; color: #fca5a5; letter-spacing: 0.3px;">⚠️ ${e.errorReason||`সংযোগ ত্রুটি`}</span>
            <span style="font-size: 10px; font-weight: 700; background: rgba(0,0,0,0.5); padding: 1px 6px; border-radius: 8px; color: #f87171; font-family: monospace;">Frame ${s}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #cbd5e1; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px; margin-top: 4px;">
            <span>⏱ ল্যাটেন্সি: ${c}</span>
            <span>State: WAIT</span>
          </div>
        </div>
      `;else if(n){let t=e.verdictTitle&&e.verdictTitle!==`ANALYZING`?e.verdictTitle:`চার্ট পাওয়া যায়নি`,n=e.reasonText||`ট্রেডিং চার্ট সামনে রাখুন`;this.overlayElement.innerHTML=`
        <div style="background: ${a}; border: 2px solid #f59e0b; border-radius: 18px; padding: 10px 16px; box-shadow: 0 12px 30px rgba(0,0,0,0.65); backdrop-filter: blur(12px); min-width: 240px; color: #fff; font-family: ui-sans-serif, system-ui, sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 12px; font-weight: 800; color: #fbbf24;">⏸ ${t}</span>
            </div>
            <span style="font-size: 10px; font-family: monospace; color: #94a3b8; background: rgba(0,0,0,0.4); padding: 1px 6px; border-radius: 8px;">${s}</span>
          </div>
          <div style="font-size: 10px; color: #cbd5e1; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${n}
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: #94a3b8; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 3px;">
            <span>${l}</span>
            <span style="color: #f59e0b; font-weight: 700;">WAIT (0%)</span>
          </div>
        </div>
      `}else if(r)this.overlayElement.innerHTML=`
        <div style="background: ${a}; border: 2px solid #38bdf8; border-radius: 18px; padding: 8px 16px; box-shadow: 0 12px 30px rgba(0,0,0,0.65); backdrop-filter: blur(12px); min-width: 220px; color: #fff; font-family: ui-sans-serif, system-ui, sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 8px #38bdf8; animation: pulse 1.5s infinite;"></span>
              <span style="font-size: 12px; font-weight: 700; color: #bae6fd;">ফ্রেম বিশ্লেষণ হচ্ছে...</span>
            </div>
            <span style="font-size: 10px; font-family: monospace; color: #94a3b8; background: rgba(0,0,0,0.4); padding: 1px 6px; border-radius: 8px;">${s}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #94a3b8; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 3px;">
            <span>${l}</span>
            <span>AI: ANALYZING</span>
          </div>
        </div>
      `;else{let t=e.direction===`UP`?`▲ CALL (UP)`:e.direction===`DOWN`?`▼ PUT (DOWN)`:`● WAIT`,n=e.reasonText&&e.reasonText.length>28?e.reasonText.substring(0,26)+`..`:e.reasonText||`মোমেন্টাম নিশ্চিত`;this.overlayElement.innerHTML=`
        <div style="background: ${a}; border: 2px solid ${i}; border-radius: 20px; padding: 10px 16px; box-shadow: 0 14px 35px rgba(0,0,0,0.7); backdrop-filter: blur(14px); min-width: 240px; color: #fff; font-family: ui-sans-serif, system-ui, sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px;">
            <span style="font-size: 13px; font-weight: 900; color: ${i}; letter-spacing: 0.4px;">${t}</span>
            <span style="font-size: 11px; font-weight: 700; background: rgba(0,0,0,0.5); padding: 1px 7px; border-radius: 10px; color: #38bdf8; font-family: monospace;">⏱ ${e.durationText||`01:00`}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #cbd5e1; margin-bottom: 4px;">
            <span><b>${o}</b> • ${n}</span>
            <span style="font-size: 10px; color: #94a3b8; margin-left: 6px;">${e.confidence}%</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 3px;">
            <span>Frame ${s} (${l})</span>
            <span>⚡ ${c}</span>
          </div>
        </div>
      `}}async speak(e){if(typeof window>`u`||!(`speechSynthesis`in window))return{success:!1,message:`Web SpeechSynthesis not supported`};try{window.speechSynthesis.cancel();let t=new SpeechSynthesisUtterance(e.text);return t.lang=`bn-BD`,window.speechSynthesis.speak(t),{success:!0}}catch(e){return{success:!1,message:e?.message||`Speech error`}}}async stopSpeaking(){return typeof window<`u`&&`speechSynthesis`in window&&window.speechSynthesis.cancel(),{success:!0}}};export{t as TradePulseNativeScreenWeb};