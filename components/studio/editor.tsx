"use client";
import { useEffect, useState, useRef } from "react";
import { NoIdea } from "./workflow";
import { Download, Plus, Sparkles, FileText, Clapperboard } from "lucide-react";
import {
  productionSchema,
  type Change,
  type ContentItem,
} from "../../lib/domain/models";
import { productionMarkdown } from "../../lib/domain/export";
import { History } from "./history";
import { ProductionSearch } from "./production-search";
import type { StudioController } from "./use-studio";
import { labels, type Tab } from "./i18n";
import { Action, Badge, Empty, Field, Panel } from "./ui";
const tabs: Tab[] = [
  "plan",
  "draft",
  "x",
  "article",
  "reddit",
  "video",
  "guide",
  "locales",
  "assets",
  "updates",
  "review",
];
export function Editor({ s }: { s: StudioController }) {
  const t = labels[s.locale],
    en = s.locale === "en";
  const [itemId, setItemId] = useState(""),
    [outputLocale, setOutputLocale] = useState<"ja" | "en">("ja"),
    [instruction, setInstruction] = useState(""),
    [aspect, setAspect] = useState("16:9"),
    [preview, setPreview] = useState(false);
  const exportMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (
        exportMenu.current &&
        !exportMenu.current.contains(event.target as Node)
      )
        exportMenu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && exportMenu.current?.open) {
        exportMenu.current.open = false;
        exportMenu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const p = s.draft,
    canEdit = s.workspace?.role !== "viewer" && !s.busy;
  const kinds: Partial<Record<Tab, ContentItem["kind"]>> = {
    draft: "draft",
    x: "x",
    article: "article",
    reddit: "reddit",
    video: "scene",
    guide: "step",
  };
  const kind = kinds[s.tab] ?? "draft";
  const items =
    p?.items.filter((i) => i.kind === kind && i.locale === outputLocale) ?? [];
  const selected = items.find((x) => x.id === itemId) ?? items[0];
  function updateItem(fields: Partial<ContentItem>) {
    if (p && selected)
      s.patch({
        items: p.items.map((x) =>
          x.id === selected.id ? { ...x, ...fields } : x,
        ),
      });
  }
  function download(format: "json" | "md") {
    if (!p) return;
    if (exportMenu.current) exportMenu.current.open = false;
    const content =
      format === "json"
        ? JSON.stringify({ schemaVersion: 1, production: p }, null, 2)
        : productionMarkdown(p);
    const url = URL.createObjectURL(
      new Blob([content], {
        type:
          format === "json"
            ? "application/json"
            : "text/markdown;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `concentrate-${s.selected?.id}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function addItem() {
    if (!p || !canEdit || p.items.length >= 100) return;
    const id = crypto.randomUUID();
    s.patch({
      items: [
        ...p.items,
        {
          id,
          kind: kind as ContentItem["kind"],
          locale: outputLocale,
          title: en ? "Untitled" : "新しい項目",
          body: "",
          locked: false,
        },
      ],
    });
    setItemId(id);
  }
  return (
    <>
      <div className="page-heading">
        <h1>{t.content}</h1>
        <div className="actions">
          <Action
            primary
            disabled={!canEdit}
            onClick={() => s.createProduction()}
          >
            <Plus size={16} />
            {t.new}
          </Action>
          <label className="btn">
            <span>{en ? "Import JSON" : "JSONを読み込む"}</span>
            <input
              type="file"
              accept="application/json,.json"
              disabled={!canEdit}
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  if (file.size > 300000)
                    throw Error(
                      en
                        ? "File exceeds 300 KB"
                        : "300KB以下のファイルを選んでください",
                    );
                  const data = JSON.parse(await file.text());
                  if (data.schemaVersion !== 1)
                    throw Error(
                      en
                        ? "Unsupported backup version"
                        : "対応していないバックアップ形式です",
                    );
                  await s.createProduction(
                    false,
                    productionSchema.parse(data.production),
                  );
                } catch {
                  s.setError(
                    en
                      ? "Could not import. Use a valid Concentrate JSON backup under 300 KB."
                      : "読み込めませんでした。300KB以下のConcentrate JSONバックアップを選んでください。",
                  );
                }
              }}
            />
          </label>
        </div>
      </div>
      <nav className="tabs" aria-label={en ? "Content format" : "制作形式"}>
        {tabs.map((tab) => (
          <button
            key={tab}
            aria-current={s.tab === tab ? "page" : undefined}
            onClick={() => s.setTab(tab)}
          >
            {t[tab]}
          </button>
        ))}
      </nav>
      {!p ? (
        <NoIdea s={s} />
      ) : (
        <>
          <div className="identity editor-toolbar">
            <div>
              <h2>{p.title}</h2>
              <span className="muted">
                v{s.selected?.revision} · {s.dirty ? t.unsaved : t.saved}
              </span>
            </div>
            <div className="actions">
              <details className="export-menu" ref={exportMenu}>
                <summary className="btn">
                  <Download size={15} />
                  {en ? "Export" : "書き出す"}
                </summary>
                <div className="export-options">
                  <Action onClick={() => download("md")}>Markdown</Action>
                  <Action onClick={() => download("json")}>
                    {en ? "JSON backup" : "JSONバックアップ"}
                  </Action>
                </div>
              </details>
              <label className="compact-select">
                {en ? "Output language" : "制作言語"}
                <select
                  value={outputLocale}
                  onChange={(e) =>
                    setOutputLocale(e.target.value as "ja" | "en")
                  }
                >
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </label>
              <Action primary onClick={s.save} disabled={!s.dirty || !canEdit}>
                {s.busy ? t.saving : t.save}
              </Action>
            </div>
          </div>
          {s.tab === "plan" ? (
            <fieldset disabled={!canEdit} className="split">
              <Panel>
                <h2>{en ? "Idea brief" : "企画のブリーフ"}</h2>
                <Field
                  label={en ? "Idea title" : "企画名"}
                  value={p.title}
                  onChange={(e) => s.patch({ title: e.target.value })}
                />
                <Field
                  label={en ? "Audience" : "対象"}
                  value={p.persona}
                  onChange={(e) => s.patch({ persona: e.target.value })}
                />
                <Field
                  label={en ? "Message" : "伝えたいこと"}
                  value={p.claim}
                  onChange={(e) => s.patch({ claim: e.target.value })}
                />
                <Field
                  label="CTA"
                  value={p.cta}
                  onChange={(e) => s.patch({ cta: e.target.value })}
                />
                <Field
                  label={en ? "Problem" : "顧客の課題"}
                  value={p.problem}
                  onChange={(e) => s.patch({ problem: e.target.value })}
                  multiline
                />
                <Field
                  label={en ? "Hypothesis" : "施策の仮説"}
                  value={p.hypothesis}
                  onChange={(e) => s.patch({ hypothesis: e.target.value })}
                  multiline
                />
                <Field
                  label={en ? "Destination" : "誘導先"}
                  value={p.destination}
                  onChange={(e) => s.patch({ destination: e.target.value })}
                />
                <Field
                  label={en ? "Metric" : "評価指標"}
                  value={p.metric}
                  onChange={(e) => s.patch({ metric: e.target.value })}
                />
                <Field
                  label={en ? "Review date" : "評価日"}
                  type="date"
                  value={p.evaluationDate}
                  onChange={(e) => s.patch({ evaluationDate: e.target.value })}
                />
              </Panel>
              <Panel>
                <h2>{en ? "Production plan" : "制作計画"}</h2>
                {(
                  [
                    ["draft", "draft"],
                    ["x", "x"],
                    ["article", "article"],
                    ["reddit", "reddit"],
                    ["video", "scene"],
                    ["guide", "step"],
                  ] as const
                ).map(([tab, kind]) => (
                  <button
                    className="list-item channel-plan"
                    key={tab}
                    onClick={() => s.setTab(tab)}
                  >
                    <span>{t[tab]}</span>
                    <Badge>
                      {
                        p.items.filter(
                          (item) => item.kind === kind && item.body.trim(),
                        ).length
                      }{" "}
                      {en ? "written" : "件の原稿"}
                    </Badge>
                  </button>
                ))}
                <Action primary onClick={() => s.setTab("draft")}>
                  {en ? "Write the core draft" : "原稿を書く"}
                </Action>
              </Panel>
            </fieldset>
          ) : s.tab === "review" ? (
            <Review s={s} />
          ) : s.tab === "updates" ? (
            <History s={s} />
          ) : s.tab === "assets" ? (
            <Empty title={en ? "Production assets" : "制作素材"}>
              <p>
                {en
                  ? "Cloud asset upload and rendering are not connected yet."
                  : "素材のクラウド保存・収録・動画書き出しは未接続です。"}
              </p>
              <p>
                {en
                  ? "Prepare your script here, then export Markdown for your production tools."
                  : "台本を整理し、Markdownで書き出して制作ツールへ引き継げます。"}
              </p>
              <div className="actions">
                <Action onClick={() => s.setTab("video")}>{t.video}</Action>
                <Action onClick={() => download("md")}>
                  {en ? "Export production brief" : "制作資料を書き出す"}
                </Action>
              </div>
            </Empty>
          ) : s.tab === "locales" ? (
            <div className="split">
              <Panel>
                <h2>{t.locales}</h2>
                {(["ja", "en"] as const).map((l) => (
                  <button
                    className="list-item"
                    key={l}
                    onClick={() => {
                      setOutputLocale(l);
                      s.setTab("draft");
                    }}
                  >
                    {l === "ja" ? "日本語" : "English"}{" "}
                    <Badge>
                      {p.items.filter((i) => i.locale === l).length}{" "}
                      {en ? "items" : "項目"}
                    </Badge>
                  </button>
                ))}
              </Panel>
              <Panel>
                <h2>{en ? "Independent variants" : "独立した言語版"}</h2>
                <p>
                  {en
                    ? "Switch the output language, add an item and write or generate its content. UI language remains unchanged."
                    : "制作言語を切り替えて項目を追加し、翻訳を入力・生成できます。UIの表示言語は変更しません。"}
                </p>
              </Panel>
            </div>
          ) : (
            <div
              className={
                s.tab === "video" ? "video-layout" : "split content-split"
              }
            >
              <Panel className="selection">
                {s.tab === "video" ? (
                  items.map((i, n) => (
                    <button
                      key={i.id}
                      className={`list-item ${selected?.id === i.id ? "selected" : ""}`}
                      onClick={() => setItemId(i.id)}
                    >
                      {String(n + 1).padStart(2, "0")} {i.title}
                    </button>
                  ))
                ) : (
                  <ProductionSearch key={s.workspaceId} s={s} />
                )}
                <Action disabled={!canEdit} onClick={addItem}>
                  ＋ {en ? "Add item" : "項目を追加"}
                </Action>
              </Panel>
              {s.tab === "video" && (
                <div className="video-center">
                  <button
                    className={`media-preview ${aspect === "9:16" ? "portrait" : ""}`}
                    onClick={() => setPreview(true)}
                    aria-label={
                      en ? "Expand script preview" : "台本プレビューを拡大"
                    }
                  >
                    <Clapperboard size={28} aria-hidden="true" />
                    <strong>
                      {selected?.title ||
                        (en ? "Scene preview" : "シーンプレビュー")}
                    </strong>
                    <p>
                      {selected?.body ||
                        (en
                          ? "Write a scene to preview its script here."
                          : "シーンを書くと、ここで台本を確認できます。")}
                    </p>
                  </button>
                  <small className="muted">
                    {en
                      ? "Script preview · no video rendered"
                      : "台本プレビュー・動画は未生成"}
                  </small>
                  <div className="identity">
                    <Action onClick={() => setPreview(true)}>
                      {en ? "Expand preview" : "プレビューを拡大"}
                    </Action>
                    <select
                      aria-label={en ? "Aspect ratio" : "縦横比"}
                      value={aspect}
                      onChange={(e) => setAspect(e.target.value)}
                    >
                      <option>16:9</option>
                      <option>9:16</option>
                    </select>
                  </div>
                  <Panel>
                    <span className="muted">
                      {en
                        ? "Storyboard · timing not set"
                        : "ストーリーボード · 秒数は未設定"}
                    </span>
                    <div className="timeline">
                      {items.map((i, n) => (
                        <button
                          key={i.id}
                          onClick={() => setItemId(i.id)}
                          aria-pressed={i.id === selected?.id}
                        >
                          {String(n + 1).padStart(2, "0")} {i.title}
                        </button>
                      ))}
                    </div>
                  </Panel>
                </div>
              )}
              <Panel className="writing-panel">
                <div className="section-label">
                  <FileText size={16} />
                  {t[s.tab]}
                </div>
                {items.length > 1 && s.tab !== "video" && (
                  <label className="field">
                    <span>{en ? "Item" : "項目"}</span>
                    <select
                      value={selected?.id}
                      onChange={(e) => setItemId(e.target.value)}
                    >
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!selected ? (
                  <>
                    <h2>
                      {en
                        ? `Create ${t[s.tab]} in ${outputLocale === "ja" ? "Japanese" : "English"}`
                        : `${outputLocale === "ja" ? "日本語" : "英語"}の${t[s.tab]}を作成`}
                    </h2>
                    <Action primary disabled={!canEdit} onClick={addItem}>
                      {en ? "Add content" : "作成する"}
                    </Action>
                  </>
                ) : (
                  <>
                    <Field
                      label={en ? "Title" : "タイトル"}
                      value={selected.title}
                      disabled={!canEdit}
                      onChange={(e) => updateItem({ title: e.target.value })}
                    />
                    <div className="document-body">
                      <Field
                        label={
                          s.tab === "video"
                            ? en
                              ? "Script"
                              : "台本"
                            : en
                              ? "Text"
                              : "本文"
                        }
                        multiline
                        value={selected.body}
                        disabled={
                          !canEdit ||
                          selected.locked ||
                          Boolean(
                            s.selected?.data.items.find(
                              (i) => i.id === selected.id,
                            )?.locked,
                          )
                        }
                        onChange={(e) => updateItem({ body: e.target.value })}
                      />
                    </div>
                    <div className="actions">
                      <Badge>
                        {selected.locale} / {selected.kind}
                      </Badge>
                      <Action
                        disabled={!canEdit}
                        onClick={() => updateItem({ locked: !selected.locked })}
                      >
                        {selected.locked ? t.unlock : t.lock}
                      </Action>
                    </div>
                    {!selected.locked &&
                      s.selected?.data.items.find((i) => i.id === selected.id)
                        ?.locked && (
                        <small role="status">
                          {en
                            ? "Save the unlock before editing text."
                            : "ロック解除を保存すると本文を編集できます。"}
                        </small>
                      )}
                    <div className="ai-composer">
                      <div className="section-label">
                        <Sparkles size={16} />
                        {en ? "Refine with AI" : "AIと磨く"}
                      </div>
                      <div className="instruction-presets">
                        {(en
                          ? [
                              "Draft from the product sources and brief",
                              "Make the opening concise",
                              "Adapt for the target audience",
                            ]
                          : [
                              "製品資料と企画から初稿を作成",
                              "冒頭を短く分かりやすく",
                              "対象ユーザーに合わせて調整",
                            ]
                        ).map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            disabled={!canEdit || selected.locked}
                            onClick={() => setInstruction(prompt)}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                      <Field
                        label={en ? "AI instruction" : "AIへの指示"}
                        disabled={!canEdit || selected.locked}
                        multiline
                        placeholder={
                          en
                            ? "e.g. Shorten the opening and make the audience clear"
                            : "例：冒頭を短くして、誰に向けた内容か明確に"
                        }
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                      />
                      <Action
                        primary
                        disabled={
                          !canEdit ||
                          s.dirty ||
                          !s.caps.ai ||
                          selected.locked ||
                          !instruction.trim()
                        }
                        onClick={() => s.generate(selected.id, instruction)}
                      >
                        {s.busy ? (en ? "Generating…" : "生成中…") : t.generate}
                      </Action>
                      {s.dirty && canEdit && (
                        <Action onClick={s.save}>
                          {en ? "Save draft" : "原稿を保存"}
                        </Action>
                      )}
                      {!s.caps.ai && (
                        <Action onClick={() => s.setView("integrations")}>
                          {en ? "View AI connection" : "AIの接続状況を確認"}
                        </Action>
                      )}
                      <small className="muted">
                        {s.dirty
                          ? en
                            ? "Save before generating."
                            : "保存してから変更案を生成できます。"
                          : !s.caps.ai
                            ? en
                              ? "AI provider configuration required."
                              : "AI生成はサーバー設定待ちです。"
                            : en
                              ? "Sources from this workspace are sent to the AI provider."
                              : "このワークスペースの資料をAIに渡し、変更案を作成します。"}
                      </small>
                    </div>
                  </>
                )}
              </Panel>
            </div>
          )}
        </>
      )}
      {preview && (
        <ReferenceDialog
          en={en}
          title={selected?.title ?? p?.title ?? ""}
          body={selected?.body ?? ""}
          close={() => setPreview(false)}
        />
      )}
    </>
  );
}
function Review({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    cs = s.changes.filter((c) => c.productionId === s.selected?.id),
    // A proposal stays applicable while its target text is unchanged.
    stale = (c: Change) => {
      const target = s.selected?.data.items.find((i) => i.id === c.itemId);
      return !target || target.locked || target.body !== c.before;
    };
  return cs.length ? (
    <div className="stack">
      {cs.map((c) => (
        <Panel key={c.id}>
          <div className="identity">
            <h2>{en ? "Review change" : "変更内容を確認"}</h2>
            <Badge>
              {c.itemId} / v{c.baseRevision}
            </Badge>
          </div>
          <div className="two-col">
            <Field
              label={en ? "Current" : "現在"}
              multiline
              value={c.before}
              readOnly
            />
            <Field
              label={en ? "Proposal" : "変更案"}
              multiline
              value={c.after}
              readOnly
            />
          </div>
          <p className="muted">{c.instruction}</p>
          <Action
            primary
            disabled={
              s.busy || s.dirty || stale(c) || s.workspace?.role === "viewer"
            }
            onClick={() => s.apply(c.id)}
          >
            {labels[s.locale].apply}
          </Action>
          {stale(c) && (
            <small>
              {en
                ? "This proposal targets an older revision."
                : "この変更案の元の版は古くなっています。"}
            </small>
          )}
        </Panel>
      ))}
    </div>
  ) : (
    <Empty title={en ? "No proposals" : "変更案はまだありません"}>
      <p>
        {en
          ? "Generate a revision from a saved item."
          : "保存した原稿やシーンから変更案を生成できます。"}
      </p>
      <Action onClick={() => s.setTab("draft")}>
        {en ? "Open draft" : "原稿を開く"}
      </Action>
    </Empty>
  );
}
function ReferenceDialog({
  en,
  title,
  body,
  close,
}: {
  en: boolean;
  title: string;
  body: string;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="preview-dialog"
      onCancel={close}
      aria-label={en ? "Script preview" : "台本プレビュー"}
    >
      <Action autoFocus onClick={close}>
        {en ? "Close" : "閉じる"}
      </Action>
      <h2>{title}</h2>
      <p className="muted">
        {en
          ? "Script preview · no video rendered"
          : "台本プレビュー・動画は未生成"}
      </p>
      <pre className="script-preview-text">
        {body || (en ? "No script yet" : "台本はまだありません")}
      </pre>
    </dialog>
  );
}
