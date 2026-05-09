const CLAUDE_API_KEY = "YOUR_CLAUDE_API_KEY_HERE"; // 🔑 Replace this

const explainBtn = document.getElementById("explainBtn");
const clearBtn = document.getElementById("clearBtn");
const codeContent = document.getElementById("codeContent");
const resultContent = document.getElementById("resultContent");
const modeSelect = document.getElementById("modeSelect");

// Mode prompts
const MODE_PROMPTS = {
  general: "Explain what this HTML element does, its purpose, its CSS classes, and how it fits into the page. Be clear and structured.",
  beginner: "Explain this HTML/CSS code to a complete beginner learning web development. Use simple language, analogies, and explain every part.",
  security: "Analyze this HTML element for potential security issues. Look for: XSS vulnerabilities, exposed data, dangerous attributes (onclick, eval, innerHTML usage), inline scripts, suspicious links, data- attributes leaking info. Be specific.",
  css: "Focus on the CSS classes and inline styles on this element. Explain what each style rule does visually and why a developer might use it.",
  performance: "Analyze this HTML element for web performance. Check for: large images without lazy loading, render-blocking scripts, inefficient layout triggers, missing attributes that affect performance."
};

// Get the selected element from DevTools ($0)
function getSelectedElement() {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(
      `(function() {
        if (!$0) return null;
        return {
          outerHTML: $0.outerHTML,
          tagName: $0.tagName,
          id: $0.id,
          className: $0.className,
          computedStyle: (function() {
            const style = window.getComputedStyle($0);
            const keys = ['display','position','width','height','color','background',
                          'font-size','margin','padding','flex','grid','z-index','overflow'];
            const result = {};
            keys.forEach(k => result[k] = style.getPropertyValue(k));
            return result;
          })()
        };
      })()`,
      (result, isException) => {
        if (isException) {
          reject(new Error("Could not access DevTools context"));
        } else if (!result) {
          reject(new Error("No element selected. Click an element in the Elements tab first."));
        } else {
          resolve(result);
        }
      }
    );
  });
}

// Call Claude API
async function explainWithClaude(elementData, mode) {
  const modePrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.general;

  const codeSnippet = elementData.outerHTML.slice(0, 3000); // limit size
  const styleInfo = JSON.stringify(elementData.computedStyle, null, 2);

  const userMessage = `
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

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        { role: "user", content: userMessage }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || "API request failed");
  }

  const data = await response.json();
  return data.content?.[0]?.text || "No explanation returned.";
}

// Main explain handler
explainBtn.addEventListener("click", async () => {
  explainBtn.disabled = true;
  explainBtn.textContent = "Analyzing...";

  // Show loading in result
  resultContent.innerHTML = `<div class="loading"><div class="spinner"></div> Fetching element and sending to Claude...</div>`;
  codeContent.innerHTML = `<span class="placeholder">Reading selected element...</span>`;

  try {
    const elementData = await getSelectedElement();

    // Show code preview
    codeContent.textContent = elementData.outerHTML.slice(0, 800) +
      (elementData.outerHTML.length > 800 ? "\n... (truncated)" : "");

    resultContent.innerHTML = `<div class="loading"><div class="spinner"></div> Claude is thinking...</div>`;

    const mode = modeSelect.value;
    const explanation = await explainWithClaude(elementData, mode);

    resultContent.textContent = explanation;

  } catch (err) {
    resultContent.innerHTML = `<div class="error-msg">❌ ${err.message}</div>`;
    if (err.message.includes("No element")) {
      codeContent.innerHTML = `<span class="placeholder">No element selected yet. Click an element in the Elements tab.</span>`;
    }
  } finally {
    explainBtn.disabled = false;
    explainBtn.innerHTML = `<span class="btn-icon">🔍</span> Explain Selected Element`;
  }
});

// Clear handler
clearBtn.addEventListener("click", () => {
  codeContent.innerHTML = `<span class="placeholder">No element selected yet. Click an element in the Elements tab.</span>`;
  resultContent.innerHTML = `<span class="placeholder">Your explanation will appear here.</span>`;
});