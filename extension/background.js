// Open the side-panel "widget" when the toolbar icon is clicked. Everything
// else lives in the panel itself (panel.js); this worker just wires the click.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.warn("sidePanel setPanelBehavior failed", e));
