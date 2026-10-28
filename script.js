/**
 * ============================================================================
 * MediMind AI — Complete Client Application Script
 * AI Medical Assistant Frontend
 * ============================================================================
 */

/* ==========================================================================
   1. CONFIGURATION
   Configure your n8n webhook endpoint and application settings below.
   ========================================================================== */
const CONFIG = {
  /**
   * PASTE YOUR N8N WEBHOOK URL HERE:
   * Example: "https://your-n8n-instance.com/webhook/medimind-ai"
   * Leave empty until your n8n workflow is ready.
   */
  webhookUrl: "http://localhost:5678/webhook-test/medical-chat",

  /**
   * Network request timeout in milliseconds (default: 60 seconds).
   */
  requestTimeoutMs: 60000,

  /**
   * Maximum allowed file sizes in Megabytes.
   */
  maxImageSizeMB: 10,
  maxVideoSizeMB: 25,

  /**
   * Allowed file MIME types.
   */
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedVideoTypes: ["video/mp4", "video/webm"],

  /**
   * Storage key prefix for browser localStorage.
   */
  storagePrefix: "medimind_ai_",

  /**
   * Maximum number of previous conversation turns sent to n8n for context.
   */
  maxContextHistory: 8
};

/* ==========================================================================
   2. APPLICATION STATE
   ========================================================================== */
const STATE = {
  conversations: [],       // Array of conversation objects: { id, title, createdAt, updatedAt, messages: [] }
  activeConversationId: null,
  activeView: "chat",      // "chat" | "health-info" | "about"
  currentAttachment: null, // { file, type, name, size, mimeType, dataUrl }
  isRequestPending: false,
  isListening: false,      // Voice recognition active state
  searchQuery: "",
  sidebarCollapsed: false,
  lastFailedMessage: null  // { text, attachment } for retry action
};

/* ==========================================================================
   3. DOM ELEMENT REFERENCES
   ========================================================================== */
const DOM = {
  // Shell & Navigation
  appSidebar: document.getElementById("appSidebar"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop"),
  sidebarCloseBtn: document.getElementById("sidebarCloseBtn"),
  sidebarCollapseToggle: document.getElementById("sidebarCollapseToggle"),
  mobileMenuBtn: document.getElementById("mobileMenuBtn"),
  headerTitle: document.getElementById("headerTitle"),

  // Views
  chatView: document.getElementById("chatView"),
  healthInfoView: document.getElementById("healthInfoView"),
  aboutView: document.getElementById("aboutView"),

  // Navigation Items
  navAssistant: document.getElementById("navAssistant"),
  navHealthInfo: document.getElementById("navHealthInfo"),
  navAbout: document.getElementById("navAbout"),
  newChatBtn: document.getElementById("newChatBtn"),
  headerNewChatBtn: document.getElementById("headerNewChatBtn"),
  ctaStartChatBtn: document.getElementById("ctaStartChatBtn"),

  // Chat Containers
  welcomeScreen: document.getElementById("welcomeScreen"),
  messagesContainer: document.getElementById("messagesContainer"),
  messagesList: document.getElementById("messagesList"),
  scrollBottomBtn: document.getElementById("scrollBottomBtn"),

  // Search & History
  searchConversations: document.getElementById("searchConversations"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  conversationList: document.getElementById("conversationList"),
  historyCount: document.getElementById("historyCount"),

  // Composer Elements
  composerForm: document.getElementById("composerForm"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  attachImageBtn: document.getElementById("attachImageBtn"),
  attachVideoBtn: document.getElementById("attachVideoBtn"),
  imageFileInput: document.getElementById("imageFileInput"),
  videoFileInput: document.getElementById("videoFileInput"),
  attachmentPreview: document.getElementById("attachmentPreview"),
  attachmentThumbWrap: document.getElementById("attachmentThumbWrap"),
  attachmentFilename: document.getElementById("attachmentFilename"),
  attachmentFilesize: document.getElementById("attachmentFilesize"),
  attachmentRemoveBtn: document.getElementById("attachmentRemoveBtn"),
  attachmentNoticeText: document.getElementById("attachmentNoticeText"),
  emergencyBanner: document.getElementById("emergencyBanner"),

  // Modals & Triggers
  disclaimerModal: document.getElementById("disclaimerModal"),
  openDisclaimerBtn: document.getElementById("openDisclaimerBtn"),
  headerDisclaimerBtn: document.getElementById("headerDisclaimerBtn"),
  closeDisclaimerModal: document.getElementById("closeDisclaimerModal"),
  acknowledgeDisclaimerBtn: document.getElementById("acknowledgeDisclaimerBtn"),

  privacyModal: document.getElementById("privacyModal"),
  openPrivacyBtn: document.getElementById("openPrivacyBtn"),
  closePrivacyModal: document.getElementById("closePrivacyModal"),
  closePrivacyModalBtn: document.getElementById("closePrivacyModalBtn"),

  clearConfirmModal: document.getElementById("clearConfirmModal"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  closeClearModal: document.getElementById("closeClearModal"),
  cancelClearBtn: document.getElementById("cancelClearBtn"),
  confirmClearBtn: document.getElementById("confirmClearBtn"),

  imagePreviewModal: document.getElementById("imagePreviewModal"),
  enlargedPreviewImg: document.getElementById("enlargedPreviewImg"),
  closeImagePreviewModal: document.getElementById("closeImagePreviewModal"),

  toastContainer: document.getElementById("toastContainer")
};

/* ==========================================================================
   4. INITIALIZATION
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  loadConversationsFromStorage();
  initVoiceFeatures();
  bindEventListeners();
  renderHistoryList();
  updateComposerState();
  checkFirstVisitDisclaimer();
});

/* ==========================================================================
   5. EVENT BINDING
   ========================================================================== */
function bindEventListeners() {
  // Navigation tabs
  DOM.navAssistant?.addEventListener("click", () => switchView("chat"));
  DOM.navHealthInfo?.addEventListener("click", () => switchView("health-info"));
  DOM.navAbout?.addEventListener("click", () => switchView("about"));
  DOM.ctaStartChatBtn?.addEventListener("click", () => {
    switchView("chat");
    startNewConversation();
  });

  // New Chat actions
  DOM.newChatBtn?.addEventListener("click", startNewConversation);
  DOM.headerNewChatBtn?.addEventListener("click", startNewConversation);

  // Mobile drawer controls
  DOM.mobileMenuBtn?.addEventListener("click", toggleMobileSidebar);
  DOM.sidebarCloseBtn?.addEventListener("click", closeMobileSidebar);
  DOM.sidebarBackdrop?.addEventListener("click", closeMobileSidebar);

  // Desktop sidebar collapse toggle
  DOM.sidebarCollapseToggle?.addEventListener("click", toggleDesktopSidebar);

  // Search conversation history
  DOM.searchConversations?.addEventListener("input", handleSearchInput);
  DOM.clearSearchBtn?.addEventListener("click", clearSearch);

  // Suggestion Cards on Welcome Screen
  document.querySelectorAll(".suggestion-card").forEach(card => {
    card.addEventListener("click", () => {
      const prompt = card.getAttribute("data-prompt");
      if (prompt) {
        populateComposer(prompt);
      }
    });
  });

  // Composer Input & Auto-grow
  DOM.messageInput?.addEventListener("input", () => {
    autoGrowTextarea();
    detectEmergencyKeywords();
    updateComposerState();
  });

  DOM.messageInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Send button
  DOM.sendBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  // Attachment controls
  DOM.attachImageBtn?.addEventListener("click", () => DOM.imageFileInput?.click());
  DOM.attachVideoBtn?.addEventListener("click", () => DOM.videoFileInput?.click());
  DOM.imageFileInput?.addEventListener("change", handleImageSelect);
  DOM.videoFileInput?.addEventListener("change", handleVideoSelect);
  DOM.attachmentRemoveBtn?.addEventListener("click", removeCurrentAttachment);

  // Scroll to bottom button
  DOM.scrollBottomBtn?.addEventListener("click", scrollToBottom);
  DOM.messagesContainer?.addEventListener("scroll", handleChatScroll);

  // Modals
  DOM.openDisclaimerBtn?.addEventListener("click", () => openModal(DOM.disclaimerModal));
  DOM.headerDisclaimerBtn?.addEventListener("click", () => openModal(DOM.disclaimerModal));
  DOM.closeDisclaimerModal?.addEventListener("click", () => closeModal(DOM.disclaimerModal));
  DOM.acknowledgeDisclaimerBtn?.addEventListener("click", () => {
    closeModal(DOM.disclaimerModal);
    try {
      localStorage.setItem(CONFIG.storagePrefix + "disclaimer_acked", "true");
    } catch (e) {}
  });

  DOM.openPrivacyBtn?.addEventListener("click", () => openModal(DOM.privacyModal));
  DOM.closePrivacyModal?.addEventListener("click", () => closeModal(DOM.privacyModal));
  DOM.closePrivacyModalBtn?.addEventListener("click", () => closeModal(DOM.privacyModal));

  DOM.clearHistoryBtn?.addEventListener("click", () => openModal(DOM.clearConfirmModal));
  DOM.closeClearModal?.addEventListener("click", () => closeModal(DOM.clearConfirmModal));
  DOM.cancelClearBtn?.addEventListener("click", () => closeModal(DOM.clearConfirmModal));
  DOM.confirmClearBtn?.addEventListener("click", clearAllLocalHistory);

  DOM.closeImagePreviewModal?.addEventListener("click", () => closeModal(DOM.imagePreviewModal));
  DOM.imagePreviewModal?.addEventListener("click", (e) => {
    if (e.target === DOM.imagePreviewModal) closeModal(DOM.imagePreviewModal);
  });

  // Close modals on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllModals();
      closeMobileSidebar();
    }
  });
}

/* ==========================================================================
   6. VIEW ROUTING
   ========================================================================== */
function switchView(viewName) {
  STATE.activeView = viewName;

  // Update nav buttons
  [DOM.navAssistant, DOM.navHealthInfo, DOM.navAbout].forEach(btn => {
    if (btn) btn.classList.remove("active");
  });

  // Update panels
  [DOM.chatView, DOM.healthInfoView, DOM.aboutView].forEach(panel => {
    if (panel) panel.style.display = "none";
  });

  if (viewName === "chat") {
    DOM.navAssistant?.classList.add("active");
    if (DOM.chatView) DOM.chatView.style.display = "flex";
    if (DOM.headerTitle) {
      const activeConv = getActiveConversation();
      DOM.headerTitle.textContent = activeConv ? activeConv.title : "MediMind AI";
    }
  } else if (viewName === "health-info") {
    DOM.navHealthInfo?.classList.add("active");
    if (DOM.healthInfoView) DOM.healthInfoView.style.display = "flex";
    if (DOM.headerTitle) DOM.headerTitle.textContent = "Health Information";
  } else if (viewName === "about") {
    DOM.navAbout?.classList.add("active");
    if (DOM.aboutView) DOM.aboutView.style.display = "flex";
    if (DOM.headerTitle) DOM.headerTitle.textContent = "About MediMind AI";
  }

  closeMobileSidebar();
}

/* ==========================================================================
   7. SIDEBAR MANAGEMENT
   ========================================================================== */
function toggleMobileSidebar() {
  DOM.appSidebar?.classList.toggle("mobile-open");
  DOM.sidebarBackdrop?.classList.toggle("active");
}

function closeMobileSidebar() {
  DOM.appSidebar?.classList.remove("mobile-open");
  DOM.sidebarBackdrop?.classList.remove("active");
}

function toggleDesktopSidebar() {
  STATE.sidebarCollapsed = !STATE.sidebarCollapsed;
  DOM.appSidebar?.classList.toggle("collapsed", STATE.sidebarCollapsed);
}

/* ==========================================================================
   8. CONVERSATION MANAGEMENT & LOCAL STORAGE
   ========================================================================== */
function getStorageKey() {
  return CONFIG.storagePrefix + "conversations_v1";
}

function loadConversationsFromStorage() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (raw) {
      STATE.conversations = JSON.parse(raw);
    } else {
      STATE.conversations = [];
    }
  } catch (err) {
    showToast("Could not load stored history: local storage is disabled or full.", "warning");
    STATE.conversations = [];
  }
}

/**
 * Persists text history to localStorage.
 * Privacy & Safety: Image/Video data is strictly stripped so no media is saved to localStorage.
 */
function saveConversationsToStorage() {
  try {
    const sanitizedConversations = STATE.conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messages: conv.messages.map(msg => ({
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        timestamp: msg.timestamp,
        // Only keep lightweight attachment metadata, NEVER raw base64 dataUrl
        attachmentMeta: msg.attachment ? {
          type: msg.attachment.type,
          name: msg.attachment.name,
          size: msg.attachment.size
        } : null
      }))
    }));
    localStorage.setItem(getStorageKey(), JSON.stringify(sanitizedConversations));
  } catch (err) {
    // If storage is full or restricted, gracefully fail without breaking active chat
  }
}

function getActiveConversation() {
  if (!STATE.activeConversationId) return null;
  return STATE.conversations.find(c => c.id === STATE.activeConversationId) || null;
}

function startNewConversation() {
  stopSpokenReply();
  stopVoiceRecognition();
  switchView("chat");
  STATE.activeConversationId = null;
  STATE.lastFailedMessage = null;
  removeCurrentAttachment();
  
  if (DOM.messageInput) {
    DOM.messageInput.value = "";
    autoGrowTextarea();
  }
  if (DOM.emergencyBanner) {
    DOM.emergencyBanner.style.display = "none";
  }

  renderChatView();
  renderHistoryList();
  updateComposerState();
}

function selectConversation(id) {
  stopSpokenReply();
  stopVoiceRecognition();
  switchView("chat");
  STATE.activeConversationId = id;
  STATE.lastFailedMessage = null;
  removeCurrentAttachment();
  renderChatView();
  renderHistoryList();
  updateComposerState();
  scrollToBottom();
}

function deleteConversation(id, event) {
  if (event) event.stopPropagation();

  STATE.conversations = STATE.conversations.filter(c => c.id !== id);
  saveConversationsToStorage();

  if (STATE.activeConversationId === id) {
    startNewConversation();
  } else {
    renderHistoryList();
  }
  showToast("Conversation deleted from history", "success");
}

function clearAllLocalHistory() {
  STATE.conversations = [];
  STATE.activeConversationId = null;
  try {
    localStorage.removeItem(getStorageKey());
  } catch (e) {}

  closeModal(DOM.clearConfirmModal);
  startNewConversation();
  showToast("All local conversation history cleared.", "success");
}

/* ==========================================================================
   9. HISTORY SEARCH & RENDERING
   ========================================================================== */
function handleSearchInput(e) {
  STATE.searchQuery = e.target.value.trim().toLowerCase();
  if (DOM.clearSearchBtn) {
    DOM.clearSearchBtn.style.display = STATE.searchQuery ? "inline-flex" : "none";
  }
  renderHistoryList();
}

function clearSearch() {
  STATE.searchQuery = "";
  if (DOM.searchConversations) DOM.searchConversations.value = "";
  if (DOM.clearSearchBtn) DOM.clearSearchBtn.style.display = "none";
  renderHistoryList();
}

function renderHistoryList() {
  if (!DOM.conversationList) return;

  const filtered = STATE.conversations.filter(c => {
    if (!STATE.searchQuery) return true;
    return c.title.toLowerCase().includes(STATE.searchQuery);
  });

  if (DOM.historyCount) {
    DOM.historyCount.textContent = STATE.conversations.length;
  }

  if (filtered.length === 0) {
    DOM.conversationList.innerHTML = `
      <div class="history-empty-state">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <span>${STATE.searchQuery ? "No matching conversations" : "No previous conversations"}</span>
      </div>
    `;
    return;
  }

  // Sort newest first
  filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  let html = "";
  filtered.forEach(c => {
    const isActive = c.id === STATE.activeConversationId;
    const safeTitle = escapeHTML(c.title);
    html += `
      <div class="history-item ${isActive ? "active" : ""}" data-id="${c.id}">
        <button type="button" class="history-item-btn" title="${safeTitle}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="history-item-title">${safeTitle}</span>
        </button>
        <button type="button" class="history-item-delete" data-delete-id="${c.id}" aria-label="Delete conversation" title="Delete conversation">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
  });

  DOM.conversationList.innerHTML = html;

  // Attach click events
  DOM.conversationList.querySelectorAll(".history-item-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const parent = btn.closest(".history-item");
      const id = parent?.getAttribute("data-id");
      if (id) selectConversation(id);
    });
  });

  DOM.conversationList.querySelectorAll(".history-item-delete").forEach(delBtn => {
    delBtn.addEventListener("click", (e) => {
      const id = delBtn.getAttribute("data-delete-id");
      if (id) deleteConversation(id, e);
    });
  });
}

/* ==========================================================================
   10. CHAT RENDERING & DISPLAY
   ========================================================================== */
function renderChatView() {
  const activeConv = getActiveConversation();

  if (!activeConv || !activeConv.messages || activeConv.messages.length === 0) {
    if (DOM.welcomeScreen) DOM.welcomeScreen.style.display = "flex";
    if (DOM.messagesContainer) DOM.messagesContainer.style.display = "none";
    if (DOM.headerTitle) DOM.headerTitle.textContent = "MediMind AI";
    return;
  }

  if (DOM.welcomeScreen) DOM.welcomeScreen.style.display = "none";
  if (DOM.messagesContainer) DOM.messagesContainer.style.display = "block";
  if (DOM.headerTitle) DOM.headerTitle.textContent = activeConv.title;

  if (!DOM.messagesList) return;
  DOM.messagesList.innerHTML = "";

  activeConv.messages.forEach(msg => {
    appendMessageToDOM(msg, false);
  });

  scrollToBottom();
}

function appendMessageToDOM(msg, shouldScroll = true) {
  if (!DOM.messagesList) return;

  const isUser = msg.sender === "user";
  const row = document.createElement("div");
  row.className = `message-row ${isUser ? "user-row" : "assistant-row"}`;
  row.setAttribute("data-msg-id", msg.id || "");

  const formattedTime = formatTimestamp(msg.timestamp);

  if (isUser) {
    // Attachment preview thumbnail if attached
    let attachmentHtml = "";
    if (msg.attachment && msg.attachment.dataUrl && msg.attachment.type === "image") {
      attachmentHtml = `
        <div class="msg-attachment-pill">
          <img src="${msg.attachment.dataUrl}" alt="Attached image preview" class="msg-attachment-thumb" onclick="openEnlargedImage('${msg.attachment.dataUrl}')">
          <span>${escapeHTML(msg.attachment.name)}</span>
        </div>
      `;
    } else if (msg.attachment && msg.attachment.type === "video") {
      attachmentHtml = `
        <div class="msg-attachment-pill">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          <span>${escapeHTML(msg.attachment.name)}</span>
        </div>
      `;
    } else if (msg.attachmentMeta) {
      attachmentHtml = `
        <div class="msg-attachment-pill">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
          <span>Attached: ${escapeHTML(msg.attachmentMeta.name)}</span>
        </div>
      `;
    }

    const contentHtml = msg.text ? `<div class="msg-content">${escapeHTML(msg.text)}</div>` : "";

    row.innerHTML = `
      <div class="message-bubble user-bubble">
        ${attachmentHtml}
        ${contentHtml}
        <span class="msg-time">${formattedTime}</span>
      </div>
    `;
  } else {
    // Assistant message with safe markdown-like rendering
    const renderedBody = renderSafeMarkdown(msg.text);

    row.innerHTML = `
      <div class="assistant-avatar" aria-hidden="true">
        <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
          <rect width="40" height="40" rx="10" fill="url(#assistGrad)" />
          <path d="M16 8h8v7h7v8h-7v7h-8v-7H9v-8h7V8z" fill="#ffffff" />
          <circle cx="20" cy="19.5" r="2.5" fill="#1a66ff" />
          <defs>
            <linearGradient id="assistGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stop-color="#1a66ff" />
              <stop offset="1" stop-color="#4f46e5" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div class="message-bubble assistant-bubble">
        <div class="assistant-header">
          <div class="assistant-label">
            <span>MediMind AI</span>
            <span class="assistant-label-badge">General Health Info</span>
          </div>
          <div class="msg-actions">
            <button type="button" class="action-icon-btn speak-msg-btn" title="Read response aloud" aria-label="Read response aloud">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </button>
            <button type="button" class="action-icon-btn copy-msg-btn" title="Copy response to clipboard" aria-label="Copy response">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="msg-content">${renderedBody}</div>
        <div class="msg-footer">
          <span>AI educational guidance · Verify with a doctor</span>
          <span>${formattedTime}</span>
        </div>
      </div>
    `;

    // Action button listeners
    const copyBtn = row.querySelector(".copy-msg-btn");
    copyBtn?.addEventListener("click", () => {
      copyToClipboard(msg.text);
    });

    const speakBtn = row.querySelector(".speak-msg-btn");
    speakBtn?.addEventListener("click", () => {
      toggleSpokenReply(msg.text, speakBtn);
    });
  }

  DOM.messagesList.appendChild(row);

  if (shouldScroll) {
    scrollToBottom();
  }
}

/**
 * Appends a temporary typing indicator row.
 */
function showTypingIndicator() {
  removeTypingIndicator();

  const indicatorRow = document.createElement("div");
  indicatorRow.id = "typingIndicatorRow";
  indicatorRow.className = "message-row assistant-row";
  indicatorRow.innerHTML = `
    <div class="assistant-avatar" aria-hidden="true">
      <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
        <rect width="40" height="40" rx="10" fill="#e8f1ff" />
        <path d="M16 8h8v7h7v8h-7v7h-8v-7H9v-8h7V8z" fill="#1a66ff" />
      </svg>
    </div>
    <div class="message-bubble assistant-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <span class="typing-text">MediMind AI is reviewing your query...</span>
      </div>
    </div>
  `;
  DOM.messagesList?.appendChild(indicatorRow);
  scrollToBottom();
}

function removeTypingIndicator() {
  const row = document.getElementById("typingIndicatorRow");
  if (row) row.remove();
}

/**
 * Appends an error bubble with retry action.
 */
function appendErrorBubble(errorMessage, canRetry = true) {
  removeTypingIndicator();

  const row = document.createElement("div");
  row.className = "message-row assistant-row";
  row.innerHTML = `
    <div class="assistant-avatar" style="background:#fee2e2;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    <div class="message-bubble assistant-bubble error-bubble">
      <div class="error-title">
        <span>Connection / Request Error</span>
      </div>
      <div class="msg-content">
        <p>${escapeHTML(errorMessage)}</p>
      </div>
      ${canRetry && STATE.lastFailedMessage ? `
        <div class="error-actions">
          <button type="button" class="btn btn-sm btn-outline" id="retryMsgBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>Retry Request</span>
          </button>
        </div>
      ` : ""}
    </div>
  `;

  DOM.messagesList?.appendChild(row);
  scrollToBottom();

  const retryBtn = row.querySelector("#retryMsgBtn");
  retryBtn?.addEventListener("click", () => {
    row.remove();
    if (STATE.lastFailedMessage) {
      const msg = STATE.lastFailedMessage;
      STATE.lastFailedMessage = null;
      submitMessageToBackend(msg.text, msg.attachment);
    }
  });
}

/* ==========================================================================
   11. COMPOSER, ATTACHMENT & EMERGENCY HANDLING
   ========================================================================== */
function autoGrowTextarea() {
  if (!DOM.messageInput) return;
  DOM.messageInput.style.height = "auto";
  const newHeight = Math.min(DOM.messageInput.scrollHeight, 150);
  DOM.messageInput.style.height = `${newHeight}px`;
}

function populateComposer(text) {
  if (!DOM.messageInput) return;
  DOM.messageInput.value = text;
  autoGrowTextarea();
  DOM.messageInput.focus();
  updateComposerState();
}

function updateComposerState() {
  const hasText = DOM.messageInput ? DOM.messageInput.value.trim().length > 0 : false;
  const hasAttachment = STATE.currentAttachment !== null;
  const canSend = (hasText || hasAttachment) && !STATE.isRequestPending;

  if (DOM.sendBtn) {
    DOM.sendBtn.disabled = !canSend;
  }
}

/**
 * Emergency keyword detector:
 * Alert user immediately if prompt suggests urgent/life-threatening symptoms.
 */
function detectEmergencyKeywords() {
  if (!DOM.messageInput || !DOM.emergencyBanner) return;

  const text = DOM.messageInput.value.toLowerCase();
  const emergencyKeywords = [
    "chest pain", "pressure in chest", "heart attack",
    "cannot breathe", "can't breathe", "shortness of breath", "gasping for air",
    "stroke", "facial drooping", "face droop", "slurred speech", "arm weakness",
    "unconscious", "passed out", "fainted", "unresponsive",
    "coughing blood", "vomiting blood", "severe allergic", "anaphylaxis",
    "suicide", "severe head injury"
  ];

  const matched = emergencyKeywords.some(keyword => text.includes(keyword));
  DOM.emergencyBanner.style.display = matched ? "flex" : "none";
}

/**
 * Handle Image Selection
 */
function handleImageSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  // Validation: MIME type
  if (!CONFIG.allowedImageTypes.includes(file.type)) {
    showToast(`Unsupported image format (${file.type || "unknown"}). Use JPG, PNG, or WEBP.`, "error");
    e.target.value = "";
    return;
  }

  // Validation: Size
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > CONFIG.maxImageSizeMB) {
    showToast(`Image is too large (${sizeMB.toFixed(1)} MB). Maximum limit is ${CONFIG.maxImageSizeMB} MB.`, "error");
    e.target.value = "";
    return;
  }

  // Read preview in memory
  const reader = new FileReader();
  reader.onload = (event) => {
    STATE.currentAttachment = {
      file: file,
      type: "image",
      name: file.name,
      size: file.size,
      mimeType: file.type,
      dataUrl: event.target.result
    };
    displayAttachmentPreview();
    updateComposerState();
  };
  reader.onerror = () => {
    showToast("Error reading selected image file.", "error");
  };
  reader.readAsDataURL(file);

  // Clear file input value so re-selecting same file triggers change
  e.target.value = "";
}

/**
 * Handle Video Selection
 */
function handleVideoSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  // Validation: MIME type
  if (!CONFIG.allowedVideoTypes.includes(file.type)) {
    showToast(`Unsupported video format. Please use MP4 or WEBM.`, "error");
    e.target.value = "";
    return;
  }

  // Validation: Size
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > CONFIG.maxVideoSizeMB) {
    showToast(`Video is too large (${sizeMB.toFixed(1)} MB). Limit is ${CONFIG.maxVideoSizeMB} MB.`, "error");
    e.target.value = "";
    return;
  }

  STATE.currentAttachment = {
    file: file,
    type: "video",
    name: file.name,
    size: file.size,
    mimeType: file.type,
    dataUrl: null // Video is not base64 encoded client-side to save memory
  };

  displayAttachmentPreview();
  updateComposerState();
  e.target.value = "";
}

function displayAttachmentPreview() {
  if (!STATE.currentAttachment || !DOM.attachmentPreview) return;

  DOM.attachmentPreview.style.display = "flex";
  if (DOM.attachmentFilename) DOM.attachmentFilename.textContent = STATE.currentAttachment.name;
  if (DOM.attachmentFilesize) DOM.attachmentFilesize.textContent = formatBytes(STATE.currentAttachment.size);

  if (DOM.attachmentThumbWrap) {
    if (STATE.currentAttachment.type === "image" && STATE.currentAttachment.dataUrl) {
      DOM.attachmentThumbWrap.innerHTML = `
        <img src="${STATE.currentAttachment.dataUrl}" alt="Preview" class="attachment-thumb-img" onclick="openEnlargedImage('${STATE.currentAttachment.dataUrl}')">
      `;
      if (DOM.attachmentNoticeText) {
        DOM.attachmentNoticeText.textContent = "Images can provide useful context, but an AI assistant cannot reliably diagnose a medical condition from an image alone.";
      }
    } else {
      DOM.attachmentThumbWrap.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
      `;
      if (DOM.attachmentNoticeText) {
        DOM.attachmentNoticeText.textContent = "Video analysis is not connected yet. You can describe what you observed in the chat.";
      }
    }
  }
}

function removeCurrentAttachment() {
  STATE.currentAttachment = null;
  if (DOM.attachmentPreview) DOM.attachmentPreview.style.display = "none";
  if (DOM.attachmentThumbWrap) DOM.attachmentThumbWrap.innerHTML = "";
  if (DOM.imageFileInput) DOM.imageFileInput.value = "";
  if (DOM.videoFileInput) DOM.videoFileInput.value = "";
  updateComposerState();
}

/* ==========================================================================
   12. SENDING MESSAGES & N8N WEBHOOK INTEGRATION
   ========================================================================== */
function handleSendMessage() {
  if (STATE.isRequestPending) return;

  stopSpokenReply();
  stopVoiceRecognition();

  const rawText = DOM.messageInput ? DOM.messageInput.value.trim() : "";
  const attachment = STATE.currentAttachment;

  if (!rawText && !attachment) return;

  // Clear composer immediately
  if (DOM.messageInput) {
    DOM.messageInput.value = "";
    autoGrowTextarea();
  }
  if (DOM.emergencyBanner) {
    DOM.emergencyBanner.style.display = "none";
  }

  // Detach current attachment from composer
  removeCurrentAttachment();

  // Create or retrieve active conversation
  let activeConv = getActiveConversation();
  if (!activeConv) {
    activeConv = {
      id: generateUUID(),
      title: deriveConversationTitle(rawText || (attachment ? attachment.name : "Health Discussion")),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    STATE.conversations.unshift(activeConv);
    STATE.activeConversationId = activeConv.id;
  }

  // Create User Message Object
  const userMsg = {
    id: generateUUID(),
    sender: "user",
    text: rawText,
    timestamp: new Date().toISOString(),
    attachment: attachment
  };

  activeConv.messages.push(userMsg);
  activeConv.updatedAt = new Date().toISOString();

  // If this was the first message, set the title
  if (activeConv.messages.length === 1 && rawText) {
    activeConv.title = deriveConversationTitle(rawText);
  }

  saveConversationsToStorage();
  renderChatView();
  renderHistoryList();

  // Send request to n8n backend
  submitMessageToBackend(rawText, attachment);
}

/**
 * Network Communication with n8n Webhook
 */
async function submitMessageToBackend(userText, attachment) {
  STATE.isRequestPending = true;
  updateComposerState();
  showTypingIndicator();

  // 1. Check if Webhook URL is configured
  if (!CONFIG.webhookUrl || CONFIG.webhookUrl.trim() === "") {
    // Webhook is not configured yet. Provide a clear, friendly, and honest explanation.
    setTimeout(() => {
      removeTypingIndicator();
      STATE.isRequestPending = false;
      updateComposerState();

      appendErrorBubble(
        "⚡ Backend Connection Pending:\n\n" +
        "Your n8n webhook URL is not configured yet in `script.js`.\n\n" +
        "To connect live AI responses from Google Gemini:\n" +
        "1. Open `script.js` in your project folder.\n" +
        "2. Paste your n8n webhook URL into the `CONFIG.webhookUrl` field at the top.\n" +
        "3. Save the file and click 'Retry Request'.\n\n" +
        "All chat layouts, context history, and attachment handlers are ready to transmit.",
        true
      );
      STATE.lastFailedMessage = { text: userText, attachment: attachment };
    }, 600);
    return;
  }

  // 2. Prepare Context History (limited to last turns)
  const activeConv = getActiveConversation();
  const contextHistory = [];
  if (activeConv && activeConv.messages) {
    // Take previous messages excluding the one just added
    const previousMessages = activeConv.messages.slice(0, -1);
    const recent = previousMessages.slice(-CONFIG.maxContextHistory);
    recent.forEach(m => {
      contextHistory.push({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      });
    });
  }

  // 3. Prepare FormData for n8n Webhook (multipart/form-data)
  const formData = new FormData();
  formData.append("message", userText || "");

  if (STATE.activeConversationId) {
    formData.append("conversationId", STATE.activeConversationId);
  }

  // If an actual file (image or video) is attached, append it as field "data"
  if (attachment && attachment.file) {
    formData.append("data", attachment.file, attachment.name);
  }

  // 4. Send POST Request with Timeout (let browser set multipart/form-data boundary)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);

  try {
    const response = await fetch(CONFIG.webhookUrl, {
      method: "POST",
      // Note: Content-Type header is omitted intentionally to allow the browser to set its multipart boundary
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server responded with HTTP status ${response.status} (${response.statusText || "Error"})`);
    }

    // Parse response as JSON (handles both application/json and text/plain containing JSON)
    const rawText = await response.text();
    let responseText = "";

    try {
      const data = JSON.parse(rawText);
      responseText = extractAssistantText(data);
    } catch (e) {
      responseText = extractAssistantText(rawText);
    }

    if (!responseText || responseText.trim() === "") {
      throw new Error("Received an empty response from the workflow.");
    }

    // Success: append assistant response
    removeTypingIndicator();
    STATE.isRequestPending = false;
    STATE.lastFailedMessage = null;
    updateComposerState();

    const assistantMsg = {
      id: generateUUID(),
      sender: "assistant",
      text: responseText,
      timestamp: new Date().toISOString()
    };

    if (activeConv) {
      activeConv.messages.push(assistantMsg);
      activeConv.updatedAt = new Date().toISOString();
      saveConversationsToStorage();
    }

    appendMessageToDOM(assistantMsg, true);

  } catch (error) {
    clearTimeout(timeoutId);
    STATE.isRequestPending = false;
    updateComposerState();
    STATE.lastFailedMessage = { text: userText, attachment: attachment };

    let friendlyError = "Sorry, I couldn't connect to the assistant right now. Please check your connection and try again.";
    if (error.name === "AbortError") {
      friendlyError = "The request timed out. Please try again in a moment.";
    }

    appendErrorBubble(friendlyError, true);
  }
}

/**
 * Extracts the assistant's message from webhook responses.
 * Specifically checks for response.reply and prevents any raw JSON from showing.
 */
function extractAssistantText(data) {
  if (!data) return "";

  // 1. If data is a string, check if it contains stringified JSON
  if (typeof data === "string") {
    let str = data.trim();

    // Strip markdown code fences if wrapped in ```json ... ```
    if (str.startsWith("```")) {
      str = str.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }

    // Try parsing as JSON if it looks like an object or array
    if ((str.startsWith("{") && str.endsWith("}")) || (str.startsWith("[") && str.endsWith("]"))) {
      try {
        const parsed = JSON.parse(str);
        return extractAssistantText(parsed);
      } catch (e) {
        // Fallback regex to extract "reply": "..." if JSON.parse fails
        const replyMatch = str.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/i);
        if (replyMatch && replyMatch[1]) {
          try {
            return JSON.parse(`"${replyMatch[1]}"`);
          } catch (err) {
            return replyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
          }
        }
      }
    }

    // Never display raw SVG, HTML, or debugging dumps in chat
    if (str.startsWith("<") && (str.includes("<svg") || str.includes("<html") || str.includes("<!DOCTYPE"))) {
      return "I received an unreadable response from the assistant. Please try asking again.";
    }

    // If string still has a raw JSON pattern like {"reply": ...}, extract the text
    if (str.startsWith("{") && str.includes('"reply"')) {
      const match = str.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/i);
      if (match && match[1]) {
        return match[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
      }
    }

    return str;
  }

  // 2. If data is an array, inspect the first item
  if (Array.isArray(data) && data.length > 0) {
    return extractAssistantText(data[0]);
  }

  // 3. If data is an object, check response.reply first
  if (typeof data === "object" && data !== null) {
    if (typeof data.reply === "string") {
      return data.reply;
    }
    if (data.reply && typeof data.reply === "object") {
      return extractAssistantText(data.reply);
    }

    // Alternative common fields if reply is absent
    if (typeof data.output === "string") return data.output;
    if (typeof data.response === "string") return data.response;
    if (typeof data.text === "string") return data.text;
    if (typeof data.message === "string") return data.message;
    if (typeof data.content === "string") return data.content;
    if (typeof data.answer === "string") return data.answer;

    // Check nested objects (e.g. data.data.reply or data.body.reply)
    if (data.data && typeof data.data === "object") {
      const nested = extractAssistantText(data.data);
      if (nested) return nested;
    }
    if (data.body && typeof data.body === "object") {
      const nested = extractAssistantText(data.body);
      if (nested) return nested;
    }

    // Check first available string property (excluding IDs/status codes)
    for (const key of Object.keys(data)) {
      if (typeof data[key] === "string" && data[key].trim() && !key.toLowerCase().includes("id") && !key.toLowerCase().includes("status")) {
        return data[key];
      }
    }

    return "";
  }

  return String(data);
}

/* ==========================================================================
   13. SAFE MARKDOWN RENDERING & MEDICAL SECTIONS
   ========================================================================== */
/**
 * Safely renders markdown-like text into HTML without risking XSS or code injection.
 * Parses headers, bold, italics, lists, and gives structured medical sections custom callouts.
 */
function renderSafeMarkdown(rawText) {
  if (!rawText) return "";

  // Normalize literal escaped newlines to ensure paragraph breaks are preserved
  let text = String(rawText).replace(/\\n/g, "\n");

  // 1. Escape all raw HTML entities first (Prevents any executable HTML/script injection)
  text = escapeHTML(text);

  // 2. Identify and format medical structural section titles:
  // e.g. "### What I Understand", "### Possible Explanations", "### When to Seek Medical Help", "### Warning Signs"
  const sections = [
    { title: "What I Understand", icon: "🔍", class: "" },
    { title: "Possible Explanations", icon: "📋", class: "" },
    { title: "What You Can Do Now", icon: "💡", class: "" },
    { title: "When to Seek Medical Help", icon: "🏥", class: "warning" },
    { title: "Warning Signs", icon: "⚠️", class: "emergency" },
    { title: "A Question for You", icon: "💬", class: "" }
  ];

  sections.forEach(sec => {
    // Matches: "### What I Understand" or "**What I Understand:**" or "What I Understand:"
    const regex = new RegExp(`(?:###|\\*\\*|#{1,4})?\\s*(${sec.title})[:*]*`, "gi");
    text = text.replace(regex, `\n\n<div class="med-section-callout ${sec.class}"><div class="med-section-title">${sec.icon} $1</div>\n`);
  });

  // Close opened callout divs at double newlines or end
  text = text.replace(/(<div class="med-section-callout[^>]*>[\s\S]*?)(\n\n|$)/g, "$1</div>\n\n");

  // 3. Headers: ### Header
  text = text.replace(/^### (.*$)/gim, "<h4>$1</h4>");
  text = text.replace(/^## (.*$)/gim, "<h3>$1</h3>");
  text = text.replace(/^# (.*$)/gim, "<h3>$1</h3>");

  // 4. Bold: **text** or __text__
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__(.*?)__/g, "<strong>$1</strong>");

  // 5. Italic: *text* or _text_
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
  text = text.replace(/_(.*?)_/g, "<em>$1</em>");

  // 6. Bullet lists
  text = text.replace(/^\s*[-*]\s+(.*)$/gim, "<li>$1</li>");
  text = text.replace(/(<li>.*<\/li>)/gims, "<ul>$1</ul>");
  // Clean up adjacent duplicate <ul> tags
  text = text.replace(/<\/ul>\s*<ul>/g, "");

  // 7. Numbered lists
  text = text.replace(/^\s*\d+\.\s+(.*)$/gim, "<li>$1</li>");

  // 8. Paragraphs
  const paragraphs = text.split(/\n{2,}/);
  const formattedParagraphs = paragraphs.map(p => {
    p = p.trim();
    if (!p) return "";
    if (p.startsWith("<div") || p.startsWith("<h3") || p.startsWith("<h4") || p.startsWith("<ul") || p.startsWith("<ol")) {
      return p;
    }
    // Replace single newlines with <br>
    return `<p>${p.replace(/\n/g, "<br>")}</p>`;
  });

  return formattedParagraphs.join("");
}

/* ==========================================================================
   14. MODAL MANAGEMENT
   ========================================================================== */
function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = "none";
  document.body.style.overflow = "";
}

function closeAllModals() {
  [DOM.disclaimerModal, DOM.privacyModal, DOM.clearConfirmModal, DOM.imagePreviewModal].forEach(m => {
    if (m) closeModal(m);
  });
}

function checkFirstVisitDisclaimer() {
  try {
    const acked = localStorage.getItem(CONFIG.storagePrefix + "disclaimer_acked");
    if (!acked) {
      // Show disclaimer on initial visit
      setTimeout(() => openModal(DOM.disclaimerModal), 600);
    }
  } catch (e) {}
}

/**
 * Image Enlarged Preview Modal
 */
window.openEnlargedImage = function(src) {
  if (!DOM.imagePreviewModal || !DOM.enlargedPreviewImg) return;
  DOM.enlargedPreviewImg.src = src;
  openModal(DOM.imagePreviewModal);
};

/* ==========================================================================
   15. UTILITIES & HELPERS
   ========================================================================== */
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateUUID() {
  return "med_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 9);
}

function deriveConversationTitle(text) {
  if (!text) return "Health Discussion";
  const clean = text.replace(/[\n\r]+/g, " ").trim();
  if (clean.length <= 32) return clean;
  return clean.substring(0, 32).trim() + "…";
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatTimestamp(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

function scrollToBottom() {
  if (!DOM.messagesContainer) return;
  DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
  if (DOM.scrollBottomBtn) {
    DOM.scrollBottomBtn.style.display = "none";
  }
}

function handleChatScroll() {
  if (!DOM.messagesContainer || !DOM.scrollBottomBtn) return;
  const distanceToBottom = DOM.messagesContainer.scrollHeight - DOM.messagesContainer.scrollTop - DOM.messagesContainer.clientHeight;
  DOM.scrollBottomBtn.style.display = distanceToBottom > 150 ? "flex" : "none";
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Response copied to clipboard", "success");
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    showToast("Response copied to clipboard", "success");
  } catch (e) {
    showToast("Could not copy text to clipboard", "error");
  }
  document.body.removeChild(ta);
}

function showToast(message, type = "info") {
  if (!DOM.toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHTML(message)}</span>
  `;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "all 0.25s ease-out";
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

/* ==========================================================================
   16. VOICE FEATURES (SPEECH RECOGNITION & SPEECH SYNTHESIS)
   Native Web Speech API for voice dictation & spoken responses
   ========================================================================== */

let speechRecognitionInstance = null;
let currentSpeechBaseText = "";
let currentSpeakingBtn = null;

/**
 * Initializes voice elements and preloads speech synthesis voices.
 */
function initVoiceFeatures() {
  // Inject Microphone button if not already in DOM
  let micBtn = document.getElementById("micBtn");
  if (!micBtn && DOM.sendBtn && DOM.sendBtn.parentNode) {
    micBtn = document.createElement("button");
    micBtn.type = "button";
    micBtn.id = "micBtn";
    micBtn.className = "tool-btn mic-btn";
    micBtn.title = "Voice input (Dictate health question)";
    micBtn.setAttribute("aria-label", "Voice input");
    micBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>
      <span class="btn-label-desktop">Voice</span>
    `;

    // Place mic button right beside the send button
    DOM.sendBtn.parentNode.insertBefore(micBtn, DOM.sendBtn);

    micBtn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleVoiceRecognition();
    });
  }

  // Preload speech synthesis voices if supported
  if ("speechSynthesis" in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  // Clean up when user navigates away
  window.addEventListener("beforeunload", () => {
    stopSpokenReply();
    stopVoiceRecognition();
  });
}

/**
 * Toggle speech recognition listening state
 */
function toggleVoiceRecognition() {
  if (STATE.isListening) {
    stopVoiceRecognition();
  } else {
    startVoiceRecognition();
  }
}

/**
 * Starts speech recognition using the browser's Web Speech API
 */
function startVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast("Voice recognition is not supported in this browser. Please try Chrome, Edge, or Safari.", "warning");
    return;
  }

  // Stop any active spoken audio before listening
  stopSpokenReply();

  try {
    speechRecognitionInstance = new SpeechRecognition();
    speechRecognitionInstance.continuous = true;
    speechRecognitionInstance.interimResults = true;
    speechRecognitionInstance.lang = navigator.language || "en-US";

    currentSpeechBaseText = DOM.messageInput ? DOM.messageInput.value : "";

    speechRecognitionInstance.onstart = () => {
      STATE.isListening = true;
      updateMicButtonUI(true);
      showToast("Listening... speak your health question", "info");
    };

    speechRecognitionInstance.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const spoken = (finalTranscript || interimTranscript).trim();
      if (DOM.messageInput && spoken) {
        const spacer = currentSpeechBaseText && !currentSpeechBaseText.endsWith(" ") ? " " : "";
        DOM.messageInput.value = currentSpeechBaseText + spacer + spoken;
        autoGrowTextarea();
        detectEmergencyKeywords();
        updateComposerState();
      }

      if (finalTranscript) {
        currentSpeechBaseText = DOM.messageInput ? DOM.messageInput.value : "";
      }
    };

    speechRecognitionInstance.onerror = (event) => {
      stopVoiceRecognition();
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        showToast("Microphone permission was denied. Please allow microphone access in your browser settings.", "warning");
      } else if (event.error === "no-speech") {
        showToast("No speech was detected. Tap the mic to try speaking again.", "info");
      } else if (event.error !== "aborted") {
        showToast("Voice input: " + event.error, "warning");
      }
    };

    speechRecognitionInstance.onend = () => {
      stopVoiceRecognition();
    };

    speechRecognitionInstance.start();
  } catch (err) {
    stopVoiceRecognition();
    showToast("Unable to access microphone. Please check your browser permissions.", "warning");
  }
}

/**
 * Stops speech recognition
 */
function stopVoiceRecognition() {
  STATE.isListening = false;
  if (speechRecognitionInstance) {
    try {
      speechRecognitionInstance.stop();
    } catch (e) {}
    speechRecognitionInstance = null;
  }
  updateMicButtonUI(false);
  updateComposerState();
}

/**
 * Updates visual state of the microphone button
 */
function updateMicButtonUI(isListening) {
  const micBtn = document.getElementById("micBtn");
  if (!micBtn) return;

  const label = micBtn.querySelector(".btn-label-desktop");

  if (isListening) {
    micBtn.style.color = "#dc2626";
    micBtn.style.backgroundColor = "#fee2e2";
    micBtn.style.borderColor = "#fca5a5";
    micBtn.title = "Listening... tap to stop";
    if (label) label.textContent = "Listening...";
  } else {
    micBtn.style.color = "";
    micBtn.style.backgroundColor = "";
    micBtn.style.borderColor = "";
    micBtn.title = "Voice input (Dictate health question)";
    if (label) label.textContent = "Voice";
  }
}

/**
 * Cleans markdown and formatting for natural text-to-speech output
 */
function cleanTextForSpeech(text) {
  if (!text) return "";
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Reads an assistant response aloud or stops playback if already active
 */
function toggleSpokenReply(text, btn) {
  if (!("speechSynthesis" in window)) {
    showToast("Voice speech playback is not supported in this browser.", "warning");
    return;
  }

  // Tapping while speaking stops playback
  if (currentSpeakingBtn === btn && window.speechSynthesis.speaking) {
    stopSpokenReply();
    return;
  }

  // Stop any other active speech first
  stopSpokenReply();

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "en-US";
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Select an appropriate voice if available
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length > 0) {
    const naturalVoice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha") || v.default));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }
  }

  utterance.onstart = () => {
    currentSpeakingBtn = btn;
    btn.title = "Stop reading aloud";
    btn.style.color = "var(--primary)";
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <rect x="5" y="5" width="14" height="14" rx="2"></rect>
      </svg>
    `;
  };

  const resetBtn = () => {
    btn.title = "Read response aloud";
    btn.style.color = "";
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
    `;
    if (currentSpeakingBtn === btn) {
      currentSpeakingBtn = null;
    }
  };

  utterance.onend = resetBtn;
  utterance.onerror = resetBtn;

  window.speechSynthesis.speak(utterance);
}

/**
 * Stops any active speech synthesis playback
 */
function stopSpokenReply() {
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
  if (currentSpeakingBtn) {
    currentSpeakingBtn.title = "Read response aloud";
    currentSpeakingBtn.style.color = "";
    currentSpeakingBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
    `;
    currentSpeakingBtn = null;
  }
}
