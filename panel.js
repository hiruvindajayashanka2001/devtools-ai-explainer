const explainBtn = document.getElementById("explainBtn");
const clearBtn = document.getElementById("clearBtn");
const codeContent = document.getElementById("codeContent");
const resultContent = document.getElementById("resultContent");
const modeSelect = document.getElementById("modeSelect");

const MODE_PROMPTS = {
  general: "Explain what this HTML element does, its purpose, its CSS classes, and how it fits into the page. Be clear and structured.",
  beginner: "Explain this HTML/CSS code to a complete beginner learning web development. Use simple language, analogies, and explain every part.",
  security: "Analyze this HTML element for security issues: XSS vulnerabilities, exposed data, dangerous attributes, inline scripts, suspicious links. Be specific.",
  css: "Focus on the CSS classes and inline styles. Explain what each style rule does visually and why a developer might use it.",
  performance: "Analyze this element for web performance: large images, render-blocking scripts, missing lazy loading, inefficient layout triggers."
};

// Load API key from storage
function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["geminiApiKey"], (result) => {
      if (result.geminiApiKey) {
        resolve(result.geminiApiKey);
      } else {
        reject(new Error("No API key found. Please go to extension Settings and add your Gemini API key."));
      }
    });
  });
}

// Get selected element via $0
function getSelectedElement() {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(
      `(function() {
        if (!$0) return null;
        const style = window.getComputedStyle($0);
        const keys = ['display','position','width','height','color','background',
                      'font-size','margin','padding','flex','grid','z-index','overflow'];
        const computedStyle = {};
        keys.forEach(k => computedStyle[k] = style.getPropertyValue(k));
        return {
          outerHTML: $0.outerHTML,
          tagName: $0.tagName,
          id: $0.id,
          className: $0.className,
          computedStyle
        };
      })()`,
      (result, isException) => {
        if (isException) reject(new Error("Could not access DevTools context."));
        else if (!result) reject(new Error("No element selected. Click an element in the Elements tab first."));
        else resolve(result);
      }
    );
  });
}

// Call Gemini API
async function explainWithGemini(elementData, mode, apiKey) {
  const modePrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.general;
  const codeSnippet = elementData.outerHTML.slice(0, 3000);
  const styleInfo = JSON.stringify(elementData.computedStyle, null, 2);

  const prompt = `
${modePrompt}

**Selected HTML Element:**
\`\`\`html
${codeSnippet}
\`\`\`

**Computed CSS (key properties):**
\`\`\`json
${styleInfo}
\`\`\`

Tag: ${elementData.tagName}, ID: "${elementData.id}", Classes: "${elementData.className}"
  `.trim();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.4 }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json();
    const msg = err?.error?.message || "Gemini API request failed";
    throw new Error(msg);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No explanation returned.";
}

// Main explain handler
explainBtn.addEventListener("click", async () => {
  explainBtn.disabled = true;
  explainBtn.textContent = "Analyzing...";
  resultContent.innerHTML = `<div class="loading"><div class="spinner"></div> Fetching element...</div>`;
  codeContent.innerHTML = `<span class="placeholder">Reading selected element...</span>`;

  try {
    const [apiKey, elementData] = await Promise.all([
      getApiKey(),
      getSelectedElement()
    ]);

    codeContent.textContent = elementData.outerHTML.slice(0, 800) +
      (elementData.outerHTML.length > 800 ? "\n... (truncated)" : "");

    resultContent.innerHTML = `<div class="loading"><div class="spinner"></div> Gemini is thinking...</div>`;

    const mode = modeSelect.value;
    const explanation = await explainWithGemini(elementData, mode, apiKey);
    resultContent.textContent = explanation;

  } catch (err) {
    resultContent.innerHTML = `<div class="error-msg">❌ ${err.message}</div>`;

    // Guide them to settings if key is missing
    if (err.message.includes("No API key")) {
      resultContent.innerHTML += `
        <br><div style="font-size:11px; color:#6060a0; margin-top:8px;">
          Right-click the extension icon → <strong>Options</strong> to add your key.
        </div>`;
    }
  } finally {
    explainBtn.disabled = false;
    explainBtn.innerHTML = `<span class="btn-icon">🔍</span> Explain Selected Element`;
  }
});

clearBtn.addEventListener("click", () => {
  codeContent.innerHTML = `<span class="placeholder">No element selected yet.</span>`;
  resultContent.innerHTML = `<span class="placeholder">Your explanation will appear here.</span>`;
});