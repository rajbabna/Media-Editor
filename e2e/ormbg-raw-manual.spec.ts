import { expect, test } from "@playwright/test";

test("ORMBg model from raw GitHub works", async ({ page }) => {
  test.setTimeout(300_000);
  page.on("console", (message) => {
    console.log("CONSOLE", message.type(), message.text());
  });
  page.on("pageerror", (error) => {
    console.log("PAGEERROR", error.message);
  });
  page.on("requestfailed", (request) => {
    console.log("REQUEST FAILED", request.url(), request.failure()?.errorText);
  });
  page.on("response", (response) => {
    if (
      response.url().includes("raw.githubusercontent.com") ||
      response.status() >= 400
    ) {
      console.log("HTTP", response.status(), response.url());
    }
  });

  await page.goto("http://127.0.0.1:3200/image.html");

  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 384;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D is unavailable.");
    }
    context.fillStyle = "#dbeafe";
    context.fillRect(0, 0, 512, 384);
    context.fillStyle = "#f97316";
    context.beginPath();
    context.ellipse(256, 210, 110, 150, 0, 0, Math.PI * 2);
    context.fill();
    return canvas.toDataURL("image/png");
  });
  const buffer = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Drop an image here/ }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "subject.png",
    mimeType: "image/png",
    buffer,
  });

  await page.getByRole("button", { name: "Remove background" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Remove background" }).click();

  await page
    .getByText("Couldn't remove the background")
    .or(dialog.getByRole("button", { name: "Apply result" }))
    .waitFor({ timeout: 240_000 })
    .catch(() => {
      console.log("TIMEOUT");
    });

  console.log("DIALOG:", await dialog.innerText());
  await expect(
    dialog.getByRole("button", { name: "Apply result" }),
  ).toBeVisible({ timeout: 1_000 });
});
