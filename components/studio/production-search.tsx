"use client";
import { useEffect, useState } from "react";
import type { ProductionSummary } from "../../lib/domain/models";
import { api, json } from "../../lib/studio-client";
import type { StudioController } from "./use-studio";
import { Action, Field } from "./ui";
type Page = { items: ProductionSummary[]; nextCursor: string | null };
export function ProductionSearch({ s }: { s: StudioController }) {
  const en = s.locale === "en";
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<Page>({ items: [], nextCursor: null });
  const [cursor, setCursor] = useState<string>();
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setPending(true);
        setError("");
        api<{ data: Page }>("/operations", {
          method: "POST",
          signal: controller.signal,
          body: json({
            name: "production_list",
            arguments: {
              workspaceId: s.workspaceId,
              query,
              cursor,
              limit: 20,
            },
          }),
        })
          .then(({ data }) => {
            if (controller.signal.aborted) return;
            setPage((p) =>
              cursor
                ? {
                    ...data,
                    items: [
                      ...p.items,
                      ...data.items.filter(
                        (i) => !p.items.some((old) => old.id === i.id),
                      ),
                    ],
                  }
                : data,
            );
          })
          .catch((e) => {
            if (!controller.signal.aborted) setError(String(e));
          })
          .finally(() => {
            if (!controller.signal.aborted) setPending(false);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [s.workspaceId, s.selected?.revision, query, cursor, retry]);
  return (
    <>
      <Field
        label={en ? "Search titles and text" : "企画名・本文を検索"}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value.slice(0, 200));
          setCursor(undefined);
          setPage({ items: [], nextCursor: null });
          setPending(true);
        }}
      />
      <div aria-live="polite">
        {pending
          ? en
            ? "Searching…"
            : "検索中…"
          : !error && !page.items.length
            ? en
              ? "No matching ideas"
              : "該当する企画はありません"
            : null}
      </div>
      {error && (
        <div role="alert">
          <p>{en ? "Search failed" : "検索できませんでした"}</p>
          <Action onClick={() => setRetry((r) => r + 1)}>
            {en ? "Retry" : "再試行"}
          </Action>
        </div>
      )}
      {page.items.map((x) => (
        <button
          key={x.id}
          disabled={s.busy || pending}
          className={`list-item ${s.selected?.id === x.id ? "selected" : ""}`}
          onClick={() => s.select(x.id)}
        >
          <strong>{x.title}</strong>
          <small>
            v{x.revision} · {x.itemCount} {en ? "items" : "項目"}
          </small>
        </button>
      ))}
      {page.nextCursor && (
        <Action
          disabled={pending || s.busy}
          onClick={() => setCursor(page.nextCursor!)}
        >
          {en ? "Load more results" : "検索結果をさらに表示"}
        </Action>
      )}
    </>
  );
}
