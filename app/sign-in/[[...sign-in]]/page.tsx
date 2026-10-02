import Link from "next/link";
import { ClerkProvider, SignIn } from "@clerk/nextjs";
import { authConfigured } from "@/lib/platform/runtime";
export default function SignInPage() {
  if (!authConfigured())
    return (
      <main className="auth-page">
        <section className="panel">
          <h1>ログインの接続準備中</h1>
          <p>認証サービスの接続が完了すると利用できます。</p>
          <Link className="btn" href="/">
            戻る
          </Link>
        </section>
      </main>
    );
  return (
    <ClerkProvider>
      <main className="auth-page">
        <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/" />
      </main>
    </ClerkProvider>
  );
}
