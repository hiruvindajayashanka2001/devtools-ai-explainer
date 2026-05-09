// background.js
// Service worker — handles extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  console.log("DevTools AI Explainer installed.");
});