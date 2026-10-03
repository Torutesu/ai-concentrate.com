"use client";
import { useEffect, useRef, useState } from "react";
import type { Production } from "../../lib/domain/models";
import { api, json } from "../../lib/studio-client";
import type { StudioController } from "./use-studio";
import { Action, Badge, Panel } from "./ui";
type Row = { revision: number; createdAt: string };
type Page = { items: Row[]; nextBefore: number | null };
export function History({ s }: { s: StudioController }) {
  return (
    <HistoryContent
      key={`${s.workspaceId}:${s.selected?.id}:${s.selected?.revision}`}
      s={s}
    />
  );
}
function HistoryContent({ s }: { s: StudioController }) {
  const en = s.locale === "en";
  const [page, setPage] = useState<Page>({ items: [], nextBefore: null });
  const [before, setBefore] = useState<number>();
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [version, setVersion] = useState<number | null>(null);
  useEffect(() => {
    const c = new AbortController();
    api<{ data: Page }>("/operations", {
      method: "POST",
      signal: c.signal,
      body: json({
        name: "production_history",
        arguments: {
          workspaceId: s.workspaceId,
          productionId: s.selected?.id,
          before,
        },
      }),
    })
      .then((r) => {
        if (!c.signal.aborted)
          setPage((p) => ({
            ...r.data,
            items: before
              ? [
                  ...p.items,
                  ...r.data.items.filter(
                    (row) =>
                      !p.items.some((old) => old.revision === row.revision),
                  ),
                ]
              : r.data.items,
          }));
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(String(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setPending(false);
      });
    return () => c.abort();
  }, [s.workspaceId, s.selected?.id, before, retry]);
  return (
    <Panel>
      <h2>{en ? "Revision history" : "編集履歴"}</h2>
      {version !== null && (
        <Snapshot
          key={version}
          s={s}
          revision={version}
          close={() => setVersion(null)}
        />
      )}
      {error && (
        <div role="alert">
          <p>
            {en ? "History could not be loaded" : "履歴を読み込めませんでした"}
          </p>
          <Action
            onClick={() => {
              setError("");
              setPending(true);
              setRetry((r) => r + 1);
            }}
          >
            {en ? "Retry" : "再試行"}
          </Action>
        </div>
      )}
      {page.items.map((r) => (
        <div key={r.revision} className="identity">
          <strong>v{r.revision}</strong>
          <span>{Number.isNaN(Date.parse(r.createdAt)) ? (en ? "Date unavailable" : "日時を取得できません") : new Date(r.createdAt).toLocaleString(s.locale)}</span>
          {r.revision === s.selected?.revision && (
            <Badge>{en ? "Current" : "現在の版"}</Badge>
          )}
          <Action onClick={() => setVersion(r.revision)}>
            {en ? "View revision" : "内容を確認"}
          </Action>
        </div>
      ))}
      {pending && (
        <p role="status">{en ? "Loading history…" : "履歴を読み込み中…"}</p>
      )}
      {page.nextBefore && (
        <Action
          disabled={pending}
          onClick={() => {
            setPending(true);
            setBefore(page.nextBefore!);
          }}
        >
          {en ? "Older revisions" : "さらに前の履歴"}
        </Action>
      )}
    </Panel>
  );
}
function Snapshot({
  s,
  revision,
  close,
}: {
  s: StudioController;
  revision: number;
  close: () => void;
}) {
  const en = s.locale === "en";
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Production>();
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
    const c = new AbortController();
    api<{ data: { data: Production } }>("/operations", {
      method: "POST",
      signal: c.signal,
      body: json({
        name: "production_snapshot",
        arguments: {
          workspaceId: s.workspaceId,
          productionId: s.selected?.id,
          revision,
        },
      }),
    })
      .then((r) => {
        if (!c.signal.aborted) setData(r.data.data);
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError(
            en
              ? "Revision could not be loaded. Close and try again."
              : "内容を読み込めませんでした。閉じてから再度お試しください。",
          );
      });
    return () => c.abort();
  }, [s.workspaceId, s.selected?.id, revision, en]);
  const fields: [keyof Omit<Production, "items">, string][] = [
    ["persona", en ? "Audience" : "対象"],
    ["problem", en ? "Problem" : "課題"],
    ["claim", en ? "Claim" : "主張"],
    ["hypothesis", en ? "Hypothesis" : "仮説"],
    ["cta", "CTA"],
    ["destination", en ? "Destination" : "遷移先"],
    ["metric", en ? "Metric" : "指標"],
    ["evaluationDate", en ? "Review date" : "評価日"],
    ["plannedDate", en ? "Planned date" : "予定日"],
    ["decision", en ? "Decision" : "判断"],
  ];
  return (
    <dialog
      ref={ref}
      className="preview-dialog snapshot-dialog"
      onCancel={close}
      aria-labelledby="snapshot-title"
    >
      <div className="actions snapshot-header">
        <h2 id="snapshot-title">
          v{revision} · {en ? "Saved revision" : "保存した内容"}
        </h2>
        <Action autoFocus onClick={close}>
          {en ? "Close" : "閉じる"}
        </Action>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data && !error && (
        <p role="status">{en ? "Loading…" : "読み込み中…"}</p>
      )}
      {data && (
        <>
          <h3>{data.title}</h3>
          <dl>
            {fields
              .filter(([key]) => data[key])
              .map(([key, label]) => (
                <div key={key}>
                  <dt>
                    <strong>{label}</strong>
                  </dt>
                  <dd
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {data[key]}
                  </dd>
                </div>
              ))}
          </dl>
          {data.items.map((item) => (
            <section key={item.id}>
              <h3>
                {item.title} · {item.kind} · {item.locale}
                {item.locked ? " 🔒" : ""}
              </h3>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {item.body || (en ? "Empty" : "未入力")}
              </p>
            </section>
          ))}
          {revision !== s.selected?.revision && (
            <>
              <p className="muted">
                {en
                  ? "Restore creates a new revision. Save current edits first. Locked text stays protected."
                  : "復元すると新しい版として保存します。編集中の変更は先に保存してください。ロックした本文は保護されます。"}
              </p>
              <Action
                primary
                disabled={s.busy || s.dirty || s.workspace?.role === "viewer"}
                onClick={() => {
                  close();
                  void s.restore(revision);
                }}
              >
                {en
                  ? `Restore v${revision} as a new revision`
                  : `v${revision}を新しい版として復元`}
              </Action>
            </>
          )}
        </>
      )}
    </dialog>
  );
}
