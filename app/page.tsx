"use client";
import { useState, useRef } from "react";
import {
  FlaskConical,
  LayoutGrid,
  Layers3,
  BookOpen,
  Plus,
  ChevronRight,
  Download,
  Upload,
  Copy,
  Search,
  Video,
  FileText,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import {
  Idea,
  Channel,
  axes,
  channels,
  seeds,
  makePrompt,
  source,
} from "@/lib/content";
export default function Home() {
  const [ideas, setIdeas] = useState<Idea[]>(structuredClone(seeds)),
    [id, setId] = useState("monday"),
    [view, setView] = useState("library"),
    [axis, setAxis] = useState("すべて"),
    [query, setQuery] = useState(""),
    [channel, setChannel] = useState<Channel>("X"),
    [notice, setNotice] = useState(""),
    [dirty, setDirty] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const idea = ideas.find((i) => i.id === id) || ideas[0];
  function update(p: Partial<Idea>) {
    setIdeas((s) =>
      s.map((i) =>
        i.id === idea.id ? { ...i, ...p, revision: i.revision + 1 } : i,
      ),
    );
    setDirty(true);
  }
  function open(id: string) {
    setId(id);
    setView("editor");
  }
  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      setNotice("コピーしました");
    } catch {
      setNotice(
        "コピーできませんでした。テキストを選択してコピーしてください。",
      );
    }
  }
  function save() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 1, ideas }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "concentrate-shogunai.json";
    a.click();
    URL.revokeObjectURL(url);
    setDirty(false);
    setNotice("企画一式を書き出しました");
  }
  async function restore(f?: File) {
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (
        d.version !== 1 ||
        !Array.isArray(d.ideas) ||
        !d.ideas.length ||
        d.ideas.length > 200
      )
        throw Error();
      const ids = new Set();
      for (const i of d.ideas) {
        for (const k of [
          "id",
          "title",
          "axis",
          "persona",
          "problem",
          "claim",
          "plot",
          "body",
          "scenes",
          "evidence",
          "status",
        ])
          if (typeof i[k] !== "string") throw Error();
        if (ids.has(i.id)) throw Error();
        ids.add(i.id);
        if (
          !i.outputs ||
          typeof i.outputs !== "object" ||
          Array.isArray(i.outputs) ||
          Object.entries(i.outputs).some(
            ([k, v]) =>
              !channels.includes(k as Channel) || typeof v !== "string",
          ) ||
          typeof i.revision !== "number"
        )
          throw Error();
      }
      if (dirty && !confirm("編集中の内容を、読み込む企画で置き換えますか？"))
        return;
      setIdeas(d.ideas);
      setId(d.ideas[0].id);
      setDirty(false);
      setNotice("企画を読み込みました");
    } catch {
      setNotice("書き出した企画JSONを選んでください");
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  function add() {
    const id = crypto.randomUUID();
    setIdeas((s) => [
      ...s,
      {
        id,
        title: "新しい企画",
        axis: "ユースケース",
        persona: "",
        problem: "",
        claim: "",
        plot: "",
        body: "",
        scenes: "",
        evidence: "",
        status: "企画",
        outputs: {},
        revision: 0,
      },
    ]);
    setDirty(true);
    open(id);
  }
  const field = (key: keyof Idea, label: string, rows = 3) => (
    <label className="field">
      <span>{label}</span>
      <textarea
        rows={rows}
        value={String(idea[key])}
        onChange={(e) => update({ [key]: e.target.value })}
      />
    </label>
  );
  const names: Record<string, string> = {
    library: "企画ライブラリ",
    editor: "原液エディタ",
    outputs: "媒体別ドラフト",
    brand: "ブランドの土台",
  };
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="logo"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("library");
          }}
        >
          <FlaskConical />
          concentrate<sup>AI</sup>
        </a>
        <div className="workspace">
          <b className="mark">将</b>
          <div>
            <strong>ShogunAI</strong>
            <small>Marketing workspace</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            [LayoutGrid, "library"],
            [FlaskConical, "editor"],
            [Layers3, "outputs"],
            [BookOpen, "brand"],
          ].map(([Icon, v]) => {
            const I = Icon as typeof LayoutGrid;
            return (
              <button
                key={String(v)}
                className={view === v ? "active" : ""}
                onClick={() => setView(String(v))}
              >
                <I size={18} />
                {names[String(v)]}
              </button>
            );
          })}
        </nav>
        <div className="phase">
          <small>01 / 03</small>
          <strong>まず、原液を磨こう。</strong>
          <p>企画と編集フローの試作</p>
          <div className="track">
            <i />
          </div>
          <p>次に AI生成、その先に動画制作。</p>
        </div>
      </aside>
      <div className="main-shell">
        <header>
          <div className="breadcrumb">
            ShogunAI <ChevronRight size={14} />
            <span>{names[view]}</span>
          </div>
          <div className="actions">
            <span className="prototype">PROTOTYPE</span>
            <button
              className="icon"
              aria-label="企画を読み込む"
              onClick={() => file.current?.click()}
            >
              <Upload size={18} />
            </button>
            <button className="button secondary" onClick={save}>
              <Download size={15} />
              書き出す{dirty ? " *" : ""}
            </button>
            <input
              ref={file}
              hidden
              type="file"
              accept=".json,application/json"
              onChange={(e) => restore(e.target.files?.[0])}
            />
          </div>
        </header>
        <main>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button aria-label="通知を閉じる" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {view === "library" && (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">IDEAS BEFORE CONTENT</div>
                  <h1>
                    いいコンテンツは、
                    <br />
                    いい原液から。
                  </h1>
                  <p>伝えたいことを磨いて、届け方を広げる。</p>
                </div>
                <button className="button primary" onClick={add}>
                  <Plus size={17} />
                  新しい企画
                </button>
              </div>
              <section className="featured">
                <div>
                  <div className="eyebrow lime">PICK UP / 最初の一本</div>
                  <h2>{ideas[0].title}</h2>
                  <p>一つの困る瞬間から、原液と媒体別の表現を見てみよう。</p>
                  <button
                    className="button light"
                    onClick={() => open(ideas[0].id)}
                  >
                    原液を編集する
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="flow">
                  <div className="flask">
                    <FlaskConical size={28} />
                    <small>ひとつの原液</small>
                  </div>
                  <div className="line" />
                  <div className="destinations">
                    <span>𝕏　気づきを届ける</span>
                    <span>
                      <FileText size={16} />
                      深く伝える
                    </span>
                    <span>
                      <Video size={16} />
                      場面で見せる
                    </span>
                  </div>
                </div>
              </section>
              <div className="section-head">
                <h2>
                  企画ライブラリ <small>{ideas.length}</small>
                </h2>
                <label className="search">
                  <Search size={16} />
                  <input
                    aria-label="企画を検索"
                    placeholder="企画・ペルソナを検索"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="filters">
                {["すべて", ...axes].map((a) => (
                  <button
                    key={a}
                    className={axis === a ? "selected" : ""}
                    onClick={() => setAxis(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div className="cards">
                {ideas
                  .filter(
                    (i) =>
                      (axis === "すべて" || i.axis === axis) &&
                      `${i.title}${i.persona}${i.problem}`.includes(query),
                  )
                  .map((i) => (
                    <button
                      className="card"
                      key={i.id}
                      onClick={() => open(i.id)}
                    >
                      <div className="card-top">
                        <span className={"axis a" + axes.indexOf(i.axis)}>
                          {i.axis}
                        </span>
                        <small>
                          {String(ideas.indexOf(i) + 1).padStart(2, "0")}
                        </small>
                      </div>
                      <h3>{i.title}</h3>
                      <p>{i.problem || "誰の、どんな困りごとを解決する？"}</p>
                      <div className="persona">
                        {i.persona || "ペルソナ未設定"}
                      </div>
                      <div className="card-bottom">
                        <span>{i.status}</span>
                        <span>
                          {Object.values(i.outputs).filter(Boolean).length} / 5
                          媒体 <ChevronRight size={14} />
                        </span>
                      </div>
                    </button>
                  ))}
                <button className="new-card" onClick={add}>
                  <span>
                    <Plus size={24} />
                  </span>
                  <b>次の原液をつくる</b>
                  <p>まだ、思いつきのままで大丈夫。</p>
                </button>
              </div>
            </>
          )}
          {(view === "editor" || view === "outputs") && (
            <>
              <div className="editor-heading">
                <div>
                  <div className="eyebrow">
                    CONCENTRATE / {view === "editor" ? "原液" : "展開"}
                  </div>
                  <h1>{idea.title}</h1>
                </div>
                <select
                  aria-label="編集する企画"
                  value={idea.id}
                  onChange={(e) => setId(e.target.value)}
                >
                  {ideas.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="steps">
                <button
                  className={view === "editor" ? "current" : ""}
                  onClick={() => setView("editor")}
                >
                  01　原液を磨く
                </button>
                <ChevronRight size={15} />
                <button
                  className={view === "outputs" ? "current" : ""}
                  onClick={() => setView("outputs")}
                >
                  02　媒体へ展開する
                </button>
                <ChevronRight size={15} />
                <span>03　制作・公開へ</span>
              </div>
              {view === "editor" ? (
                <div className="editor-grid">
                  <section className="paper">
                    <div className="paper-head">
                      <h2>
                        <FlaskConical size={20} />
                        企画の原液
                      </h2>
                      <small>編集可能</small>
                    </div>
                    <label className="field">
                      <span>企画タイトル</span>
                      <input
                        value={idea.title}
                        onChange={(e) => update({ title: e.target.value })}
                      />
                    </label>
                    <div className="field-row">
                      <label className="field">
                        <span>企画軸</span>
                        <select
                          value={idea.axis}
                          onChange={(e) => update({ axis: e.target.value })}
                        >
                          {axes.map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>編集ステータス</span>
                        <select
                          value={idea.status}
                          onChange={(e) => update({ status: e.target.value })}
                        >
                          {[
                            "企画",
                            "原液を編集",
                            "媒体を編集",
                            "制作に渡せる",
                          ].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {field("persona", "誰に届けるか", 2)}
                    {field("problem", "その人が困る瞬間")}
                    {field("claim", "一番残したい主張", 2)}
                    {field("plot", "物語の骨格", 5)}
                    {field("body", "原液の本文", 10)}
                    <div className="paper-bottom">
                      <small>
                        ドラフト v{idea.revision + 1} · 画面内で編集中
                      </small>
                      <button
                        className="button primary"
                        onClick={() => setView("outputs")}
                      >
                        媒体別ドラフトへ
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </section>
                  <aside className="context">
                    <section>
                      <div className="eyebrow">HUMAN TOUCH</div>
                      <h3>あなたが足す、具体。</h3>
                      <p>
                        リアルな場面や独自の視点が、企画をあなたのものにする。
                      </p>
                      {field("scenes", "シーン・演出・体験", 8)}
                    </section>
                    <section>
                      <div className="eyebrow">SOURCE OF TRUTH</div>
                      <h3>根拠を一緒に持つ。</h3>
                      {field("evidence", "製品情報・検証メモ", 7)}
                      <a href={source} target="_blank" rel="noreferrer">
                        ShogunAI 公式サイト
                        <ArrowUpRight size={14} />
                      </a>
                    </section>
                    <section className="white">
                      <Sparkles size={20} />
                      <h3>AI生成は、次のステップ。</h3>
                      <p>
                        今は企画・編集フローの試作です。現在の内容からAIに渡す指示をコピーできます。
                      </p>
                      <button
                        className="button secondary"
                        onClick={() => copy(makePrompt(idea))}
                      >
                        <Copy size={14} />
                        生成指示をコピー
                      </button>
                    </section>
                  </aside>
                </div>
              ) : (
                <>
                  <div className="output-layout">
                    <aside className="channel-nav">
                      <h2>届け方を選ぶ</h2>
                      {channels.map((c) => (
                        <button
                          key={c}
                          className={channel === c ? "active" : ""}
                          onClick={() => setChannel(c)}
                        >
                          <span>
                            {c.includes("動画") ? (
                              <Video size={17} />
                            ) : (
                              <FileText size={17} />
                            )}{" "}
                            {c}
                          </span>
                          <small>{idea.outputs[c] ? "✓" : "＋"}</small>
                        </button>
                      ))}
                      <p>
                        原液を修正しても、媒体別の編集内容は上書きされません。
                      </p>
                    </aside>
                    <section className="paper">
                      <div className="paper-head">
                        <h2>{channel}</h2>
                        <small>公開前のドラフト</small>
                      </div>
                      <div className="guidance">
                        {channel === "X"
                          ? "一つの気づきを、短く。"
                          : channel === "記事"
                            ? "背景・根拠・具体例を、じっくり。"
                            : channel === "Reddit"
                              ? "投稿先のルールを確認し、関係性を明示して議論へ。"
                              : channel === "ショート動画"
                                ? "一つの困る瞬間と変化を、30秒で。"
                                : "問題提起から実演・解説まで、一つの物語に。"}
                      </div>
                      <label className="field">
                        <span>本文・台本</span>
                        <textarea
                          className="output-text"
                          value={idea.outputs[channel] || ""}
                          onChange={(e) =>
                            update({
                              outputs: {
                                ...idea.outputs,
                                [channel]: e.target.value,
                              },
                            })
                          }
                          placeholder="まだ下書きがありません。生成指示をコピーしてAIで作るか、ここで書き始めてください。"
                        />
                      </label>
                      <div className="output-actions">
                        <button
                          className="button secondary"
                          onClick={() => copy(makePrompt(idea, channel))}
                        >
                          <Sparkles size={15} />
                          この媒体の生成指示をコピー
                        </button>
                        <button
                          className="button secondary"
                          disabled={!idea.outputs[channel]}
                          onClick={() => copy(idea.outputs[channel] || "")}
                        >
                          <Copy size={15} />
                          本文をコピー
                        </button>
                      </div>
                      <p className="note">
                        試作には事前作成した例が含まれます。ボタンからAI生成は実行されません。
                      </p>
                    </section>
                  </div>
                  <details className="original">
                    <summary>元の原液を確認する</summary>
                    <h3>{idea.claim}</h3>
                    <p>{idea.body}</p>
                    <button
                      className="button secondary"
                      onClick={() => setView("editor")}
                    >
                      原液を編集する
                    </button>
                  </details>
                </>
              )}
            </>
          )}
          {view === "brand" && (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">BRAND FOUNDATION</div>
                  <h1>
                    すべての企画に、
                    <br />
                    同じ土台を。
                  </h1>
                  <p>最初のブランドは、ShogunAI。</p>
                </div>
              </div>
              <div className="brand-grid">
                {[
                  [
                    "01",
                    "仕事の記憶",
                    "日々の仕事の記録を、必要なときに使える文脈へ。",
                  ],
                  [
                    "02",
                    "文脈の呼び出し",
                    "何を決めたかだけでなく、理由と根拠を確認する。",
                  ],
                  [
                    "03",
                    "次の作業の実行",
                    "取り戻した文脈を、次の準備や行動につなげる。",
                  ],
                ].map(([n, t, b]) => (
                  <section key={n}>
                    <span>{n}</span>
                    <h2>{t}</h2>
                    <p>{b}</p>
                  </section>
                ))}
              </div>
              <section className="paper brand-notes">
                <h2>編集の共通ルール</h2>
                <p>
                  公式サイトの訴求を企画の出発点にします。実装状況・対応連携・効果は、公開前に実機や一次情報で確認します。
                </p>
                <ul>
                  <li>
                    利用者の体験談・発言・成果は、実際に確認できたものを使う。
                  </li>
                  <li>UGC風広告と実際の利用者投稿を区別する。</li>
                  <li>
                    マスコットと城は、記憶・文脈・実行のどれかに結びつける。
                  </li>
                  <li>シーンや独自の見解は、人間が足して磨く。</li>
                </ul>
                <a href={source} target="_blank" rel="noreferrer">
                  参照：ShogunAI 公式サイト
                  <ArrowUpRight size={14} />
                </a>
                <p className="note">
                  2026年10月2日参照。この企画は戦略仮説であり、実証済みの顧客事例ではありません。
                </p>
              </section>
            </>
          )}
          <p className="note">
            この試作の編集内容は画面内に保持されます。閉じる・再読み込みの前に「書き出す」で保存し、次回は読み込みボタンから再開できます。
          </p>
        </main>
      </div>
    </div>
  );
}
