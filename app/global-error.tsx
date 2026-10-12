"use client";

/** Last-resort boundary for failures in the root layout itself. */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ja">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          padding: "15vh 24px",
          background: "#f6f8f5",
          color: "#182e24",
        }}
      >
        <main style={{ maxWidth: 520, margin: "0 auto" }} role="alert">
          <h1 style={{ fontSize: 22 }}>
            問題が発生しました / Something went wrong
          </h1>
          <p>保存済みの内容は失われていません。/ Your saved work is safe.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #254d38",
              background: "#254d38",
              color: "#fff",
            }}
          >
            再試行 / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
