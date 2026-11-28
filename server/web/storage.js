// What a page keeps in the browser, and nothing else: the theme the owner chose (localStorage), and in this tab only
// (sessionStorage) the text the owner typed and has not sent yet, and the time of the one reload through the gate
// (see states.js), and a diagram ID marker for an uncertain move so a reload can explain lost history. No coordinates
// or API response body are kept here, except that a to-do draft key contains the question it answers. Pending decisions and replies are separately kept by pending-actions.js until
// their outcome is known. Storage that is blocked or full keeps nothing, silently.

const DRAFT = 'nexus-draft:';

export function stored(area, key) {
  try {
    return globalThis[area]?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function store(area, key, value) {
  try {
    if (value === null) globalThis[area]?.removeItem(key);
    else globalThis[area]?.setItem(key, value);
  } catch {
    // Kept nowhere.
  }
}

// Unsent text, kept in this tab under a key the screen chooses (such as the address and the field), so that it comes
// back after the page went through the gate (SPEC-048). An empty text forgets it.
export function keepDraft(key, text) {
  store('sessionStorage', DRAFT + key, text === '' ? null : text);
}

export function draftOf(key) {
  return stored('sessionStorage', DRAFT + key) ?? '';
}
