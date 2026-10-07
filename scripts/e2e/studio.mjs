// Browser QA against the local Sites Worker (wrangler dev + local D1).
// Identity comes from the gateway headers the Sites runtime trusts, so this
// must only ever target a local server. Run with scripts/e2e/run.sh.
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:8787";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE))
  throw new Error("E2E only targets a local server.");
const REPO = new URL("../../", import.meta.url).pathname;
const OUT = REPO + ".qa/shots/";
const STATE = REPO + ".qa/state";
mkdirSync(OUT, { recursive: true });

const results = [];
async function step(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`ok   ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: String(e).slice(0, 400) });
    console.log(`FAIL ${name}\n     ${String(e).slice(0, 400)}`);
    throw e;
  }
}
const headers = (id) => ({
  "oai-authenticated-user-id": id,
  "oai-authenticated-user-email": `${id}@example.test`,
});

const browser = await chromium.launch();
const problems = [];
async function newPage(
  user,
  { locale = "ja", viewport = { width: 1440, height: 1000 } } = {},
) {
  const context = await browser.newContext({
    extraHTTPHeaders: headers(user),
    viewport,
  });
  await context.addInitScript((l) => {
    try {
      localStorage.setItem("concentrate.locale", l);
    } catch {}
  }, locale);
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`[${user}] console: ${m.text()}`);
  });
  page.on("pageerror", (e) =>
    problems.push(`[${user}] pageerror: ${e.message}`),
  );
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`[${user}] ${r.status()} ${r.url()}`);
  });
  return page;
}
const op = (page, name, args) =>
  page.evaluate(
    async ([name, args]) => {
      const r = await fetch("/api/v1/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, arguments: args }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(body));
      return body.data;
    },
    [name, args],
  );
const nav = (page, label) =>
  page
    .getByRole("navigation", { name: /メインナビゲーション|Main navigation/ })
    .getByRole("button", { name: label, exact: true })
    .click();
const notice = (page, text) =>
  page.locator(".notice", { hasText: text }).waitFor();
const noOverflow = async (page, label) => {
  const { sw, iw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  assert.ok(sw <= iw + 1, `${label}: horizontal overflow ${sw} > ${iw}`);
};

const owner = await newPage("qa_owner");
let workspaceId = "";
const WS = "QA スタジオ";

try {
  await step("create workspace", async () => {
    await owner.goto(BASE + "/");
    await owner.getByLabel("製品・ブランド名").fill(WS);
    await owner.getByRole("button", { name: "作成", exact: true }).click();
    await owner.getByRole("heading", { name: "資料を追加" }).waitFor();
    workspaceId = await owner.evaluate(() =>
      localStorage.getItem("concentrate.workspace"),
    );
    assert.ok(workspaceId);
  });

  await step(
    "add source with secrets shows sensitive-data warning",
    async () => {
      await owner.getByLabel("資料名").fill("連絡先メモ");
      await owner
        .getByLabel("参照する本文")
        .fill(
          "問い合わせ先は sales@example.com です。鍵 sk-proj-abcdefghijklmnopqrstuvwxyz1234 は使わない。検索キーワードの確認用。",
        );
      await owner.getByRole("button", { name: "資料を保存" }).click();
      await owner
        .getByText("保存した資料に機微な情報が含まれています")
        .waitFor();
      await owner
        .getByText(
          /検出：APIキー、メールアドレス|検出：メールアドレス、APIキー/,
        )
        .waitFor();
      await owner.screenshot({
        path: OUT + "01-context-sensitive.png",
        fullPage: true,
      });
      await owner.getByRole("button", { name: "閉じる" }).click();
    },
  );

  await step("long source pages its text on demand", async () => {
    const long =
      Array.from(
        { length: 1500 },
        (_, i) => `行${String(i).padStart(4, "0")}`,
      ).join("。") + "。おわり";
    await owner.getByLabel("資料名").fill("長い製品資料");
    await owner.getByLabel("参照する本文").fill(long);
    await owner.getByRole("button", { name: "資料を保存" }).click();
    await notice(owner, "資料を保存しました");
    // Reload so the list holds a preview only, then open and page.
    await owner.reload();
    await nav(owner, "製品コンテキスト");
    const item = owner.locator("details.source-detail", {
      hasText: "長い製品資料",
    });
    await item.locator("summary").click();
    await item.getByRole("button", { name: "続きを表示" }).waitFor();
    assert.ok(!(await item.locator("pre").innerText()).includes("おわり"));
    await item.getByRole("button", { name: "続きを表示" }).click();
    await item.locator("pre", { hasText: "おわり" }).waitFor();
    assert.equal(
      await item.getByRole("button", { name: "続きを表示" }).count(),
      0,
    );
    assert.equal((await item.locator("pre").innerText()).length, long.length);
  });

  await step("exclude a source from AI and persist it", async () => {
    const item = owner.locator("details.source-detail", {
      hasText: "連絡先メモ",
    });
    await item.locator("summary").click();
    await item.getByLabel("AIの参照に使う").uncheck();
    await notice(owner, "この資料をAIに送らない設定にしました");
    await item.locator(".badge", { hasText: "AIに送らない" }).waitFor();
    await owner.reload();
    await nav(owner, "製品コンテキスト");
    await owner
      .locator("details.source-detail", { hasText: "連絡先メモ" })
      .locator(".badge", { hasText: "AIに送らない" })
      .waitFor();
  });

  await step(
    "passage search highlights matches and reports no results",
    async () => {
      const search = owner.locator(".source-search");
      await search.getByRole("searchbox").fill("検索キーワード");
      await search.getByRole("button", { name: "検索" }).click();
      await search.locator("mark", { hasText: "検索キーワード" }).waitFor();
      await search.getByRole("searchbox").fill("存在しない語句");
      await search.getByRole("button", { name: "検索" }).click();
      await search
        .getByText("「存在しない語句」を含む箇所はありません。")
        .waitFor();
      await owner.screenshot({
        path: OUT + "02-context-library.png",
        fullPage: true,
      });
    },
  );

  await step("delete a source after confirmation", async () => {
    const item = owner.locator("details.source-detail", {
      hasText: "長い製品資料",
    });
    if (!(await item.evaluate((d) => d.open)))
      await item.locator("summary").click();
    await item.getByRole("button", { name: "削除" }).click();
    const dialog = owner.getByRole("dialog");
    await dialog.getByText("「長い製品資料」を削除しますか？").waitFor();
    await dialog.getByRole("button", { name: "削除する" }).click();
    await notice(owner, "資料を削除しました");
    assert.equal(
      await owner
        .locator("details.source-detail", { hasText: "長い製品資料" })
        .count(),
      0,
    );
  });

  await step(
    "owner saves AI policy and brand profile; both persist",
    async () => {
      await nav(owner, "設定");
      await owner.getByText("あなたの月間予算").waitFor();
      await owner.getByLabel(/資料を送らない/).check();
      await owner.getByLabel(/自分の提案だけ適用可/).check();
      await owner.getByLabel(/選んだプロバイダだけ/).check();
      await owner
        .getByText("このデプロイ先にはAIプロバイダが設定されていません。")
        .waitFor();
      await owner.getByRole("button", { name: "ポリシーを保存" }).click();
      await notice(owner, "設定を保存しました");
      await owner.getByLabel("文体・トーン").fill("誇張せず、率直に。");
      await owner.getByRole("button", { name: "用語を追加" }).click();
      await owner.getByLabel("用語 1", { exact: true }).fill("ShogunAI");
      await owner.getByLabel("推奨表記 1").fill("ShogunAI");
      await owner.getByLabel("避ける表記 1").fill("将軍AI、ショーグンAI");
      await owner
        .getByLabel("書いてはいけない主張（1行に1つ）")
        .fill("業界No.1\n必ず成果が出る");
      await owner.getByRole("button", { name: "プロフィールを保存" }).click();
      await notice(owner, "設定を保存しました");
      await owner.screenshot({ path: OUT + "03-settings.png", fullPage: true });
      await owner.reload();
      await nav(owner, "設定");
      assert.ok(await owner.getByLabel(/資料を送らない/).isChecked());
      assert.ok(await owner.getByLabel(/自分の提案だけ適用可/).isChecked());
      assert.equal(
        await owner.getByLabel("文体・トーン").inputValue(),
        "誇張せず、率直に。",
      );
      assert.equal(
        await owner.getByLabel("避ける表記 1").inputValue(),
        "将軍AI, ショーグンAI",
      );
      const stored = await op(owner, "workspace_settings_get", { workspaceId });
      assert.deepEqual(stored.settings.policy, {
        sendSources: "none",
        agentApply: "own_proposals",
        allowedProviders: [],
      });
      assert.deepEqual(stored.settings.profile.prohibitedClaims, [
        "業界No.1",
        "必ず成果が出る",
      ]);
    },
  );

  await step("context view reflects the no-sources policy", async () => {
    await nav(owner, "製品コンテキスト");
    await owner
      .getByText("ワークスペースのポリシーにより、資料はAIに送られません。")
      .waitFor();
  });

  await step(
    "non-owner editor: policy read-only, profile editable, no deletion",
    async () => {
      execFileSync(
        process.execPath,
        [
          "--import",
          "./scripts/sites-env.mjs",
          "./node_modules/wrangler/bin/wrangler.js",
          "d1",
          "execute",
          "DB",
          "--local",
          "--persist-to",
          STATE,
          "--config",
          "dist/server/wrangler.json",
          "--command",
          `INSERT INTO memberships(workspace_id,user_id,role) VALUES('${workspaceId}','qa_editor','editor')`,
        ],
        { cwd: REPO, stdio: "pipe" },
      );
      const editor = await newPage("qa_editor");
      await editor.goto(BASE + "/");
      await nav(editor, "設定");
      await editor.getByText("あなたの月間予算").waitFor();
      assert.ok(await editor.getByLabel(/資料を送らない/).isDisabled());
      assert.equal(
        await editor.getByRole("button", { name: "ポリシーを保存" }).count(),
        0,
      );
      assert.ok(await editor.getByLabel("文体・トーン").isEditable());
      assert.equal(
        await editor
          .getByRole("button", { name: "このワークスペースを削除" })
          .count(),
        0,
      );
      // The server enforces it too.
      await assert.rejects(
        op(editor, "workspace_settings_update", {
          workspaceId,
          baseRevision: 2,
          patch: { policy: { agentApply: "any" } },
        }),
        /FORBIDDEN/,
      );
      await editor.context().close();
    },
  );

  let productionId = "",
    itemId = "";
  await step("create an idea and save a draft through the editor", async () => {
    await nav(owner, "コンテンツ");
    await owner.getByRole("button", { name: "新しい企画" }).first().click();
    await owner
      .getByRole("navigation", { name: "制作形式" })
      .getByRole("button", { name: "原稿", exact: true })
      .click();
    const add = owner
      .locator(".writing-panel")
      .getByRole("button", { name: "作成する" });
    if (await add.count()) await add.click();
    await owner
      .getByLabel("本文", { exact: true })
      .fill(
        "月曜の朝、前回の判断から再開できます。チームは迷わず次の作業に進めます。",
      );
    await owner
      .locator(".editor-toolbar")
      .getByRole("button", { name: "保存する" })
      .click();
    await notice(owner, "保存しました");
    const list = await op(owner, "production_list", { workspaceId });
    productionId = list.items[0].id;
    const detail = await op(owner, "production_get", {
      workspaceId,
      productionId,
    });
    itemId = detail.production.data.items.find(
      (i) => i.kind === "draft" && i.chars > 0,
    ).id;
  });

  await step(
    "agent proposals: diff, origin, fact warning, reject and apply",
    async () => {
      const item = await op(owner, "item_get", {
        workspaceId,
        productionId,
        itemId,
      });
      for (const [key, body] of [
        [
          "qa-1",
          "月曜の朝、前回の判断からすぐ再開できます。満足度は300%向上します。",
        ],
        [
          "qa-2",
          "月曜の朝、前回の判断からすぐ再開できます。チームは迷わず次の作業に進めます。",
        ],
      ])
        await op(owner, "change_propose", {
          workspaceId,
          productionId,
          itemId,
          baseHash: item.item.hash,
          instruction: key === "qa-1" ? "効果を強調" : "冒頭を短く",
          replacement: { body },
          rationale: "QA fixture",
          declaredModel: "qa-model",
          idempotencyKey: key,
        });
      await owner
        .getByRole("navigation", { name: "制作形式" })
        .getByRole("button", { name: "変更案", exact: true })
        .click();
      await owner.getByRole("button", { name: "新しい変更案を確認" }).click();
      await owner.locator(".proposal-card").nth(1).waitFor();
      const cards = owner.locator(".proposal-card");
      assert.equal(await cards.count(), 2);
      const risky = cards.filter({ hasText: "効果を強調" });
      await risky
        .getByText("反映する前に、次の事実を確認してください")
        .waitFor();
      await risky.locator("li", { hasText: "数値: 300%" }).waitFor();
      await risky
        .locator(".origin", { hasText: "接続エージェント · qa-model" })
        .waitFor();
      await risky.locator(".diff-text ins", { hasText: "すぐ" }).waitFor();
      await risky.locator(".diff-text del").first().waitFor();
      await risky.getByText("QA fixture").waitFor();
      await risky.getByRole("tab", { name: "反映後" }).click();
      await risky
        .locator(".diff-text", { hasText: "300%向上します" })
        .waitFor();
      await owner.screenshot({
        path: OUT + "04-proposals.png",
        fullPage: true,
      });
      await risky.getByRole("button", { name: "却下" }).click();
      await notice(owner, "変更案を却下しました");
      const good = cards.filter({ hasText: "冒頭を短く" });
      await good.getByRole("button", { name: "変更を適用" }).click();
      await notice(owner, "変更を適用しました");
      await owner.getByText("未確認の変更案はありません").waitFor();
      await owner
        .getByRole("navigation", { name: "制作形式" })
        .getByRole("button", { name: "原稿", exact: true })
        .click();
      await owner.waitForFunction(
        () =>
          document
            .querySelector(".document-body textarea")
            ?.value.includes("すぐ再開できます"),
        null,
        { timeout: 10000 },
      );
    },
  );

  await step(
    "decided history lists applied and rejected proposals",
    async () => {
      await owner
        .getByRole("navigation", { name: "制作形式" })
        .getByRole("button", { name: "変更案", exact: true })
        .click();
      await owner.getByRole("tab", { name: "適用済み" }).click();
      const row = owner.locator(".decided-list li").first();
      await row.getByRole("button").click();
      await row.locator(".decided-detail .diff-text ins").first().waitFor();
      await row.getByText(/判断日時/).waitFor();
      await owner.getByRole("tab", { name: "却下" }).click();
      await owner
        .locator(".decided-list li")
        .first()
        .getByText("要確認 1")
        .waitFor();
      await owner.screenshot({
        path: OUT + "05-proposal-history.png",
        fullPage: true,
      });
    },
  );

  await step("delete the idea from the editor menu", async () => {
    await owner.getByText("書き出し・その他").click();
    await owner.getByRole("button", { name: "企画を削除" }).click();
    await owner
      .getByRole("dialog")
      .getByRole("button", { name: "削除する" })
      .click();
    await notice(owner, "企画を削除しました");
    const list = await op(owner, "production_list", { workspaceId });
    assert.equal(list.items.length, 0);
  });

  await step(
    "English 390px: settings, context and proposals fit without overflow",
    async () => {
      const mobile = await newPage("qa_owner", {
        locale: "en",
        viewport: { width: 390, height: 844 },
      });
      await mobile.goto(BASE + "/");
      await mobile
        .getByRole("button", { name: "Settings", exact: true })
        .click();
      await mobile.getByText("Your monthly budget").waitFor();
      await mobile.getByText("Never send sources").waitFor();
      await noOverflow(mobile, "settings");
      await mobile.screenshot({
        path: OUT + "06-en-390-settings.png",
        fullPage: true,
      });
      await mobile
        .getByRole("button", { name: "Product context", exact: true })
        .click();
      await mobile
        .getByText("Workspace policy: sources are never sent to AI.")
        .waitFor();
      await noOverflow(mobile, "context");
      await mobile.screenshot({
        path: OUT + "07-en-390-context.png",
        fullPage: true,
      });
      await mobile.context().close();
    },
  );

  await step("delete workspace requires typing its name", async () => {
    await nav(owner, "設定");
    await owner
      .getByRole("button", { name: "このワークスペースを削除" })
      .click();
    const dialog = owner.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: "削除する" });
    assert.ok(await confirm.isDisabled());
    await dialog.getByRole("textbox").fill("違う名前");
    assert.ok(await confirm.isDisabled());
    await dialog.getByRole("textbox").fill(WS);
    await confirm.click();
    await owner
      .getByRole("heading", { name: "ワークスペースを作成" })
      .waitFor();
    const list = await op(owner, "workspace_list", {});
    assert.equal(list.length, 0);
  });
} catch {
  process.exitCode = 1;
} finally {
  if (results.some((r) => !r.ok))
    await owner
      .screenshot({ path: OUT + "failure.png", fullPage: true })
      .catch(() => {});
  console.log(
    JSON.stringify(
      {
        passed: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        problems,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
