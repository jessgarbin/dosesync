import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import App from '../modal/App';

const HOST_ID = 'rx-scheduler-host';

let shadowRoot: ShadowRoot | null = null;
let isOpen = false;

function getOrCreateHost(): ShadowRoot {
  if (shadowRoot) return shadowRoot;

  const host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);

  shadowRoot = host.attachShadow({ mode: 'closed' });

  // Injeta estilos inline no Shadow DOM (Tailwind + custom)
  const style = document.createElement('style');
  style.textContent = getInlineStyles();
  shadowRoot.appendChild(style);

  // Container para o React
  const appContainer = document.createElement('div');
  appContainer.id = 'rx-app-root';
  shadowRoot.appendChild(appContainer);

  const root = createRoot(appContainer);
  root.render(createElement(App, {
    onShowSettings: () => {
      chrome.runtime.sendMessage({ action: 'open-settings' });
    },
  }));

  return shadowRoot;
}

function getInlineStyles(): string {
  return `
    /* Reset dentro do Shadow DOM */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Overlay backdrop */
    .rx-overlay {
      position: fixed;
      inset: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
      font-family: 'Google Sans', Roboto, Arial, sans-serif;
      animation: rx-fadeIn 0.2s ease-out;
    }

    @keyframes rx-fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes rx-slideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Modal container */
    .rx-modal {
      background: white;
      border-radius: 12px;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
      animation: rx-slideUp 0.25s ease-out;
    }

    /* Header */
    .rx-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
    }

    .rx-header h2 {
      font-size: 18px;
      font-weight: 500;
      color: #202124;
    }

    .rx-close-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      color: #5f6368;
      font-size: 20px;
      line-height: 1;
      transition: background 0.15s;
    }

    .rx-close-btn:hover {
      background: #f1f3f4;
    }

    /* Body */
    .rx-body {
      padding: 24px;
    }

    /* Steps indicator */
    .rx-steps {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 16px 24px 0;
    }

    .rx-step-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #dadce0;
      transition: all 0.2s;
    }

    .rx-step-dot.active {
      background: #1a73e8;
      width: 24px;
      border-radius: 4px;
    }

    .rx-step-dot.completed {
      background: #1a73e8;
    }

    /* Footer navigation */
    .rx-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }

    /* Buttons */
    .rx-btn {
      padding: 8px 24px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
    }

    .rx-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .rx-btn-primary {
      background: #1a73e8;
      color: white;
    }

    .rx-btn-primary:hover:not(:disabled) {
      background: #1557b0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .rx-btn-secondary {
      background: transparent;
      color: #1a73e8;
    }

    .rx-btn-secondary:hover:not(:disabled) {
      background: #e8f0fe;
    }

    .rx-btn-danger {
      background: transparent;
      color: #d93025;
      padding: 4px 8px;
      font-size: 12px;
    }

    .rx-btn-danger:hover {
      background: #fce8e6;
    }

    /* Tabs */
    .rx-tabs {
      display: flex;
      border-bottom: 2px solid #e0e0e0;
      margin-bottom: 16px;
    }

    .rx-tab {
      flex: 1;
      padding: 12px;
      text-align: center;
      cursor: pointer;
      font-size: 14px;
      color: #5f6368;
      border: none;
      background: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.15s;
    }

    .rx-tab.active {
      color: #1a73e8;
      border-bottom-color: #1a73e8;
    }

    /* Upload area */
    .rx-upload-area {
      border: 2px dashed #dadce0;
      border-radius: 8px;
      padding: 40px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s;
      color: #5f6368;
    }

    .rx-upload-area:hover, .rx-upload-area.dragover {
      border-color: #1a73e8;
      background: #e8f0fe;
    }

    .rx-upload-area .icon {
      font-size: 48px;
      margin-bottom: 12px;
      display: block;
    }

    .rx-upload-area .label {
      font-size: 14px;
      margin-bottom: 4px;
    }

    .rx-upload-area .hint {
      font-size: 12px;
      color: #80868b;
    }

    /* Textarea */
    .rx-textarea {
      width: 100%;
      min-height: 200px;
      padding: 12px;
      border: 1px solid #dadce0;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      outline: none;
      transition: border-color 0.15s;
    }

    .rx-textarea:focus {
      border-color: #1a73e8;
    }

    .rx-textarea::placeholder {
      color: #80868b;
    }

    /* Cards */
    .rx-card {
      border: 1px solid #dadce0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      position: relative;
    }

    .rx-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .rx-card-header .pill-icon {
      font-size: 20px;
    }

    .rx-card-header .med-name {
      font-size: 16px;
      font-weight: 500;
      color: #202124;
      flex: 1;
    }

    .rx-card-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .rx-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .rx-field label {
      font-size: 12px;
      color: #5f6368;
      font-weight: 500;
    }

    .rx-field input, .rx-field select {
      padding: 8px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      background: white;
      transition: border-color 0.15s;
    }

    .rx-field input:focus, .rx-field select:focus {
      border-color: #1a73e8;
    }

    .rx-field-full {
      grid-column: 1 / -1;
    }

    /* Timeline */
    .rx-timeline {
      position: relative;
    }

    .rx-timeline-group {
      margin-bottom: 20px;
    }

    .rx-timeline-group-title {
      font-size: 12px;
      font-weight: 500;
      color: #5f6368;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .rx-timeline-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 8px 0;
      position: relative;
    }

    .rx-timeline-item::before {
      content: '';
      position: absolute;
      left: 15px;
      top: 28px;
      bottom: -8px;
      width: 2px;
      background: #e0e0e0;
    }

    .rx-timeline-item:last-child::before {
      display: none;
    }

    .rx-timeline-dot {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: white;
      flex-shrink: 0;
      z-index: 1;
    }

    .rx-timeline-content {
      flex: 1;
    }

    .rx-timeline-time {
      font-size: 14px;
      font-weight: 500;
      color: #202124;
    }

    .rx-timeline-med {
      font-size: 13px;
      color: #5f6368;
    }

    .rx-timeline-ref {
      font-size: 11px;
      color: #80868b;
    }

    .rx-time-edit {
      width: 70px;
      padding: 2px 4px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }

    .rx-time-edit:focus {
      border-color: #1a73e8;
    }

    /* Date picker */
    .rx-date-field {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    .rx-date-field label {
      font-size: 14px;
      color: #5f6368;
    }

    .rx-date-field input {
      padding: 8px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }

    .rx-date-field input:focus {
      border-color: #1a73e8;
    }

    /* Confirm */
    .rx-confirm-list {
      max-height: 300px;
      overflow-y: auto;
    }

    .rx-confirm-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #f1f3f4;
      font-size: 13px;
      color: #202124;
    }

    .rx-confirm-summary {
      background: #e8f0fe;
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
      text-align: center;
    }

    .rx-confirm-summary .count {
      font-size: 24px;
      font-weight: 500;
      color: #1a73e8;
    }

    .rx-confirm-summary .label {
      font-size: 14px;
      color: #5f6368;
    }

    /* Loading */
    .rx-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      gap: 16px;
    }

    .rx-spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #e0e0e0;
      border-top-color: #1a73e8;
      border-radius: 50%;
      animation: rx-spin 0.8s linear infinite;
    }

    @keyframes rx-spin {
      to { transform: rotate(360deg); }
    }

    .rx-loading-text {
      font-size: 14px;
      color: #5f6368;
    }

    /* Error */
    .rx-error {
      background: #fce8e6;
      color: #d93025;
      padding: 12px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 12px;
    }

    /* Success */
    .rx-success {
      text-align: center;
      padding: 40px;
    }

    .rx-success .icon {
      font-size: 48px;
      margin-bottom: 16px;
      display: block;
    }

    .rx-success .title {
      font-size: 18px;
      font-weight: 500;
      color: #202124;
      margin-bottom: 8px;
    }

    .rx-success .desc {
      font-size: 14px;
      color: #5f6368;
    }

    /* Settings panel */
    .rx-settings-toggle {
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      color: #5f6368;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.15s;
    }

    .rx-settings-toggle:hover {
      background: #f1f3f4;
    }

    .rx-settings-panel {
      border: 1px solid #dadce0;
      border-radius: 8px;
      padding: 16px;
      margin-top: 12px;
      background: #f8f9fa;
    }

    .rx-settings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    /* Progress bar */
    .rx-progress {
      width: 100%;
      height: 4px;
      background: #e0e0e0;
      border-radius: 2px;
      overflow: hidden;
      margin-top: 12px;
    }

    .rx-progress-bar {
      height: 100%;
      background: #1a73e8;
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    /* Add medication button */
    .rx-add-med {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 12px;
      border: 2px dashed #dadce0;
      border-radius: 8px;
      background: none;
      cursor: pointer;
      color: #1a73e8;
      font-size: 14px;
      transition: all 0.15s;
    }

    .rx-add-med:hover {
      border-color: #1a73e8;
      background: #e8f0fe;
    }

    /* Scrollbar */
    .rx-modal::-webkit-scrollbar {
      width: 6px;
    }

    .rx-modal::-webkit-scrollbar-track {
      background: transparent;
    }

    .rx-modal::-webkit-scrollbar-thumb {
      background: #dadce0;
      border-radius: 3px;
    }

    .rx-modal::-webkit-scrollbar-thumb:hover {
      background: #bdc1c6;
    }
  `;
}

export function openPrescriptionModal(): void {
  const sr = getOrCreateHost();
  const host = document.getElementById(HOST_ID);
  if (host) host.style.display = 'block';
  isOpen = true;
}

export function closePrescriptionModal(): void {
  const host = document.getElementById(HOST_ID);
  if (host) host.style.display = 'none';
  isOpen = false;
}
