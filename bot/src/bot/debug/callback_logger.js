const MAX_LOGS = 100;
const callbackLogs = [];
const calledCallbacks = new Set();

function logCallback(name, userId, username, startMs, status, error) {
  const durationMs = Date.now() - startMs;
  calledCallbacks.add(name);
  callbackLogs.push({ callback: name, userId, username, time: new Date(), durationMs, status, error });
  if (callbackLogs.length > MAX_LOGS) callbackLogs.shift();
  const tag = status === 'SUCCESS' ? '✅' : status === 'TIMEOUT' ? '⏱' : '❌';
  console.log(`[CALLBACK] ${tag} ${name} | ${status} | ${durationMs}ms${error ? ' | ' + error : ''}`);
}

function getRecentLogs(n = 20) {
  return callbackLogs.slice(-n).reverse();
}

function getUnusedCallbacks(allRegistered) {
  return allRegistered.filter(cb => !calledCallbacks.has(cb));
}

function getCallbackStats() {
  const total   = callbackLogs.length;
  const success = callbackLogs.filter(l => l.status === 'SUCCESS').length;
  const failed  = callbackLogs.filter(l => l.status !== 'SUCCESS').length;
  return { total, success, failed };
}

module.exports = { logCallback, getRecentLogs, getUnusedCallbacks, getCallbackStats, calledCallbacks };
