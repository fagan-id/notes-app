import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createStore, STORAGE_KEY } from "../../src/storage.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same surface as window.localStorage for the methods the store uses.
function createFakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

let fake;
let store;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  fake = createFakeStorage();
  store = createStore(fake);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("save", () => {
  test("save without id creates a note", () => {
    const note = store.save({ title: "Belanja", body: "beras" });

    expect(note.id).toMatch(UUID);
    expect(note).toEqual({
      id: note.id,
      title: "Belanja",
      body: "beras",
      createdAt: 1000,
      updatedAt: 1000,
    });
    expect(store.list()).toEqual([note]);
  });

  test("save twice without id creates two notes with different ids", () => {
    const a = store.save({ title: "A", body: "" });
    const b = store.save({ title: "B", body: "" });

    expect(a.id).not.toBe(b.id);
    expect(store.list()).toHaveLength(2);
  });

  test("save with empty-string id is treated as a new note", () => {
    const note = store.save({ id: "", title: "A", body: "" });

    expect(note.id).toMatch(UUID);
  });

  test("save trims title and body", () => {
    const note = store.save({ title: "  A ", body: " b " });

    expect(note.title).toBe("A");
    expect(note.body).toBe("b");
  });

  test("save with existing id updates and keeps createdAt", () => {
    const first = store.save({ title: "A", body: "" });
    vi.setSystemTime(2000);

    const updated = store.save({ id: first.id, title: "B", body: "x" });

    expect(updated).toEqual({
      id: first.id,
      title: "B",
      body: "x",
      createdAt: 1000,
      updatedAt: 2000,
    });
    expect(store.list()).toEqual([updated]);
  });

  test("save with unknown id keeps the text", () => {
    store.save({ id: "deleted-in-other-tab", title: "Draf", body: "teks penting" });

    expect(store.list()).toEqual([
      {
        id: "deleted-in-other-tab",
        title: "Draf",
        body: "teks penting",
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]);
  });

  test("save rejects empty title and leaves storage untouched", () => {
    expect(() => store.save({ title: "   ", body: "x" })).toThrow(/title is required/);
    expect(fake.data.size).toBe(0);
  });

  test("setItem errors propagate", () => {
    const quota = new DOMException("full", "QuotaExceededError");
    fake.setItem = () => {
      throw quota;
    };

    let caught;
    try {
      store.save({ title: "A", body: "" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(quota);
  });
});

describe("list", () => {
  test("list is sorted by updatedAt descending", () => {
    const a = store.save({ title: "A", body: "" });
    vi.setSystemTime(2000);
    store.save({ title: "B", body: "" });
    vi.setSystemTime(3000);
    store.save({ title: "C", body: "" });
    vi.setSystemTime(4000);
    store.save({ id: a.id, title: "A2", body: "" });

    expect(store.list().map((n) => n.title)).toEqual(["A2", "C", "B"]);
  });

  test("list returns a copy", () => {
    store.save({ title: "A", body: "" });

    store.list().push({ id: "x", title: "intruder", body: "", createdAt: 0, updatedAt: 0 });

    expect(store.list()).toHaveLength(1);
  });

  test("persists through storage", () => {
    const note = store.save({ title: "A", body: "b" });

    expect(createStore(fake).list()).toEqual([note]);
    expect(JSON.parse(fake.getItem(STORAGE_KEY)).version).toBe(1);
  });

  test("reads changes made by another store on the same storage", () => {
    const otherTab = createStore(fake);

    const note = otherTab.save({ title: "Dari tab lain", body: "" });

    expect(store.list()).toEqual([note]);
  });

  test("empty storage gives an empty list without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(store.list()).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  test("first save on empty storage writes no backup", () => {
    store.save({ title: "A", body: "" });

    expect([...fake.data.keys()]).toEqual([STORAGE_KEY]);
  });
});

describe("remove", () => {
  test("remove deletes only the given note and reports true", () => {
    const a = store.save({ title: "A", body: "" });
    const b = store.save({ title: "B", body: "" });

    expect(store.remove(a.id)).toBe(true);
    expect(store.list()).toEqual([b]);
  });

  test("remove with unknown id reports false and keeps notes", () => {
    const a = store.save({ title: "A", body: "" });

    expect(store.remove("nope")).toBe(false);
    expect(store.list()).toEqual([a]);
  });
});

describe("search", () => {
  beforeEach(() => {
    store.save({ title: "Belanja", body: "beras" });
    vi.setSystemTime(2000);
    store.save({ title: "Tugas", body: "laporan" });
  });

  test("search matches title or body, case-insensitive", () => {
    const titles = (text) => store.search(text).map((n) => n.title);

    expect(titles("BELANJA")).toEqual(["Belanja"]);
    expect(titles("Beras")).toEqual(["Belanja"]);
    expect(titles("lap")).toEqual(["Tugas"]);
    expect(titles("minyak")).toEqual([]);
  });

  test("search ignores surrounding spaces in the query", () => {
    expect(store.search("  tugas ").map((n) => n.title)).toEqual(["Tugas"]);
  });

  test("search with blank text returns all in list order", () => {
    expect(store.search("   ").map((n) => n.title)).toEqual(["Tugas", "Belanja"]);
  });

  test("search keeps list order", () => {
    expect(store.search("a").map((n) => n.title)).toEqual(["Tugas", "Belanja"]);
  });
});

describe("unreadable storage data is not lost", () => {
  test.each([
    ["corrupt JSON", "{oops"],
    ["unknown version", JSON.stringify({ version: 2, notes: [] })],
    ["notes is not an array", JSON.stringify({ version: 1, notes: "x" })],
  ])("%s", (_label, raw) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fake = createFakeStorage({ [STORAGE_KEY]: raw });
    store = createStore(fake);

    expect(store.list()).toEqual([]);
    expect(warn).toHaveBeenCalled();
    expect(fake.getItem(STORAGE_KEY)).toBe(raw);

    const note = store.save({ title: "Baru", body: "" });

    expect(fake.getItem("notes-app:backup:1000")).toBe(raw);
    expect(store.list()).toEqual([note]);
  });
});
