const apiKeyInput = document.getElementById("apiKey");
const saveBtn = document.getElementById("saveBtn");
const statusMsg = document.getElementById("statusMsg");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const toggleVisibility = document.getElementById("toggleVisibility");

// Load saved key on open
chrome.storage.local.get(["geminiApiKey"], (result) => {
  if (result.geminiApiKey) {
    apiKeyInput.value = result.geminiApiKey;
    setKeyStatus(true);
  } else {
    setKeyStatus(false);
  }
});

// Show/hide key toggle
let visible = false;
toggleVisibility.addEventListener("click", () => {
  visible = !visible;
  apiKeyInput.type = visible ? "text" : "password";
  toggleVisibility.textContent = visible ? "🙈" : "👁️";
});

// Save key
saveBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();

  if (!key) {
    showStatus("Please enter a valid API key.", true);
    return;
  }

  if (!key.startsWith("AIza")) {
    showStatus("Gemini keys usually start with 'AIza'. Double-check your key.", true);
    return;
  }

  chrome.storage.local.set({ geminiApiKey: key }, () => {
    showStatus("✅ API key saved successfully!");
    setKeyStatus(true);
  });
});

function setKeyStatus(hasKey) {
  if (hasKey) {
    statusDot.classList.add("active");
    statusText.textContent = "API key is configured";
  } else {
    statusDot.classList.remove("active");
    statusText.textContent = "No API key saved yet";
  }
}

function showStatus(msg, isError = false) {
  statusMsg.textContent = msg;
  statusMsg.className = "status" + (isError ? " error" : "");
  setTimeout(() => { statusMsg.textContent = ""; }, 3000);
}