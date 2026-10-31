export const STORAGE_KEY = "notes-app:v1";

export function createStore(storage = globalThis.localStorage) {
  // Re-read on every call so changes from other tabs are visible.
  function read() {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { notes: [], unreadable: null };
    try {
      const data = JSON.parse(raw);
      if (data?.version === 1 && Array.isArray(data.notes)) {
        return { notes: data.notes, unreadable: null };
      }
    } catch {
      // Fall through: corrupt JSON is handled like any unreadable data.
    }
    console.warn(`Unreadable data in ${STORAGE_KEY}; starting with an empty list.`);
    return { notes: [], unreadable: raw };
  }

  function write(notes, unreadable) {
    // Never overwrite data we could not read: keep a copy first.
    if (unreadable !== null) {
      storage.setItem(`notes-app:backup:${Date.now()}`, unreadable);
    }
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, notes }));
  }

  function list() {
    return read().notes;
  }

  function save({ id, title, body }) {
    const cleanTitle = (title ?? "").trim();
    if (cleanTitle === "") throw new Error("title is required");

    const { notes, unreadable } = read();
    const now = Date.now();
    const existing = id ? notes.find((n) => n.id === id) : undefined;
    const note = {
      id: id || crypto.randomUUID(),
      title: cleanTitle,
      body: (body ?? "").trim(),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };
    // The saved note is the newest, so putting it first keeps updatedAt descending.
    write([note, ...notes.filter((n) => n.id !== note.id)], unreadable);
    return note;
  }

  function remove(id) {
    const { notes, unreadable } = read();
    const rest = notes.filter((n) => n.id !== id);
    if (rest.length === notes.length) return false;
    write(rest, unreadable);
    return true;
  }

  function search(text) {
    const query = text.trim().toLowerCase();
    const notes = list();
    if (query === "") return notes;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query),
    );
  }

  return { list, save, remove, search };
}
