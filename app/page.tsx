import { getUser, signInPath, signInLabel } from "@/lib/platform/runtime";
export const dynamic = "force-dynamic";
import { Studio } from "../components/studio/studio";
export default async function Page() {
  const user = await getUser();
  if (!user)
    return (
      <main className="auth-page">
        <section className="panel">
          <div className="brand">concentrate</div>
          <h1>AI Concentrate</h1>
          <p>ワークスペースにログイン</p>
          <a className="btn primary" href={signInPath()}>
            {signInLabel}
          </a>
          <p className="muted">
            製品の情報と制作物は、ワークスペースごとに保存されます。
          </p>
        </section>
      </main>
    );
  return <Studio user={{ name: user.displayName, email: user.email }} />;
}
