"use client";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { diffStats, diffText, type DiffPart } from "../../lib/domain/diff";
import type {
  Change,
  ChangeStatus,
  ChangeSummary,
} from "../../lib/domain/models";
import { operation } from "../../lib/studio-client";
import { errorMessage } from "./errors";
import { labels } from "./i18n";
import type { StudioController } from "./use-studio";
import { Action, Badge, Empty, Panel } from "./ui";

type Filter = "open" | Exclude<ChangeStatus, "proposed">;
const WARNING_KINDS: Record<string, [string, string]> = {
  figure: ["数値", "Figure"],
  url: ["URL", "URL"],
};

/** Proposal review: open proposals to decide, plus the decided history. */
export function Proposals({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    [filter, setFilter] = useState<Filter>("open"),
    [checking, setChecking] = useState(false);
  const open = s.changes.filter((c) => c.productionId === s.selected?.id);
  const filters: [Filter, string][] = [
    ["open", en ? `Open (${open.length})` : `未確認（${open.length}）`],
    ["applied", en ? "Applied" : "適用済み"],
    ["rejected", en ? "Rejected" : "却下"],
    ["stale", en ? "Outdated" : "古くなった案"],
  ];
  return (
    <div className="stack">
      <div className="proposal-toolbar">
        <div
          className="segmented"
          role="tablist"
          aria-label={en ? "Proposal status" : "変更案の状態"}
        >
          {filters.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {filter === "open" && (
          <Action
            disabled={s.busy || checking}
            onClick={async () => {
              setChecking(true);
              await s.refreshChanges();
              setChecking(false);
            }}
          >
            <RefreshCw size={14} />
            {en ? "Check for new proposals" : "新しい変更案を確認"}
          </Action>
        )}
      </div>
      {filter === "open" ? (
        open.length ? (
          open.map((c) => <ProposalCard key={c.id} s={s} change={c} />)
        ) : (
          <Empty
            title={en ? "No open proposals" : "未確認の変更案はありません"}
          >
            <p>
              {en
                ? "Ask AI to revise a saved item, or let a connected agent propose text. Every proposal waits here for your decision."
                : "保存した原稿をAIに改稿させるか、接続したエージェントから提案を受け取れます。提案はすべてここで確認してから反映します。"}
            </p>
            <Action onClick={() => s.setTab("draft")}>
              {en ? "Open draft" : "原稿を開く"}
            </Action>
          </Empty>
        )
      ) : (
        <DecidedList
          key={`${s.selected?.id}:${filter}:${s.selected?.revision}`}
          s={s}
          status={filter}
        />
      )}
    </div>
  );
}

function itemLabel(s: StudioController, itemId: string) {
  const item = s.selected?.data.items.find((i) => i.id === itemId);
  if (!item) return { title: itemId, meta: "" };
  const t = labels[s.locale],
    tabOf = {
      draft: t.draft,
      x: t.x,
      article: t.article,
      reddit: t.reddit,
      scene: t.video,
      step: t.guide,
    } as Record<string, string>;
  return {
    title: item.title,
    meta: `${tabOf[item.kind] ?? item.kind} · ${item.locale.toUpperCase()}`,
  };
}

function Origin({ s, change }: { s: StudioController; change: Change }) {
  const en = s.locale === "en",
    o = change.origin;
  if (!o) return <Badge>{en ? "AI proposal" : "AIの提案"}</Badge>;
  if (o.kind === "server_ai")
    return (
      <span className="origin">
        <Sparkles size={14} aria-hidden="true" />
        {en ? "Server AI" : "サーバーAI"} · {o.model}
      </span>
    );
  return (
    <span className="origin">
      <Bot size={14} aria-hidden="true" />
      {en ? "Connected agent" : "接続エージェント"}
      {o.declaredModel ? ` · ${o.declaredModel}` : ""}
    </span>
  );
}

function ProposalCard({
  s,
  change: c,
}: {
  s: StudioController;
  change: Change;
}) {
  const en = s.locale === "en",
    [mode, setMode] = useState<"diff" | "after">("diff");
  const parts = useMemo(() => diffText(c.before, c.after), [c.before, c.after]),
    stats = diffStats(parts);
  const target = s.selected?.data.items.find((i) => i.id === c.itemId);
  // A proposal stays applicable while its target text is unchanged.
  const blocked = !target
    ? en
      ? "The item this proposal edits was removed."
      : "この変更案の対象項目は削除されています。"
    : target.locked
      ? en
        ? "The item is locked. Unlock and save it to apply."
        : "対象項目がロックされています。解除して保存すると適用できます。"
      : target.body !== c.before
        ? en
          ? "The item changed after this proposal was made. Reject it and create a new one."
          : "提案の作成後に本文が変わりました。却下して、新しい変更案を作成してください。"
        : "";
  const { title, meta } = itemLabel(s, c.itemId);
  const viewer = s.workspace?.role === "viewer";
  return (
    <Panel className="proposal-card">
      <div className="proposal-head">
        <div>
          <h2>{title}</h2>
          <small className="muted">
            {meta} · {new Date(c.createdAt).toLocaleString(s.locale)}
          </small>
        </div>
        <Origin s={s} change={c} />
      </div>
      <p className="proposal-instruction">
        <span className="muted">{en ? "Instruction" : "指示"}</span>
        {c.instruction}
      </p>
      {c.origin?.kind === "client_agent" && c.origin.rationale && (
        <p className="proposal-instruction">
          <span className="muted">
            {en ? "Agent's rationale" : "エージェントの説明"}
          </span>
          {c.origin.rationale}
        </p>
      )}
      {c.warnings.length > 0 && (
        <div className="inline-warning" role="note">
          <strong>
            <AlertTriangle size={15} aria-hidden="true" />
            {en
              ? "Check these facts before applying"
              : "反映する前に、次の事実を確認してください"}
          </strong>
          <p>
            {en
              ? "They appear in the proposal but not in the brief, the current text or the referenced sources."
              : "提案に含まれていますが、ブリーフ・現在の本文・参照した資料のどこにも見つかりません。"}
          </p>
          <ul>
            {c.warnings.map((w) => {
              const [kind, ...rest] = w.split(":"),
                label = WARNING_KINDS[kind]?.[en ? 1 : 0];
              return (
                <li key={w}>
                  {label ? `${label}: ` : ""}
                  <code>{label ? rest.join(":") : w}</code>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="proposal-view">
        <div
          className="segmented small"
          role="tablist"
          aria-label={en ? "View" : "表示"}
        >
          <button
            role="tab"
            aria-selected={mode === "diff"}
            onClick={() => setMode("diff")}
          >
            {en ? "Changes" : "差分"}
          </button>
          <button
            role="tab"
            aria-selected={mode === "after"}
            onClick={() => setMode("after")}
          >
            {en ? "Result" : "反映後"}
          </button>
        </div>
        <small
          className="diff-stats"
          aria-label={en ? "Characters changed" : "変更した文字数"}
        >
          <span className="added">+{stats.added.toLocaleString(s.locale)}</span>{" "}
          <span className="removed">
            −{stats.removed.toLocaleString(s.locale)}
          </span>
        </small>
      </div>
      {mode === "diff" ? (
        <DiffView parts={parts} label={en ? "Proposed changes" : "変更箇所"} />
      ) : (
        <div className="diff-text">{c.after}</div>
      )}
      <div className="actions proposal-actions">
        <Action
          primary
          disabled={s.busy || s.dirty || Boolean(blocked) || viewer}
          onClick={() => void s.apply(c.id)}
        >
          <Check size={15} />
          {labels[s.locale].apply}
        </Action>
        <Action
          disabled={s.busy || viewer}
          onClick={() => void s.rejectChange(c.id)}
        >
          <X size={15} />
          {en ? "Reject" : "却下"}
        </Action>
        {(blocked || s.dirty) && (
          <small className="muted" role="status">
            {blocked ||
              (en
                ? "Save your edits before applying a proposal."
                : "変更案を反映する前に、編集中の内容を保存してください。")}
          </small>
        )}
      </div>
    </Panel>
  );
}

/** Inline word diff; insertions and deletions are also announced as text. */
function DiffView({ parts, label }: { parts: DiffPart[]; label: string }) {
  return (
    <div className="diff-text" role="group" aria-label={label}>
      {parts.map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "add" ? (
          <ins key={i}>{p.text}</ins>
        ) : (
          <del key={i}>{p.text}</del>
        ),
      )}
    </div>
  );
}

function DecidedList({
  s,
  status,
}: {
  s: StudioController;
  status: Exclude<ChangeStatus, "proposed">;
}) {
  const en = s.locale === "en";
  const [items, setItems] = useState<ChangeSummary[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [more, setMore] = useState<string | undefined>(),
    [pending, setPending] = useState(true),
    [error, setError] = useState(""),
    [openId, setOpenId] = useState<string | null>(null);
  const productionId = s.selected?.id;
  useEffect(() => {
    if (!productionId) return;
    const c = new AbortController();
    operation(
      "change_list",
      {
        workspaceId: s.workspaceId,
        productionId,
        status,
        limit: 20,
        cursor: more,
      },
      { signal: c.signal },
    )
      .then((r) => {
        const page = r.items as ChangeSummary[];
        setItems((old) => (more ? [...old, ...page] : page));
        setCursor(r.nextCursor);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(errorMessage(e, s.locale));
      })
      .finally(() => {
        if (!c.signal.aborted) setPending(false);
      });
    return () => c.abort();
  }, [s.workspaceId, productionId, s.locale, status, more]);
  if (pending && !items.length)
    return (
      <p className="muted" role="status">
        {en ? "Loading…" : "読み込み中…"}
      </p>
    );
  if (error) return <p role="alert">{error}</p>;
  if (!items.length)
    return (
      <Empty title={en ? "Nothing here yet" : "まだありません"}>
        <p>
          {status === "stale"
            ? en
              ? "Proposals become outdated when their target text changes before a decision."
              : "判断する前に対象の本文が変わった変更案は、ここに移ります。"
            : en
              ? "Decided proposals are listed here for reference."
              : "判断済みの変更案を、記録としてここに表示します。"}
        </p>
      </Empty>
    );
  return (
    <Panel>
      <ul className="decided-list">
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="list-item"
              aria-expanded={openId === c.id}
              onClick={() => setOpenId(openId === c.id ? null : c.id)}
            >
              <span>
                <strong>{itemLabel(s, c.itemId).title}</strong>
                <small>{c.preview}</small>
              </span>
              <span className="decided-meta">
                {c.warnings.length > 0 && (
                  <Badge>
                    {en
                      ? `${c.warnings.length} to check`
                      : `要確認 ${c.warnings.length}`}
                  </Badge>
                )}
                <small>
                  {new Date(c.createdAt).toLocaleDateString(s.locale)}
                </small>
              </span>
            </button>
            {openId === c.id && <DecidedDetail s={s} id={c.id} />}
          </li>
        ))}
      </ul>
      {cursor && (
        <Action
          disabled={pending}
          onClick={() => {
            setPending(true);
            setMore(cursor);
          }}
        >
          {en ? "Load more" : "さらに読み込む"}
        </Action>
      )}
    </Panel>
  );
}

function DecidedDetail({ s, id }: { s: StudioController; id: string }) {
  const en = s.locale === "en";
  const [change, setChange] = useState<Change | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    operation(
      "change_get",
      { workspaceId: s.workspaceId, changeId: id },
      { signal: c.signal },
    )
      .then(setChange)
      .catch((e) => {
        if (!c.signal.aborted) setError(errorMessage(e, s.locale));
      });
    return () => c.abort();
  }, [s.workspaceId, s.locale, id]);
  if (error) return <p role="alert">{error}</p>;
  if (!change)
    return (
      <p className="muted" role="status">
        {en ? "Loading…" : "読み込み中…"}
      </p>
    );
  return (
    <div className="decided-detail">
      <p className="proposal-instruction">
        <span className="muted">{en ? "Instruction" : "指示"}</span>
        {change.instruction}
      </p>
      <Origin s={s} change={change} />
      <DiffView
        parts={diffText(change.before, change.after)}
        label={en ? "Changes" : "変更箇所"}
      />
      {change.decidedAt && (
        <small className="muted">
          {en ? "Decided" : "判断日時"}:{" "}
          {new Date(change.decidedAt).toLocaleString(s.locale)}
          {change.appliedRevision ? ` · v${change.appliedRevision}` : ""}
        </small>
      )}
    </div>
  );
}
