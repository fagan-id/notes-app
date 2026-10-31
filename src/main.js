import "./style.css";
import { createStore } from "./storage.js";

const store = createStore();

const addButton = document.querySelector("#add-button");
const form = document.querySelector("#editor");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const titleError = document.querySelector("#title-error");
const saveError = document.querySelector("#save-error");
const deleteButton = document.querySelector("#delete-button");
const noteList = document.querySelector("#note-list");
const emptyMessage = document.querySelector("#empty-message");

let editingId = null;

function renderItem(note) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "note";

  // Note text always goes through textContent, never innerHTML.
  const title = document.createElement("span");
  title.className = "note-title";
  title.textContent = note.title;
  button.append(title);

  if (note.body) {
    const body = document.createElement("span");
    body.className = "note-body";
    body.textContent = note.body;
    button.append(body);
  }

  button.addEventListener("click", () => openEditor(note));

  const item = document.createElement("li");
  item.append(button);
  return item;
}

function render() {
  const notes = store.list();
  noteList.replaceChildren(...notes.map(renderItem));
  emptyMessage.hidden = notes.length > 0;
}

function clearErrors() {
  titleError.textContent = "";
  titleInput.removeAttribute("aria-invalid");
  saveError.textContent = "";
}

function openEditor(note = null) {
  editingId = note?.id ?? null;
  titleInput.value = note?.title ?? "";
  bodyInput.value = note?.body ?? "";
  deleteButton.hidden = note === null;
  clearErrors();
  form.hidden = false;
  titleInput.focus();
}

function closeEditor() {
  form.hidden = true;
  form.reset();
  editingId = null;
  clearErrors();
  addButton.focus();
}

addButton.addEventListener("click", () => openEditor());

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearErrors();

  if (titleInput.value.trim() === "") {
    titleError.textContent = "Judul wajib diisi";
    titleInput.setAttribute("aria-invalid", "true");
    titleInput.focus();
    return;
  }

  try {
    store.save({ id: editingId ?? undefined, title: titleInput.value, body: bodyInput.value });
  } catch (error) {
    // Keep the form open with the typed text so nothing is lost.
    console.error(error);
    saveError.textContent = "Gagal menyimpan. Penyimpanan perangkat mungkin penuh.";
    return;
  }

  closeEditor();
  render();
});

deleteButton.addEventListener("click", () => {
  if (!confirm("Hapus catatan ini?")) return;

  try {
    store.remove(editingId);
  } catch (error) {
    console.error(error);
    saveError.textContent = "Gagal menghapus. Coba lagi.";
    return;
  }

  closeEditor();
  render();
});

render();
