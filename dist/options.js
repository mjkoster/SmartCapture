// src/ui/options/options.ts
var storageRadios = document.querySelectorAll('input[name="storageBackend"]');
var autoClassify = document.getElementById("autoClassify");
var extractContent = document.getElementById("extractContent");
var extractKeywords = document.getElementById("extractKeywords");
var statTotal = document.getElementById("stat-total");
var statStorage = document.getElementById("stat-storage");
var exportBtn = document.getElementById("export-btn");
var importBtn = document.getElementById("import-btn");
var importFile = document.getElementById("import-file");
var clearBtn = document.getElementById("clear-btn");
var shortcutLink = document.getElementById("shortcut-link");
var toast = document.getElementById("toast");
loadConfig();
loadStats();
shortcutLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});
async function loadConfig() {
  const response = await chrome.runtime.sendMessage({ type: "get_config" });
  if (!response.success) return;
  const config = response.config;
  storageRadios.forEach((radio) => {
    radio.checked = radio.value === config.storageBackend;
  });
  autoClassify.checked = config.autoClassify;
  extractContent.checked = config.extractContent;
  extractKeywords.checked = config.extractKeywords;
  storageRadios.forEach((radio) => radio.addEventListener("change", saveConfig));
  autoClassify.addEventListener("change", saveConfig);
  extractContent.addEventListener("change", saveConfig);
  extractKeywords.addEventListener("change", saveConfig);
}
async function saveConfig() {
  const selectedBackend = Array.from(storageRadios).find((r) => r.checked)?.value ?? "chrome-local";
  const updates = {
    storageBackend: selectedBackend,
    autoClassify: autoClassify.checked,
    extractContent: extractContent.checked,
    extractKeywords: extractKeywords.checked
  };
  const response = await chrome.runtime.sendMessage({
    type: "update_config",
    config: updates
  });
  if (response.success) {
    showToast("Settings saved", "success");
  } else {
    showToast("Failed to save settings", "error");
  }
}
async function loadStats() {
  const response = await chrome.runtime.sendMessage({ type: "get_stats" });
  if (!response.success) return;
  const stats = response.stats;
  statTotal.textContent = `${stats.totalCaptures} capture${stats.totalCaptures !== 1 ? "s" : ""}`;
  statStorage.textContent = formatBytes(stats.storageUsedBytes);
}
function formatBytes(bytes) {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
exportBtn.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "export_all" });
  if (!response.success) {
    showToast("Export failed", "error");
    return;
  }
  const blob = new Blob([JSON.stringify(response.captures, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `smart-capture-export-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported!", "success");
});
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const captures = JSON.parse(text);
    if (!Array.isArray(captures)) {
      showToast("Invalid file: expected an array of captures", "error");
      return;
    }
    const response = await chrome.runtime.sendMessage({
      type: "import_captures",
      captures
    });
    if (response.success) {
      showToast(`Imported ${captures.length} captures`, "success");
      loadStats();
    } else {
      showToast("Import failed", "error");
    }
  } catch {
    showToast("Failed to read file", "error");
  }
  importFile.value = "";
});
clearBtn.addEventListener("click", async () => {
  if (!confirm("Delete ALL captures? This cannot be undone.")) return;
  const response = await chrome.runtime.sendMessage({ type: "clear_all" });
  if (response.success) {
    showToast("All data cleared", "success");
    loadStats();
  } else {
    showToast("Failed to clear data", "error");
  }
});
function showToast(message, type) {
  toast.textContent = message;
  toast.className = `toast toast--${type}`;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 2500);
}
