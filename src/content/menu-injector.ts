import { openPrescriptionModal } from './modal-host';

const INJECTED_ID = 'rx-scheduler-menu-item';

// Texts that identify the "Create" dropdown in Google Calendar
// (multiple languages for robustness)
const CREATE_MENU_TEXTS = ['event', 'task', 'evento', 'tarefa', 'appointment'];

function findCreateDropdown(): { menu: Element; lastItem: Element } | null {
  // Strategy 1: role="menu" with role="menuitem"
  const menus = document.querySelectorAll('[role="menu"]');
  for (const menu of menus) {
    const items = menu.querySelectorAll('[role="menuitem"]');
    if (items.length >= 2 && isCreateMenu(menu)) {
      return { menu, lastItem: items[items.length - 1]! };
    }
  }

  // Strategy 2: role="listbox" with role="option"
  const listboxes = document.querySelectorAll('[role="listbox"]');
  for (const lb of listboxes) {
    const items = lb.querySelectorAll('[role="option"]');
    if (items.length >= 2 && isCreateMenu(lb)) {
      return { menu: lb, lastItem: items[items.length - 1]! };
    }
  }

  // Strategy 3: any dropdown/popup containing "Event" and "Task" as items
  const popups = document.querySelectorAll('[class*="dropdown"], [class*="popup"], [class*="menu"], ul[role]');
  for (const popup of popups) {
    const children = popup.children;
    if (children.length >= 2 && isCreateMenu(popup)) {
      return { menu: popup, lastItem: children[children.length - 1] as Element };
    }
  }

  // Strategy 4: generic search for recently appeared elements
  // with "Event"/"Task" text as direct children
  const allElements = document.querySelectorAll('div, ul');
  for (const el of allElements) {
    if (el.childElementCount >= 2 && el.childElementCount <= 8 && isCreateMenu(el)) {
      // Check if it looks like a dropdown (absolute/fixed position, high z-index)
      const style = window.getComputedStyle(el);
      const isFloating = style.position === 'absolute' || style.position === 'fixed';
      const hasZIndex = parseInt(style.zIndex || '0') > 0;
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden';

      if (isFloating && hasZIndex && isVisible) {
        const lastChild = el.children[el.childElementCount - 1] as Element;
        return { menu: el, lastItem: lastChild };
      }
    }
  }

  return null;
}

function isCreateMenu(container: Element): boolean {
  const text = container.textContent?.toLowerCase() ?? '';
  // Must contain at least "event" or "evento" AND "task" or "tarefa"
  const hasEvent = text.includes('event') || text.includes('evento');
  const hasTask = text.includes('task') || text.includes('tarefa');
  return hasEvent && hasTask;
}

function injectMenuItem(): void {
  if (document.getElementById(INJECTED_ID)) return;

  const result = findCreateDropdown();
  if (!result) return;

  const { menu, lastItem } = result;


  const clone = lastItem.cloneNode(true) as HTMLElement;
  clone.id = INJECTED_ID;

  // Replace text — find the innermost span with content
  const textSpan = [...clone.querySelectorAll('span')]
    .find(s => s.textContent!.trim().length > 0 && s.children.length === 0);
  if (textSpan) {
    textSpan.textContent = '\u{1F48A} Schedule medications';
  } else {
    // Fallback: replace textContent directly if no span found
    const textNode = clone.querySelector('*:not(:has(*))');
    if (textNode) {
      textNode.textContent = '\u{1F48A} Schedule medications';
    } else {
      clone.textContent = '\u{1F48A} Schedule medications';
    }
  }

  // Remove Google-specific attributes
  clone.removeAttribute('jsaction');
  clone.removeAttribute('jsname');
  clone.removeAttribute('data-value');
  clone.querySelectorAll('[jsaction], [jsname]').forEach(el => {
    el.removeAttribute('jsaction');
    el.removeAttribute('jsname');
  });

  // Remove aria-selected and similar
  clone.removeAttribute('aria-selected');
  clone.removeAttribute('tabindex');

  clone.style.cursor = 'pointer';

  clone.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    // Close the dropdown — try multiple strategies
    const overlay = menu.closest('[role="presentation"]') || menu.closest('[class*="overlay"]');
    if (overlay) {
      overlay.remove();
    } else {
      menu.remove();
    }
    openPrescriptionModal();
  });

  // Visual separator
  const separator = document.createElement('div');
  separator.style.cssText = 'border-top: 1px solid #dadce0; margin: 4px 0;';

  menu.appendChild(separator);
  menu.appendChild(clone);

}

let activeObserver: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function startMenuObserver(): void {
  // Idempotent: avoid stacking multiple observers on HMR / re-injection
  if (activeObserver) return;

  const observer = new MutationObserver((mutations) => {
    // Only care about mutations that add Element nodes (skip text/comment churn)
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(injectMenuItem, 100);
          return;
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  activeObserver = observer;

  // Clean up on page unload to avoid leaking observer/timer across
  // bfcache restores or SPA navigations that tear down the content script
  window.addEventListener('pagehide', stopMenuObserver, { once: true });
}

export function stopMenuObserver(): void {
  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
