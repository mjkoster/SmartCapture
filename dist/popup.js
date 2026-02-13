// src/utils/sanitizer.ts
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

// src/utils/date.ts
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(void 0, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1e3);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592e3) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(iso);
}

// src/ui/popup/popup.ts
var captureBtn = document.getElementById("capture-btn");
var captureBtnText = document.getElementById("capture-btn-text");
var settingsBtn = document.getElementById("settings-btn");
var previewSection = document.getElementById("preview-section");
var previewFavicon = document.getElementById("preview-favicon");
var previewTitle = document.getElementById("preview-title");
var previewUrl = document.getElementById("preview-url");
var previewType = document.getElementById("preview-type");
var annotationSection = document.getElementById("annotation-section");
var tagInput = document.getElementById("tag-input");
var tagsContainer = document.getElementById("tags-container");
var tagSuggestions = document.getElementById("tag-suggestions");
var notesInput = document.getElementById("notes-input");
var highlightGroup = document.getElementById("highlight-group");
var highlightText = document.getElementById("highlight-text");
var saveBtn = document.getElementById("save-btn");
var discardBtn = document.getElementById("discard-btn");
var recentList = document.getElementById("recent-list");
var toast = document.getElementById("toast");
var pendingCapture = null;
var tags = [];
loadRecentCaptures();
loadTagSuggestions();
captureBtn.addEventListener("click", handleCapture);
saveBtn.addEventListener("click", handleSave);
discardBtn.addEventListener("click", handleDiscard);
settingsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
tagInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addTag(tagInput.value.trim());
    tagInput.value = "";
  }
  if (e.key === "Backspace" && tagInput.value === "" && tags.length > 0) {
    removeTag(tags[tags.length - 1]);
  }
});
async function handleCapture() {
  captureBtn.disabled = true;
  captureBtnText.textContent = "Capturing\u2026";
  try {
    const response = await chrome.runtime.sendMessage({ type: "capture_current_tab" });
    if (!response.success) {
      showToast(response.error ?? "Capture failed", "error");
      return;
    }
    pendingCapture = response.capture;
    showPreview(pendingCapture);
    showAnnotationForm(pendingCapture);
    showToast("Page captured!", "success");
  } catch (err) {
    showToast(String(err), "error");
  } finally {
    captureBtn.disabled = false;
    captureBtnText.textContent = "Capture This Page";
  }
}
async function handleSave() {
  if (!pendingCapture) return;
  const updates = {
    tags: [...tags],
    notes: notesInput.value.trim()
  };
  const response = await chrome.runtime.sendMessage({
    type: "update_annotations",
    captureId: pendingCapture.metadata.id,
    updates
  });
  if (response.success) {
    showToast("Saved!", "success");
    resetForm();
    loadRecentCaptures();
  } else {
    showToast("Save failed", "error");
  }
}
function handleDiscard() {
  if (pendingCapture) {
    chrome.runtime.sendMessage({
      type: "delete_capture",
      id: pendingCapture.metadata.id
    });
  }
  resetForm();
}
function showPreview(capture) {
  previewSection.hidden = false;
  previewFavicon.src = capture.basics.favicon ?? "";
  previewFavicon.hidden = !capture.basics.favicon;
  previewTitle.textContent = capture.basics.title || "Untitled";
  previewUrl.textContent = capture.basics.url;
  previewType.textContent = capture.classification.type.replace(/_/g, " ");
}
function showAnnotationForm(capture) {
  annotationSection.hidden = false;
  if (capture.annotations.highlights.length > 0) {
    highlightGroup.hidden = false;
    highlightText.textContent = capture.annotations.highlights[0].text;
  }
}
function resetForm() {
  pendingCapture = null;
  tags.length = 0;
  previewSection.hidden = true;
  annotationSection.hidden = true;
  highlightGroup.hidden = true;
  notesInput.value = "";
  tagsContainer.innerHTML = "";
  tagInput.value = "";
}
function addTag(value) {
  if (!value || tags.includes(value)) return;
  tags.push(value);
  renderTags();
}
function removeTag(value) {
  const idx = tags.indexOf(value);
  if (idx !== -1) {
    tags.splice(idx, 1);
    renderTags();
  }
}
function renderTags() {
  tagsContainer.innerHTML = tags.map(
    (t) => `<span class="tag">${escapeHtml(t)}<button type="button" class="tag-remove" data-tag="${escapeHtml(t)}">&times;</button></span>`
  ).join("");
  tagsContainer.querySelectorAll(".tag-remove").forEach((btn) => {
    btn.addEventListener("click", () => removeTag(btn.dataset.tag));
  });
}
async function loadTagSuggestions() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "get_all_tags" });
    if (response.success && response.tags) {
      tagSuggestions.innerHTML = response.tags.map((t) => `<option value="${escapeHtml(t)}">`).join("");
    }
  } catch {
  }
}
async function loadRecentCaptures() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "get_recent", limit: 8 });
    if (!response.success || !response.captures?.length) {
      recentList.innerHTML = '<div class="empty-state">No captures yet</div>';
      return;
    }
    recentList.innerHTML = response.captures.map((c) => renderCaptureItem(c)).join("");
    recentList.querySelectorAll(".capture-item").forEach((el) => {
      el.addEventListener("click", () => {
        const url = el.dataset.url;
        if (url) chrome.tabs.create({ url });
      });
    });
  } catch {
    recentList.innerHTML = '<div class="empty-state">Failed to load captures</div>';
  }
}
function renderCaptureItem(c) {
  const favicon = c.basics.favicon ? `<img class="capture-item-favicon" src="${escapeHtml(c.basics.favicon)}" width="14" height="14" alt="">` : "";
  const title = escapeHtml(c.basics.title || "Untitled");
  const type = c.classification.type.replace(/_/g, " ");
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
function showToast(message, type) {
  toast.textContent = message;
  toast.className = `toast toast--${type}`;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 2500);
}
