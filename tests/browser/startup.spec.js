import { test, expect } from "@playwright/test";

test("the app loads below a reverse-proxy path with working API and downloads", async ({
  page,
}) => {
  const outsidePrefix = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/portfolio/")) {
      outsidePrefix.push(url.pathname);
      return route.fulfill({ status: 404, body: "Outside app mount" });
    }
    const upstream = new URL(
      url.pathname.slice("/portfolio".length) + url.search,
      url.origin,
    );
    const response = await page.request.fetch(upstream.href, {
      method: route.request().method(),
      data: route.request().postDataBuffer() || undefined,
    });
    await route.fulfill({ response });
  });
  await page.goto("/portfolio/");
  await expect(
    page.getByRole("heading", { name: "차곡차곡, 나의 자산" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "데이터 가져오기" })
    .click();
  await expect(
    page.getByRole("link", { name: "엑셀 내보내기" }),
  ).toHaveAttribute("href", /\/portfolio\/api\/export\.xlsx$/);
  expect(outsidePrefix.filter((p) => p !== "/favicon.ico")).toEqual([]);
});

test("a blocked application bundle displays recovery instructions", async ({
  page,
}) => {
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByText("화면 파일을 불러오지 못했습니다.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "다시 불러오기" }),
  ).toBeVisible();
  await page.unroute("**/assets/*.js");
  await page.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(
    page.getByRole("heading", { name: "차곡차곡, 나의 자산" }),
  ).toBeVisible();
});

test("an HTML API response gives a clear server error and can recover", async ({
  page,
}) => {
  await page.route("**/api/state", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html>frontend only</html>",
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "자산 데이터를 불러오지 못했습니다" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "데이터 서버의 주소가 올바르지 않거나 연결되지 않았습니다.",
      { exact: false },
    ),
  ).toBeVisible();
  await page.unroute("**/api/state");
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(
    page.getByRole("heading", { name: "차곡차곡, 나의 자산" }),
  ).toBeVisible();
});

test("an invalid state response cannot crash into a blank page", async ({
  page,
}) => {
  await page.route("**/api/state", (route) =>
    route.fulfill({ json: { detail: "wrong backend" } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "자산 데이터를 불러오지 못했습니다" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
});

test("a rendering exception shows an error boundary instead of an empty root", async ({
  page,
}) => {
  await page.route("**/api/state", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ json: { ...data, holdings: [null] } });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "화면을 표시하지 못했습니다" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "다시 불러오기" }),
  ).toBeVisible();
});
