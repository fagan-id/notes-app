import { test, expect } from "@playwright/test";

async function addNote(page, title, body = "") {
  await page.getByRole("button", { name: "Tambah catatan" }).click();
  await page.getByLabel("Judul").fill(title);
  await page.getByLabel("Isi").fill(body);
  await page.getByRole("button", { name: "Simpan" }).click();
}

const noteList = (page) => page.getByRole("list");

test.describe("WO-2", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows heading and controls", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Catatan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tambah catatan" })).toBeVisible();
    await expect(page.getByLabel("Cari")).toBeVisible();
  });

  test("adds a note", async ({ page }) => {
    await page.getByRole("button", { name: "Tambah catatan" }).click();
    await expect(page.getByLabel("Judul")).toBeFocused();

    await page.getByLabel("Judul").fill("Belanja");
    await page.getByLabel("Isi").fill("beras");
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(noteList(page)).toContainText("Belanja");
    await expect(page.getByLabel("Judul")).toBeHidden();
  });

  test("edits a note", async ({ page }) => {
    await addNote(page, "Belanja", "beras");

    await noteList(page).getByRole("button", { name: /Belanja/ }).click();
    await expect(page.getByLabel("Judul")).toHaveValue("Belanja");
    await page.getByLabel("Judul").fill("Tugas");
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(noteList(page)).toContainText("Tugas");
    await expect(noteList(page)).not.toContainText("Belanja");
  });

  test("deletes a note after confirm", async ({ page }) => {
    await addNote(page, "Belanja", "beras");

    await noteList(page).getByRole("button", { name: /Belanja/ }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Hapus" }).click();

    await expect(page.getByText("Belum ada catatan")).toBeVisible();
    await expect(noteList(page)).not.toContainText("Belanja");
  });

  test("keeps note when delete is cancelled", async ({ page }) => {
    await addNote(page, "Belanja", "beras");

    await noteList(page).getByRole("button", { name: /Belanja/ }).click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Hapus" }).click();

    await expect(noteList(page)).toContainText("Belanja");
    await page.reload();
    await expect(noteList(page)).toContainText("Belanja");
  });

  test("hides delete button for a new note", async ({ page }) => {
    await page.getByRole("button", { name: "Tambah catatan" }).click();

    await expect(page.getByRole("button", { name: "Hapus" })).toBeHidden();
  });

  test("rejects empty title", async ({ page }) => {
    await page.getByRole("button", { name: "Tambah catatan" }).click();
    await page.getByLabel("Judul").fill("   ");
    await page.getByRole("button", { name: "Simpan" }).click();

    const title = page.getByLabel("Judul");
    await expect(page.getByText("Judul wajib diisi")).toBeVisible();
    await expect(title).toHaveAttribute("aria-invalid", "true");
    await expect(title).toHaveAccessibleDescription("Judul wajib diisi");
    await expect(title).toBeVisible();
    await expect(page.getByText("Belum ada catatan")).toBeVisible();
  });

  test("persists after reload", async ({ page }) => {
    await addNote(page, "Belanja", "beras");

    await page.reload();

    await expect(noteList(page)).toContainText("Belanja");
  });

  test("save failure keeps the text", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("full", "QuotaExceededError");
      };
    });
    await page.reload();

    await addNote(page, "Belanja", "beras");

    await expect(page.getByText("Gagal menyimpan")).toBeVisible();
    await expect(page.getByLabel("Judul")).toHaveValue("Belanja");
    await expect(page.getByLabel("Isi")).toHaveValue("beras");
  });

  test("renders HTML as text", async ({ page }) => {
    const html = '<img src=x onerror="window.__xss=1">';

    await addNote(page, html, html);

    await expect(noteList(page)).toContainText(html);
    await expect(noteList(page).locator("img")).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test.describe("at 360px", () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test("no horizontal scroll at 360px", async ({ page }) => {
      await addNote(page, "a".repeat(200), "https://example.com/" + "b".repeat(180));
      await expect(noteList(page)).toContainText("aaaa");

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(360);
    });

    test("touch targets are at least 44px", async ({ page }) => {
      await addNote(page, "Belanja", "beras");
      await noteList(page).getByRole("button", { name: /Belanja/ }).click();
      await expect(page.getByRole("button", { name: "Hapus" })).toBeVisible();

      let checked = 0;
      for (const control of await page.locator("button, input, textarea").all()) {
        if (!(await control.isVisible())) continue;
        const box = await control.boundingBox();
        const label = await control.evaluate((el) => el.outerHTML.slice(0, 80));
        expect(box.width, label).toBeGreaterThanOrEqual(44);
        expect(box.height, label).toBeGreaterThanOrEqual(44);
        checked++;
      }
      // Cari, Tambah catatan, Judul, Isi, Simpan, Hapus, and the list item.
      expect(checked).toBeGreaterThanOrEqual(7);
    });
  });
});
