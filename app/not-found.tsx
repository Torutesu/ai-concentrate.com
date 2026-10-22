import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="panel">
        <h1>ページが見つかりません / Page not found</h1>
        <p className="muted">
          URLを確認するか、ワークスペースに戻ってください。/ Check the address
          or return to your workspace.
        </p>
        <Link className="btn primary" href="/">
          ワークスペースへ / Go to workspace
        </Link>
      </section>
    </main>
  );
}
