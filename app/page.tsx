import { getUser, signInPath, signInLabel } from "@/lib/platform/runtime";
export const dynamic = "force-dynamic";
import { SignOutButton } from "@clerk/nextjs";
import { Studio } from "../components/studio/studio";
export default async function Page() {
  const user = await getUser();
  if (!user)
    return (
      <main className="auth-page">
        <section className="panel">
          <div className="brand">concentrate</div>
          <h1>AI Concentrate</h1>
          <p>ワークスペースにログイン / Sign in to your workspace</p>
          <a className="btn primary" href={signInPath()}>
            {signInLabel}
          </a>
          <p className="muted">
            製品の情報と制作物は、ワークスペースごとに保存されます。/ Product
            sources and drafts are kept per workspace.
          </p>
        </section>
      </main>
    );
  if (!user.allowed)
    return (
      <main className="auth-page">
        <section className="panel">
          <div className="brand">concentrate</div>
          <h1>利用権限がありません / Access not granted</h1>
          <p>
            このアカウントはこのワークスペースの利用者として登録されていません。
            管理者に、次のIDまたはメールアドレスを許可リストへ追加するよう依頼してください。
          </p>
          <p className="muted">
            This account is not on this deployment&apos;s allowlist. Ask the
            administrator to add the ID or email below.
          </p>
          <p>
            <code>{user.userId}</code>
            {user.email ? (
              <>
                {" · "}
                <code>{user.email}</code>
              </>
            ) : null}
          </p>
          <SignOutButton>
            <button className="btn">
              別のアカウントでログイン / Use another account
            </button>
          </SignOutButton>
        </section>
      </main>
    );
  return <Studio user={{ name: user.displayName, email: user.email }} />;
}
