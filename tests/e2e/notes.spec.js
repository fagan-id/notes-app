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

test.describe("WO-3", () => {
  const status = (page) => page.locator('[aria-live="polite"]');

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await addNote(page, "Belanja", "beras");
    await addNote(page, "Tugas", "laporan");
  });

  test("filters while typing", async ({ page }) => {
    await page.getByLabel("Cari").fill("bel");

    await expect(noteList(page).getByText("Belanja")).toBeVisible();
    await expect(noteList(page).getByText("Tugas")).toBeHidden();
  });

  test("matches body text", async ({ page }) => {
    await page.getByLabel("Cari").fill("LAPORAN");

    await expect(noteList(page).getByText("Tugas")).toBeVisible();
    await expect(noteList(page).getByText("Belanja")).toBeHidden();
  });

  test("shows no-match message", async ({ page }) => {
    await page.getByLabel("Cari").fill("zzz");

    await expect(page.getByText("Tidak ada catatan yang cocok")).toBeVisible();
    await expect(page.getByText("Belum ada catatan")).toBeHidden();
    await expect(noteList(page).getByRole("button")).toHaveCount(0);
  });

  test("clearing search shows all", async ({ page }) => {
    await page.getByLabel("Cari").fill("bel");
    await expect(noteList(page).getByText("Tugas")).toBeHidden();

    await page.getByLabel("Cari").fill("");

    await expect(noteList(page).getByText("Belanja")).toBeVisible();
    await expect(noteList(page).getByText("Tugas")).toBeVisible();
    await expect(page.getByText("Tidak ada catatan yang cocok")).toBeHidden();
  });

  test("announces result count", async ({ page }) => {
    await page.getByLabel("Cari").fill("bel");

    await expect(status(page)).toContainText("1 catatan ditemukan");
  });

  test("keeps the active search after saving", async ({ page }) => {
    await page.getByLabel("Cari").fill("bel");

    await addNote(page, "Beli sabun", "");

    await expect(noteList(page).getByText("Beli sabun")).toBeVisible();
    await expect(noteList(page).getByText("Belanja")).toBeVisible();
    await expect(noteList(page).getByText("Tugas")).toBeHidden();
    await expect(status(page)).toContainText("2 catatan ditemukan");
  });
});

test.describe("WO-4", () => {
  test("serves a valid manifest", async ({ page, request }) => {
    await page.goto("/");

    const link = page.locator('link[rel="manifest"]');
    await expect(link).toHaveCount(1);
    // GitHub Pages serves the app under /notes-app/, so a root path would 404 there.
    expect(await link.getAttribute("href")).not.toMatch(/^\//);

    const manifestUrl = await link.evaluate((el) => el.href);
    const response = await request.get(manifestUrl);
    expect(response.status()).toBe(200);
    const manifest = await response.json();

    expect(manifest.name).toBe("Catatan");
    expect(manifest.display).toBe("standalone");
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");

    for (const icon of manifest.icons) {
      const iconResponse = await request.get(new URL(icon.src, manifestUrl).href);
      expect(iconResponse.status(), icon.src).toBe(200);
      expect(iconResponse.headers()["content-type"], icon.src).toContain("image/png");
    }
  });

  test("works offline after first visit", async ({ page, context }) => {
    await page.goto("/");
    await addNote(page, "Catatan offline", "tetap ada");

    await page.evaluate(() => navigator.serviceWorker.ready);
    // The first visit is not controlled until the worker claims it or the page reloads.
    if (!(await page.evaluate(() => navigator.serviceWorker.controller))) {
      await page.reload();
    }
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole("heading", { name: "Catatan" })).toBeVisible();
    await expect(noteList(page)).toContainText("Catatan offline");

    // Canary: an uncached URL must fail, otherwise the network is still reachable
    // and this test proves nothing.
    const canary = await page.evaluate(() =>
      fetch("./missing-" + Date.now()).then(
        () => "online",
        () => "offline",
      ),
    );
    expect(canary).toBe("offline");
  });
});

test.describe("WO-5", () => {
  const editor = (page) => page.getByLabel("Judul");
  const item = (page, title) => noteList(page).getByRole("button", { name: title });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("cancel discards edits", async ({ page }) => {
    await addNote(page, "Belanja", "beras");

    await item(page, /Belanja/).click();
    await editor(page).fill("Diubah");
    await page.getByRole("button", { name: "Batal" }).click();

    await expect(editor(page)).toBeHidden();
    await expect(item(page, /Belanja/)).toBeVisible();
    await expect(noteList(page)).not.toContainText("Diubah");
    await page.reload();
    await expect(item(page, /Belanja/)).toBeVisible();
    await expect(noteList(page)).not.toContainText("Diubah");
  });

  test("cancel on a new note saves nothing", async ({ page }) => {
    await page.getByRole("button", { name: "Tambah catatan" }).click();
    await editor(page).fill("Draf");
    await page.getByRole("button", { name: "Batal" }).click();

    await expect(editor(page)).toBeHidden();
    await expect(page.getByText("Belum ada catatan")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Belum ada catatan")).toBeVisible();
  });

  test("escape closes the form and returns focus", async ({ page }) => {
    await page.getByRole("button", { name: "Tambah catatan" }).click();
    await editor(page).fill("Draf");

    await page.keyboard.press("Escape");

    await expect(editor(page)).toBeHidden();
    await expect(page.getByRole("button", { name: "Tambah catatan" })).toBeFocused();
    await expect(page.getByText("Belum ada catatan")).toBeVisible();
  });

  test("hides the note being edited until the form closes", async ({ page }) => {
    await addNote(page, "Belanja", "beras");
    await addNote(page, "Tugas", "laporan");

    await item(page, /Belanja/).click();

    await expect(item(page, /Belanja/)).toBeHidden();
    await expect(item(page, /Tugas/)).toBeVisible();

    await page.getByRole("button", { name: "Batal" }).click();

    await expect(item(page, /Belanja/)).toBeVisible();
  });

  test("editing the only note does not show the empty message", async ({ page }) => {
    await addNote(page, "Belanja", "beras");

    await item(page, /Belanja/).click();

    await expect(item(page, /Belanja/)).toBeHidden();
    await expect(page.getByText("Belum ada catatan")).toBeHidden();
  });

  test("other actions are disabled while the form is open", async ({ page }) => {
    await addNote(page, "Belanja", "beras");
    await addNote(page, "Tugas", "laporan");

    await item(page, /Belanja/).click();

    await expect(page.getByRole("button", { name: "Tambah catatan" })).toBeDisabled();
    await expect(item(page, /Tugas/)).toBeDisabled();
    await expect(editor(page)).toHaveValue("Belanja");

    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(page.getByRole("button", { name: "Tambah catatan" })).toBeEnabled();
    await expect(item(page, /Tugas/)).toBeEnabled();
  });
});
