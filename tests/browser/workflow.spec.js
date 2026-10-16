import { test, expect } from "@playwright/test";

test("personal portfolio: asset, DCA, history, duplicate prevention, export and reload", async ({
  page,
  request,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("heading", { name: "차곡차곡, 나의 자산" }).waitFor();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "보유 자산" })
    .click();
  await page.getByRole("button", { name: "자산 추가", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("종목명", { exact: true }).fill("ProShares QLD");
  await dialog.getByLabel("티커 / 표시 이름").fill("QLD");
  await dialog.getByLabel("투자원금 (원)").fill("100000");
  await dialog.getByLabel("현재 평가금액 (원)").fill("110000");
  await dialog.getByLabel("보유 수량 (선택)").fill("10");
  await dialog.getByRole("button", { name: "자산 저장" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "DCA 매수 기록" })
    .click();
  await page.getByRole("button", { name: "계획 추가" }).click();
  await dialog.getByLabel("하루 계획금액 (원)").fill("100000");
  await dialog.getByRole("button", { name: "계획 저장" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "선택한 매수 일괄 기록" }).click();
  await dialog.getByRole("button", { name: "체결 확인 · 기록 저장" }).click();
  await expect(page.getByText("기록 완료", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "선택한 매수 일괄 기록" }),
  ).toBeDisabled();
  const state = await (await request.get("/api/state")).json();
  expect(state.trades).toHaveLength(1);
  expect(state.holdings[0].cost).toBe(200000);
  expect(state.holdings[0].value).toBe(210000);
  expect(state.holdings[0].quantity).toBeNull();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "자산 변동 기록" })
    .click();
  await page.getByRole("button", { name: "자산 기록 추가" }).click();
  await dialog.getByRole("button", { name: "기록 저장" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("cell", { name: "210,000", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("heading", { name: "차곡차곡, 나의 자산" }).waitFor();
  await expect(page.locator(".metric-value").first()).toHaveText("210,000원");
  expect(
    (await request.get("/api/export.xlsx")).headers()["content-type"],
  ).toContain("spreadsheetml");
  expect((await request.get("/api/backup")).status()).toBe(200);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "데이터 가져오기" })
    .click();
  await page.getByRole("button", { name: "스크린샷 인식" }).click();
  await expect(page.getByLabel("스크린샷 파일 선택")).toBeAttached();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "자산 대시보드" })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "차곡차곡, 나의 자산" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("screenshot upload runs local OCR and saves only after review", async ({
  page,
  request,
}) => {
  const { execFileSync } = await import("node:child_process");
  const { id } = await (
    await request.post("/api/holdings", {
      data: {
        broker: "삼성증권",
        account: "해외계좌",
        name: "SGOV",
        ticker: "SGOV",
        cost: 0,
        value: 0,
      },
    })
  ).json();
  await request.post("/api/plans", { data: { holding_id: id, amount: 25000 } });
  const png = execFileSync("python", [
    "-c",
    `
from PIL import Image,ImageDraw,ImageFont
import sys
im=Image.new('RGB',(900,450),'white')
d=ImageDraw.Draw(im)
f=ImageFont.load_default(size=34)
for i,line in enumerate(['Order confirmation','SGOV','Total KRW 25,000','0.25 shares']):
 d.text((50,50+i*85),line,fill='black',font=f)
im.save(sys.stdout.buffer,format='PNG')
`,
  ]);
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "데이터 가져오기" })
    .click();
  await page.getByRole("button", { name: "스크린샷 인식" }).click();
  await page.getByLabel("스크린샷 파일 선택").setInputFiles({
    name: "test-order.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    page.getByRole("heading", { name: "인식 결과를 확인해 주세요" }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.getByLabel("총 체결금액 (원)")).toHaveValue("25000");
  await expect(page.getByLabel("체결 수량 (선택)")).toHaveValue("0.25");
  const before = (await (await request.get("/api/state")).json()).trades.length;
  await page
    .getByRole("button", { name: "내용 확인 · 매수 기록 저장" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "스크린샷 매수 기록을 저장했습니다.",
  );
  const state = await (await request.get("/api/state")).json();
  expect(state.trades).toHaveLength(before + 1);
  const trade = state.trades.find((t) => t.holding_id === id);
  expect(trade.source).toBe("screenshot");
  expect(trade.amount).toBe(25000);
  expect(trade.plan_id).toBeTruthy();
});
