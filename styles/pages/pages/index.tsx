import { useEffect, useMemo, useRef, useState } from "react";

type Persona = "Rowdy Pub" | "Respectful Analysts" | "Talk Radio";
type Side = "A" | "B" | null;

interface StatItem { label: string; value: string | number; }
interface Topic { title: string; sides: [string, string]; facts: StatItem[]; derived: StatItem[]; }

const crowdLines: Record<Persona, string[]> = {
  "Rowdy Pub": ["Bosh! Say it with your chest!", "Bottle jobs!", "Stats don't lie... or do they?", "He's cooked!", "Net spend tax incoming!"],
  "Respectful Analysts": ["Interesting point on age profile.", "Please cite a source.", "Small sample size caveat.", "Consider fixture congestion.", "Good structure."],
  "Talk Radio": ["Hot take alert!", "Cut the waffle—winner?", "Phones are melting!", "Producer says keep it moving!", "Not for purists!"]
};

const modPrompts = [
  "Moderator: Opening statements—keep it tight.",
  "Value vs. cost: who got more per euro?",
  "Counter the tactical fit argument with an example.",
  "Consider injury history—does it change your view?",
  "Resale value in 2–3 years?",
  "Compare to last season—progress or repeat mistakes?"
];

function rand<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [i, setI] = useState(0);
  const topic = topics[i];
  const [persona, setPersona] = useState<Persona>("Rowdy Pub");
  const [joinedSide, setJoinedSide] = useState<Side>(null);
  const [round, setRound] = useState(0);
  const [used, setUsed] = useState<string[]>([]);
  const [crowd, setCrowd] = useState<string[]>([]);
  const [mod, setMod] = useState<string[]>([]);
  const [t, setT] = useState(45);
  const [len, setLen] = useState(45);
  const [verdict, setVerdict] = useState("");
  // thumbnail
  const [thumbUrl, setThumbUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetch("/topics.json", { cache: "no-store" })
      .then(r => r.json())
      .then((j: Topic[]) => {
        setTopics(j);
        const url = new URL(window.location.href);
        const idx = parseInt(url.searchParams.get("topic") || "0", 10);
        setI(Number.isFinite(idx) && idx >= 0 && idx < j.length ? idx : 0);
      })
      .catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    if (round <= 0 || round === 99) return;
    const crowdId = setInterval(() => setCrowd(f => [rand(crowdLines[persona]), ...f].slice(0, 7)), 2500);
    const timerId = setInterval(() => setT(x => (x <= 1 ? 0 : x - 1)), 1000);
    return () => { clearInterval(crowdId); clearInterval(timerId); };
  }, [round, persona]);

  useEffect(() => { if (t === 0 && (round === 1 || round === 2)) endRound(); }, [t]);

  const start = () => {
    setRound(1); setUsed([]); setCrowd([]); setMod([modPrompts[0]]); setT(len); setVerdict(""); setThumbUrl("");
  };
  const endRound = () => {
    if (round >= 2) {
      setRound(99);
      const tilt = used.length * 2 * (joinedSide === "A" ? 1 : -1);
      const base = Math.floor(Math.random() * 100);
      const final = base + tilt;
      const a = final >= 50 ? 100 - final : final;
      const b = 100 - a;
      const winner = a > b ? topic.sides[0] : topic.sides[1];
      setVerdict(`Winner: ${winner}. Best moment: ${crowd[0] || "—"}`);
      setMod(m => [...m, "Moderator: Verdict time—simulated audience has spoken."]);
      return;
    }
    setRound(r => r + 1);
    setT(len);
    setMod(m => [rand(modPrompts.slice(1)), ...m].slice(0, 7));
  };

  const drop = (s: StatItem) => {
    if (!joinedSide) return;
    const key = `${s.label}:${s.value}`;
    if (used.includes(key)) return;
    setUsed(u => [...u, key]);
    setCrowd(f => [`Stat drop by ${joinedSide === "A" ? topic.sides[0] : topic.sides[1]} → ${key}`, ...f].slice(0, 7));
  };

  // ---- Thumbnail mode (client-side canvas → PNG) ----
  function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(" ");
    let line = "";
    const lines: string[] = [];
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line.trim());
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());
    lines.forEach((l, idx) => ctx.fillText(l, x, y + idx * lineHeight));
  }

  const makeThumbnail = () => {
    if (!topic) return;
    const W = 1280, H = 720; // 16:9 thumbnail
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    // background gradient
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0f172a"); // slate-900
    g.addColorStop(1, "#111827"); // gray-900
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // “ON AIR” tag
    ctx.fillStyle = "#ef4444"; // red-500
    ctx.fillRect(40, 40, 130, 42);
    ctx.fillStyle = "#000";
    ctx.font = "bold 20px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("ON AIR", 78, 67);

    // meme slanted sticker
    ctx.save();
    ctx.translate(W - 280, 60);
    ctx.rotate(-6 * Math.PI / 180);
    ctx.fillStyle = "#fde047"; // yellow-300
    ctx.fillRect(0, 0, 240, 50);
    ctx.fillStyle = "#000";
    ctx.font = "bold 22px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("YOU’RE THE PUNDIT", 20, 32);
    ctx.restore();

    // title
    ctx.fillStyle = "#fff";
    ctx.font = "bold 56px system-ui, -apple-system, Segoe UI, Roboto";
    wrapText(ctx, topic.title.toUpperCase(), 40, 150, W - 80, 62);

    // sides boxes
    ctx.fillStyle = "rgba(34,197,94,0.8)"; // emerald-500-ish
    ctx.fillRect(40, H - 220, 520, 120);
    ctx.fillStyle = "rgba(59,130,246,0.85)"; // blue-500-ish
    ctx.fillRect(W - 560, H - 220, 520, 120);

    ctx.fillStyle = "#000";
    ctx.font = "bold 34px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(topic.sides[0], 60, H - 145);
    ctx.fillText(topic.sides[1], W - 540, H - 145);

    // tiny crowd chips (top of footer)
    ctx.font = "20px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillStyle = "#e5e7eb";
    const chips = (crowd.slice(0,3).length ? crowd.slice(0,3) : ["Let him cook!", "Talk to me nice!", "We ball."]);
    chips.forEach((c, idx) => ctx.fillText(`• ${c}`, 40, H - 260 - idx * 26));

    // winner ribbon if we have verdict
    if (verdict) {
      const winner = verdict.replace("Winner: ", "").split(".")[0];
      ctx.save();
      ctx.translate(W / 2, H - 40);
      ctx.rotate(-2 * Math.PI / 180);
      ctx.fillStyle = "#22c55e"; // green-500
      ctx.fillRect(-360, -48, 720, 64);
      ctx.fillStyle = "#000";
      ctx.font = "bold 30px system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textAlign = "center";
      ctx.fillText(`WINNER: ${winner}`, 0, -8);
      ctx.restore();
    }

    // footer
    ctx.fillStyle = "#a3a3a3";
    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(`Arena · ${persona}`, 40, H - 24);

    const url = canvas.toDataURL("image/png");
    setThumbUrl(url);
    // keep a ref so subsequent clicks reuse same canvas
    canvasRef.current = canvas;
  };

  const downloadThumb = () => {
    if (!thumbUrl) return;
    const a = document.createElement("a");
    a.href = thumbUrl;
    a.download = `arena-thumb-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* “On Air” header */}
      <div className="bg-gradient-to-r from-fuchsia-600/30 via-emerald-500/20 to-sky-500/30 border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="px-2 py-1 rounded-md bg-red-500 text-black text-xs font-extrabold uppercase tracking-wider">On Air</div>
            <div className="font-black text-lg">Deep Sports Debate Arena</div>
            <div className="text-xs bg-neutral-800 px-2 py-1 rounded-md border border-neutral-700">Quick-Fire</div>
          </div>
          <div className="text-xs text-neutral-300">“You on the mic. Internet watching.”</div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 md:p-8 grid gap-6">
        {/* Stage */}
        <div className="rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden">
          <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-neutral-400 text-xs uppercase tracking-wide">Topic</div>
              <div className="text-2xl font-extrabold leading-snug">
                {topic ? topic.title : "Loading topics…"}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm"
                  value={i}
                  onChange={(e) => { setI(parseInt(e.target.value, 10)); setThumbUrl(""); }}
                >
                  {topics.map((t, idx) => (
                    <option key={idx} value={idx}>{t.title}</option>
                  ))}
                </select>
                <select
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm"
                  value={persona}
                  onChange={(e) => setPersona(e.target.value as Persona)}
                >
                  <option>Rowdy Pub</option>
                  <option>Respectful Analysts</option>
                  <option>Talk Radio</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-yellow-300 text-black px-3 py-2 text-xs font-black uppercase tracking-wider rotate-[-2deg] shadow">
                You’re the Pundit
              </div>
              <button
                className={`px-4 py-2 rounded-xl font-semibold ${joinedSide ? "bg-emerald-400 text-black" : "bg-neutral-800 text-neutral-400 cursor-not-allowed"}`}
                disabled={!joinedSide}
                onClick={start}
              >
                Start Debate
              </button>
              {round > 0 && round < 99 && (
                <div className="flex items-center gap-2">
                  <div className="px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 font-mono">{t}s</div>
                  <button className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700" onClick={endRound}>End Round</button>
                  <select className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm" value={len} onChange={e => setLen(parseInt(e.target.value, 10))}>
                    <option value={30}>30s</option>
                    <option value={45}>45s</option>
                    <option value={60}>60s</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Sides */}
          <div className="grid md:grid-cols-2 gap-4 p-4 md:p-6 pt-0">
            <div className="rounded-2xl bg-neutral-950 border border-neutral-800 p-4">
              <div className="text-xs text-neutral-400">Side A</div>
              <div className="text-lg font-bold">{topic?.sides?.[0] || "—"}</div>
              <button
                onClick={() => { setJoinedSide("A"); setThumbUrl(""); }}
                className={`mt-2 px-3 py-2 rounded-lg border ${joinedSide === "A" ? "bg-green-600/80 border-green-500" : "border-neutral-700 hover:bg-neutral-800"}`}
              >
                {joinedSide === "A" ? "Joined" : "Join Side A"}
              </button>
            </div>
            <div className="rounded-2xl bg-neutral-950 border border-neutral-800 p-4">
              <div className="text-xs text-neutral-400">Side B</div>
              <div className="text-lg font-bold">{topic?.sides?.[1] || "—"}</div>
              <button
                onClick={() => { setJoinedSide("B"); setThumbUrl(""); }}
                className={`mt-2 px-3 py-2 rounded-lg border ${joinedSide === "B" ? "bg-blue-600/80 border-blue-500" : "border-neutral-700 hover:bg-neutral-800"}`}
              >
                {joinedSide === "B" ? "Joined" : "Join Side B"}
              </button>
            </div>
          </div>

          {/* Stats + AI panels */}
          <div className="grid md:grid-cols-3 gap-4 p-4 md:p-6 pt-0">
            <div className="md:col-span-2 rounded-2xl bg-neutral-950 border border-neutral-800 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-400">Preloaded Facts</div>
              <ul className="mt-2 grid md:grid-cols-2 gap-2">
                {topic?.facts?.map((s, idx) => (
                  <li key={`f-${idx}`} className="flex items-center justify-between gap-2 bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                    <div>
                      <div className="text-sm">{s.label}</div>
                      <div className="text-neutral-400 text-xs">{String(s.value)}</div>
                    </div>
                    <button className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm" onClick={() => drop(s)}>
                      Stat Drop
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-xs uppercase tracking-wide text-neutral-400">Derived Ratings</div>
              <ul className="mt-2 grid md:grid-cols-2 gap-2">
                {topic?.derived?.map((s, idx) => (
                  <li key={`d-${idx}`} className="flex items-center justify-between gap-2 bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                    <div>
                      <div className="text-sm">{s.label}</div>
                      <div className="text-neutral-400 text-xs">{String(s.value)}</div>
                    </div>
                    <button className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm" onClick={() => drop(s)}>
                      Stat Drop
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-neutral-950 border border-neutral-800 p-4 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-400">AI Moderator</div>
                <div className="mt-2 grid gap-2 max-h-44 overflow-auto pr-1">
                  {mod.length === 0 ? <div className="text-neutral-500 text-sm">Waiting for debate…</div> :
                    mod.map((m, idx) => <div key={idx} className="text-sm bg-neutral-900 border border-neutral-800 rounded-lg p-2">{m}</div>)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-400">AI Crowd · {persona}</div>
                <div className="mt-2 grid gap-2 max-h-44 overflow-auto pr-1">
                  {crowd.length === 0 ? <div className="text-neutral-500 text-sm">The stands will roar when the debate starts…</div> :
                    crowd.map((m, idx) => <div key={idx} className="text-sm bg-neutral-900 border border-neutral-800 rounded-lg p-2">{m}</div>)}
                </div>
              </div>

              {/* Verdict + Thumbnail Mode */}
              {round === 99 && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-neutral-900 border border-neutral-700 p-3">
                    <div className="text-xs uppercase tracking-wide text-neutral-400">Verdict</div>
                    <div className="mt-1 text-base font-semibold">{verdict}</div>
                  </div>

                  <div className="rounded-xl bg-neutral-900 border border-neutral-700 p-3">
                    <div className="text-xs uppercase tracking-wide text-neutral-400">Thumbnail Mode</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={makeThumbnail} className="px-3 py-2 rounded-lg bg-emerald-400 text-black font-semibold">
                        Generate thumbnail
                      </button>
                      <button onClick={downloadThumb} disabled={!thumbUrl} className={`px-3 py-2 rounded-lg ${thumbUrl ? "bg-neutral-800 hover:bg-neutral-700" : "bg-neutral-800/50 text-neutral-500 cursor-not-allowed"}`}>
                        Download PNG
                      </button>
                    </div>
                    {thumbUrl && (
                      <div className="mt-3">
                        <img src={thumbUrl} alt="arena thumbnail" className="w-full rounded-lg border border-neutral-800" />
                      </div>
                    )}
                    {/* hidden canvas reused between renders */}
                    <canvas ref={canvasRef} width={1280} height={720} style={{ display: "none" }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-center text-neutral-500 text-xs">v0.3 • Next.js + Tailwind • Thumbnail Mode</div>
      </main>
    </div>
  );
}
