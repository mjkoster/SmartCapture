/**
 * Options page controller.
 *
 * Manages extension configuration: storage backend, capture toggles,
 * data export/import, and clear.
 */

import type { ExtensionConfig } from '../../types/config';
import type { StorageStats } from '../../types/storage';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const storageRadios = document.querySelectorAll<HTMLInputElement>('input[name="storageBackend"]');
const autoClassify = document.getElementById('autoClassify') as HTMLInputElement;
const extractContent = document.getElementById('extractContent') as HTMLInputElement;
const extractKeywords = document.getElementById('extractKeywords') as HTMLInputElement;

const statTotal = document.getElementById('stat-total')!;
const statStorage = document.getElementById('stat-storage')!;

const exportBtn = document.getElementById('export-btn')!;
const importBtn = document.getElementById('import-btn')!;
const importFile = document.getElementById('import-file') as HTMLInputElement;
const clearBtn = document.getElementById('clear-btn')!;
const shortcutLink = document.getElementById('shortcut-link')!;

const toast = document.getElementById('toast')!;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

loadConfig();
loadStats();

// Open chrome://extensions/shortcuts (works in Chromium)
shortcutLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

async function loadConfig(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'get_config' });
  if (!response.success) return;
  const config = response.config as ExtensionConfig;

  // Storage backend
  storageRadios.forEach((radio) => {
    radio.checked = radio.value === config.storageBackend;
  });

  // Toggles
  autoClassify.checked = config.autoClassify;
  extractContent.checked = config.extractContent;
  extractKeywords.checked = config.extractKeywords;

  // Listen for changes
  storageRadios.forEach((radio) => radio.addEventListener('change', saveConfig));
  autoClassify.addEventListener('change', saveConfig);
  extractContent.addEventListener('change', saveConfig);
  extractKeywords.addEventListener('change', saveConfig);
}

async function saveConfig(): Promise<void> {
  const selectedBackend = Array.from(storageRadios).find((r) => r.checked)?.value ?? 'chrome-local';

  const updates: Partial<ExtensionConfig> = {
    storageBackend: selectedBackend as ExtensionConfig['storageBackend'],
    autoClassify: autoClassify.checked,
    extractContent: extractContent.checked,
    extractKeywords: extractKeywords.checked,
  };

  const response = await chrome.runtime.sendMessage({
    type: 'update_config',
    config: updates,
  });

  if (response.success) {
    showToast('Settings saved', 'success');
  } else {
    showToast('Failed to save settings', 'error');
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

async function loadStats(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'get_stats' });
  if (!response.success) return;
  const stats = response.stats as StorageStats;

  statTotal.textContent = `${stats.totalCaptures} capture${stats.totalCaptures !== 1 ? 's' : ''}`;
  statStorage.textContent = formatBytes(stats.storageUsedBytes);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Export / Import / Clear
// ---------------------------------------------------------------------------

exportBtn.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'export_all' });
  if (!response.success) {
    showToast('Export failed', 'error');
    return;
  }

  const blob = new Blob([JSON.stringify(response.captures, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smart-capture-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Exported!', 'success');
});

importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const captures = JSON.parse(text);

    if (!Array.isArray(captures)) {
      showToast('Invalid file: expected an array of captures', 'error');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'import_captures',
      captures,
    });

    if (response.success) {
      showToast(`Imported ${captures.length} captures`, 'success');
      loadStats();
    } else {
      showToast('Import failed', 'error');
    }
  } catch {
    showToast('Failed to read file', 'error');
  }

  // Reset file input
  importFile.value = '';
});

clearBtn.addEventListener('click', async () => {
  if (!confirm('Delete ALL captures? This cannot be undone.')) return;

  const response = await chrome.runtime.sendMessage({ type: 'clear_all' });
  if (response.success) {
    showToast('All data cleared', 'success');
    loadStats();
  } else {
    showToast('Failed to clear data', 'error');
  }
});

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function showToast(message: string, type: 'success' | 'error'): void {
  toast.textContent = message;
  toast.className = `toast toast--${type}`;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 2500);
}
