chrome.devtools.panels.create(
  "AI Explainer",       // Tab name in DevTools
  "",                   // Icon path (leave empty for now)
  "panel.html",         // The panel UI
  (panel) => {
    console.log("AI Explainer panel created");
  }
);