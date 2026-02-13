/**
 * Popup UI controller.
 *
 * Manages the capture flow, tag input with autocomplete,
 * notes entry, and recent captures list.
 */

import type { Capture } from '../../types/capture';
import { escapeHtml } from '../../utils/sanitizer';
import { timeAgo } from '../../utils/date';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const captureBtn = document.getElementById('capture-btn') as HTMLButtonElement;
const captureBtnText = document.getElementById('capture-btn-text')!;
const settingsBtn = document.getElementById('settings-btn')!;

const previewSection = document.getElementById('preview-section')!;
const previewFavicon = document.getElementById('preview-favicon') as HTMLImageElement;
const previewTitle = document.getElementById('preview-title')!;
const previewUrl = document.getElementById('preview-url')!;
const previewType = document.getElementById('preview-type')!;

const annotationSection = document.getElementById('annotation-section')!;
const tagInput = document.getElementById('tag-input') as HTMLInputElement;
const tagsContainer = document.getElementById('tags-container')!;
const tagSuggestions = document.getElementById('tag-suggestions')!;
const notesInput = document.getElementById('notes-input') as HTMLTextAreaElement;
const highlightGroup = document.getElementById('highlight-group')!;
const highlightText = document.getElementById('highlight-text')!;

const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const discardBtn = document.getElementById('discard-btn')!;

const recentList = document.getElementById('recent-list')!;
const toast = document.getElementById('toast')!;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let pendingCapture: Capture | null = null;
const tags: string[] = [];

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

loadRecentCaptures();
loadTagSuggestions();

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

captureBtn.addEventListener('click', handleCapture);
saveBtn.addEventListener('click', handleSave);
discardBtn.addEventListener('click', handleDiscard);
settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

tagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addTag(tagInput.value.trim());
    tagInput.value = '';
  }
  if (e.key === 'Backspace' && tagInput.value === '' && tags.length > 0) {
    removeTag(tags[tags.length - 1]);
  }
});

// ---------------------------------------------------------------------------
// Capture flow
// ---------------------------------------------------------------------------

async function handleCapture(): Promise<void> {
  captureBtn.disabled = true;
  captureBtnText.textContent = 'Capturing\u2026';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'capture_current_tab' });

    if (!response.success) {
      showToast(response.error ?? 'Capture failed', 'error');
      return;
    }

    pendingCapture = response.capture as Capture;
    showPreview(pendingCapture);
    showAnnotationForm(pendingCapture);
    showToast('Page captured!', 'success');
  } catch (err) {
    showToast(String(err), 'error');
  } finally {
    captureBtn.disabled = false;
    captureBtnText.textContent = 'Capture This Page';
  }
}

async function handleSave(): Promise<void> {
  if (!pendingCapture) return;

  const updates = {
    tags: [...tags],
    notes: notesInput.value.trim(),
  };

  const response = await chrome.runtime.sendMessage({
    type: 'update_annotations',
    captureId: pendingCapture.metadata.id,
    updates,
  });

  if (response.success) {
    showToast('Saved!', 'success');
    resetForm();
    loadRecentCaptures();
  } else {
    showToast('Save failed', 'error');
  }
}

function handleDiscard(): void {
  if (pendingCapture) {
    // Delete the already-stored capture since user discarded
    chrome.runtime.sendMessage({
      type: 'delete_capture',
      id: pendingCapture.metadata.id,
    });
  }
  resetForm();
}

// ---------------------------------------------------------------------------
// Preview & annotation form
// ---------------------------------------------------------------------------

function showPreview(capture: Capture): void {
  previewSection.hidden = false;
  previewFavicon.src = capture.basics.favicon ?? '';
  previewFavicon.hidden = !capture.basics.favicon;
  previewTitle.textContent = capture.basics.title || 'Untitled';
  previewUrl.textContent = capture.basics.url;
  previewType.textContent = capture.classification.type.replace(/_/g, ' ');
}

function showAnnotationForm(capture: Capture): void {
  annotationSection.hidden = false;

  // Show highlighted text if present
  if (capture.annotations.highlights.length > 0) {
    highlightGroup.hidden = false;
    highlightText.textContent = capture.annotations.highlights[0].text;
  }
}

function resetForm(): void {
  pendingCapture = null;
  tags.length = 0;
  previewSection.hidden = true;
  annotationSection.hidden = true;
  highlightGroup.hidden = true;
  notesInput.value = '';
  tagsContainer.innerHTML = '';
  tagInput.value = '';
}

// ---------------------------------------------------------------------------
// Tag management
// ---------------------------------------------------------------------------

function addTag(value: string): void {
  if (!value || tags.includes(value)) return;
  tags.push(value);
  renderTags();
}

function removeTag(value: string): void {
  const idx = tags.indexOf(value);
  if (idx !== -1) {
    tags.splice(idx, 1);
    renderTags();
  }
}

function renderTags(): void {
  tagsContainer.innerHTML = tags
    .map(
      (t) =>
        `<span class="tag">${escapeHtml(t)}<button type="button" class="tag-remove" data-tag="${escapeHtml(t)}">&times;</button></span>`,
    )
    .join('');

  // Attach remove listeners
  tagsContainer.querySelectorAll('.tag-remove').forEach((btn) => {
    btn.addEventListener('click', () => removeTag((btn as HTMLElement).dataset.tag!));
  });
}

async function loadTagSuggestions(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'get_all_tags' });
    if (response.success && response.tags) {
      tagSuggestions.innerHTML = (response.tags as string[])
        .map((t) => `<option value="${escapeHtml(t)}">`)
        .join('');
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Recent captures
// ---------------------------------------------------------------------------

async function loadRecentCaptures(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'get_recent', limit: 8 });
    if (!response.success || !response.captures?.length) {
      recentList.innerHTML = '<div class="empty-state">No captures yet</div>';
      return;
    }

    recentList.innerHTML = (response.captures as Capture[])
      .map((c) => renderCaptureItem(c))
      .join('');

    // Open URL on click
    recentList.querySelectorAll('.capture-item').forEach((el) => {
      el.addEventListener('click', () => {
        const url = (el as HTMLElement).dataset.url;
        if (url) chrome.tabs.create({ url });
      });
    });
  } catch {
    recentList.innerHTML = '<div class="empty-state">Failed to load captures</div>';
  }
}

function renderCaptureItem(c: Capture): string {
  const favicon = c.basics.favicon
    ? `<img class="capture-item-favicon" src="${escapeHtml(c.basics.favicon)}" width="14" height="14" alt="">`
    : '';
  const title = escapeHtml(c.basics.title || 'Untitled');
  const type = c.classification.type.replace(/_/g, ' ');
  const ago = timeAgo(c.metadata.createdAt);

  return `
    <div class="capture-item" data-url="${escapeHtml(c.basics.url)}">
      ${favicon}
      <div class="capture-item-body">
        <div class="capture-item-title">${title}</div>
        <div class="capture-item-meta">${ago} &middot; ${type}</div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Toast notification
// ---------------------------------------------------------------------------

function showToast(message: string, type: 'success' | 'error'): void {
  toast.textContent = message;
  toast.className = `toast toast--${type}`;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 2500);
}
