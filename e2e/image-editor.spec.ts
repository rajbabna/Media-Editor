import { statSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

async function createTestImage(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 120;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D is unavailable.");
    }

    context.fillStyle = "#3b82f6";
    context.fillRect(0, 0, 100, 120);
    context.fillStyle = "#f97316";
    context.fillRect(100, 0, 100, 120);
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(100, 60, 30, 0, Math.PI * 2);
    context.fill();

    return canvas.toDataURL("image/png");
  });

  return Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
}

async function createSolidImage(
  page: Page,
  width: number,
  height: number,
  color: string,
): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ width, height, color }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas 2D is unavailable.");
      }
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
      return canvas.toDataURL("image/png");
    },
    { width, height, color },
  );

  return Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
}

async function uploadImage(
  page: Page,
  buffer: Buffer,
  name: string,
): Promise<void> {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Drop an image here/ }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name,
    mimeType: "image/png",
    buffer,
  });
}

test("opens, edits, and exports an image", async ({ page }) => {
  await page.goto("/image");

  const buffer = await createTestImage(page);
  await uploadImage(page, buffer, "test-image.png");

  const size = page.locator("header p");
  await expect(size).toHaveText("200 × 120 px");

  await page.getByRole("button", { name: "Rotate right 90 degrees" }).click();
  await expect(size).toHaveText("120 × 200 px");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(size).toHaveText("200 × 120 px");

  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(size).toHaveText("120 × 200 px");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(size).toHaveText("200 × 120 px");

  await page.getByRole("button", { name: "Crop", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Square" }).click();
  await expect(dialog.getByText("Output: 120 × 120 px")).toBeVisible();
  await dialog.getByRole("button", { name: "Apply crop" }).click();
  await expect(size).toHaveText("120 × 120 px");

  await page.getByRole("button", { name: "Resize", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Width (px)").fill("100");
  await expect(dialog.getByLabel("Height (px)")).toHaveValue("100");
  await dialog.getByRole("button", { name: "Apply resize" }).click();
  await expect(size).toHaveText("100 × 100 px");

  await page.getByRole("button", { name: "Export" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^JPG/ }).click();

  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download JPG" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("test-image.jpg");
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  expect(statSync(filePath as string).size).toBeGreaterThan(0);
});

test("merges images, applies adjustments, and undoes", async ({ page }) => {
  await page.goto("/image");

  const base = await createTestImage(page);
  await uploadImage(page, base, "base.png");

  const size = page.locator("header p");
  await expect(size).toHaveText("200 × 120 px");

  await page.getByRole("button", { name: "Merge", exact: true }).click();
  let dialog = page.getByRole("dialog");

  const second = await createSolidImage(page, 100, 100, "#22c55e");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "second.png",
    mimeType: "image/png",
    buffer: second,
  });

  await expect(dialog.getByText("Result: 320 × 120 px")).toBeVisible();
  await dialog.getByRole("button", { name: "Apply merge" }).click();
  await expect(size).toHaveText("320 × 120 px");
  await expect(page.getByText("Step 1 of 1")).toBeVisible();

  await page.getByRole("button", { name: "Adjust", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Mono" }).click();
  await dialog.getByRole("button", { name: "Apply adjustments" }).click();

  await expect(page.getByText("Step 2 of 2")).toBeVisible();

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText("Step 1 of 2")).toBeVisible();
  await expect(size).toHaveText("320 × 120 px");
});

test("saves a project and reopens it after a reload", async ({ page }) => {
  await page.goto("/image");

  const buffer = await createTestImage(page);
  await uploadImage(page, buffer, "saved.png");

  await page.getByRole("button", { name: "Resize", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Width (px)").fill("100");
  await dialog.getByRole("button", { name: "Apply resize" }).click();
  await expect(page.locator("header p")).toHaveText("100 × 60 px");

  await page.getByRole("button", { name: "Merge", exact: true }).click();
  dialog = page.getByRole("dialog");
  const second = await createSolidImage(page, 100, 100, "#22c55e");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "second.png",
    mimeType: "image/png",
    buffer: second,
  });
  await expect(dialog.getByText("Result: 267 × 100 px")).toBeVisible();
  await dialog.getByRole("button", { name: "Apply merge" }).click();
  await expect(page.locator("header p")).toHaveText("267 × 100 px");

  await page.getByRole("button", { name: "Adjust", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Sepia" }).click();
  await dialog.getByRole("button", { name: "Apply adjustments" }).click();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();

  await page.getByRole("button", { name: "Projects" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill("e2e project");
  await dialog.getByRole("button", { name: "Save project" }).click();
  await expect(
    dialog.getByText("Project saved in this browser."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  await page.reload();
  await expect(page.getByText("Drop an image here")).toBeVisible();

  await page.getByRole("button", { name: "Projects" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByText("e2e project")).toBeVisible();
  await dialog.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.locator("header p")).toHaveText("267 × 100 px");
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
});

test("removes the current image", async ({ page }) => {
  await page.goto("/image");

  const buffer = await createTestImage(page);
  await uploadImage(page, buffer, "remove-me.png");
  await expect(page.locator("header p")).toHaveText("200 × 120 px");

  await page.getByRole("button", { name: "Remove image" }).click();
  await expect(page.getByText("Drop an image here")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export" })).toBeDisabled();
});

test("shows the background removal setup without loading the model", async ({
  page,
}) => {
  await page.goto("/image");

  const buffer = await createTestImage(page);
  await uploadImage(page, buffer, "background.png");

  await page.getByRole("button", { name: "Remove background" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("MODNet (Apache-2.0 license)")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Remove background" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("landing page links to the image editor", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Open image editor/ }).click();
  await expect(page).toHaveURL(/\/image$/);
  await expect(page.getByText("Drop an image here")).toBeVisible();
});
