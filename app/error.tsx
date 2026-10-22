"use client";
import { useEffect } from "react";

/**
 * Shown when rendering fails. Unsaved edits are backed up in this tab every
 * half second, so reloading offers to restore them.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        event: "render_error",
        name: error.name,
        digest: error.digest,
      }),
    );
  }, [error]);
  return (
    <main className="auth-page">
      <section className="panel" role="alert">
        <h1>問題が発生しました / Something went wrong</h1>
        <p>
          画面を表示できませんでした。保存済みの内容は失われていません。未保存の編集は、再読み込み後に復元を選べます。
        </p>
        <p className="muted">
          The screen could not be shown. Saved work is safe; after reloading you
          can restore unsaved edits.
          {error.digest ? ` (${error.digest})` : ""}
        </p>
        <div className="actions">
          <button className="btn primary" type="button" onClick={reset}>
            再試行 / Try again
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => window.location.reload()}
          >
            再読み込み / Reload
          </button>
        </div>
      </section>
    </main>
  );
}
