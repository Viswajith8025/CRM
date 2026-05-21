let idleTimer: any = null;
let maxIdleTime = 15 * 60 * 1000; // default 15 minutes
let currentIdleTime = 0;

self.onmessage = (e: MessageEvent) => {
  if (e.data.type === 'START') {
    maxIdleTime = e.data.maxIdleTime || maxIdleTime;
    currentIdleTime = 0;
    
    if (idleTimer) clearInterval(idleTimer);
    
    // We tick every 1 second in the worker. Since this is a Web Worker,
    // modern browsers will NOT throttle this to 1 minute in background tabs,
    // ensuring perfect attendance tracking accuracy for long-running sessions.
    idleTimer = setInterval(() => {
      currentIdleTime += 1000;
      if (currentIdleTime >= maxIdleTime) {
        self.postMessage({ type: 'IDLE_TIMEOUT' });
        // Pause tracking until manually reset to prevent spamming the main thread
        clearInterval(idleTimer);
      }
    }, 1000);
  } else if (e.data.type === 'RESET') {
    currentIdleTime = 0;
  } else if (e.data.type === 'STOP') {
    if (idleTimer) clearInterval(idleTimer);
    currentIdleTime = 0;
  }
};
