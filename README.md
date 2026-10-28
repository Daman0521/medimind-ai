# MediMind AI — AI Medical Assistant

**Your AI Health Information Companion**

MediMind AI is a modern, responsive healthcare assistant frontend designed to help users explore symptoms, understand medical terminology, and review health reports in an empathetic, calm environment.

---

## 🌟 Key Features

- **Conversational Health Assistant:** Structured guidance covering symptom analysis, preparation for doctor visits, medical terms, and routine wellness questions.
- **Voice Capabilities:**
  - **Dictation (Speech-to-Text):** Tap the microphone button to dictate health questions using the native browser Web Speech API.
  - **Spoken Replies (Text-to-Speech):** Tap the speaker icon on any assistant message to listen to the advice read aloud.
- **Multimodal File Uploads:**
  - Attach images (JPG, PNG, WEBP up to 10 MB) or videos (MP4, WEBM up to 25 MB).
  - Transmits files using JavaScript `FormData` (`multipart/form-data`) under the binary property name `data`.
- **Medical Safety & Disclaimers:**
  - Prominent emergency guidance advising users to dial emergency helplines (e.g., **112** in India, **911** in the USA).
  - Dynamic red-flag detection for critical symptoms (chest pain, shortness of breath, stroke signs).
  - Full Medical Disclaimer and Privacy & Local Storage modals.
- **Privacy-First:**
  - Conversation titles and messages are cached locally in your browser's `localStorage`.
  - Media files are not stored persistently in local storage.
  - One-click "Clear Local History" option.
- **No Framework Dependencies:**
  - Pure HTML5, CSS3, and modern vanilla JavaScript.

---

## 🚀 Getting Started

1. Clone or download this repository:
   ```bash
   git clone https://github.com/Daman0521/medimind-ai.git
   ```
2. Open `index.html` in any modern web browser (Google Chrome, Microsoft Edge, Safari, or Firefox).

---

## ⚙️ Backend Integration (n8n & Google Gemini)

In `script.js`, configure your n8n webhook URL:
```javascript
const CONFIG = {
  webhookUrl: "YOUR_N8N_WEBHOOK_URL",
  requestTimeoutMs: 60000,
  maxImageSizeMB: 10,
  maxVideoSizeMB: 25
};
```

---

## ⚠️ Medical Disclaimer

MediMind AI provides general health information for educational purposes only. It is not a licensed physician, diagnostic instrument, or replacement for professional medical evaluation, diagnosis, or treatment.
