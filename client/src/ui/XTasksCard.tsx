import { xTaskIntentUrl, type XTaskView } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { claimXTask, createXTask, fetchXTasks, setXTaskActive, updateXTask, type NewXTask } from "../character/xTasksApi";

/**
 * "Earn with X" card on the dashboard (Phase 2). Lists the active reply/quote
 * campaigns, hands the player their per-task code, deep-links to X's composer
 * with it prefilled, and takes the pasted proof-tweet URL to claim the points.
 * Admins additionally see inactive tasks and can create / edit / hide them.
 */
export function XTasksCard({ accessToken, onClaimed }: { accessToken: string | null; onClaimed?: () => void }) {
  const [tasks, setTasks] = useState<XTaskView[] | null>(null);
  const [linked, setLinked] = useState(true);
  const [admin, setAdmin] = useState(false);

  const reload = () => {
    if (!accessToken) return;
    void fetchXTasks(accessToken).then((r) => {
      if (!r) return;
      setLinked(r.linked);
      setTasks(r.tasks);
      setAdmin(r.admin);
    });
  };
  useEffect(reload, [accessToken]);

  if (!accessToken) return null;
  // Hide entirely only for non-admins with no live tasks; admins always see it.
  if (tasks && tasks.length === 0 && linked && !admin) return null;

  return (
    <section className="chibi-panel mb-dash-card">
      <h2>Earn with X</h2>
      {!linked && (
        <p style={{ fontSize: "0.85rem", color: "var(--chibi-ink-soft)", margin: "0 0 8px" }}>
          Connect your X account above to unlock reply &amp; repost rewards.
        </p>
      )}
      {tasks === null && linked && (
        <p style={{ fontSize: "0.85rem", color: "var(--chibi-ink-soft)", margin: 0 }}>Loading tasks…</p>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {tasks?.map((t) => (
          <XTaskItem key={t.id} task={t} accessToken={accessToken} linked={linked} admin={admin}
            onChanged={reload}
            onClaimed={() => { setTasks((prev) => prev?.map((x) => x.id === t.id ? { ...x, claimed: true } : x) ?? prev); onClaimed?.(); }} />
        ))}
      </div>
      {admin && <NewTaskButton accessToken={accessToken} onCreated={reload} />}
    </section>
  );
}

function XTaskItem({ task, accessToken, linked, admin, onChanged, onClaimed }: {
  task: XTaskView; accessToken: string; linked: boolean; admin: boolean; onChanged: () => void; onClaimed: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState(false);

  const verb = task.type === "quote" ? "Repost" : "Reply";

  const claim = async () => {
    setBusy(true); setMsg(null);
    const r = await claimXTask(accessToken, task.id, url.trim());
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: `+${r.points} season points!` }); onClaimed(); }
    else setMsg({ ok: false, text: r.error ?? "Couldn't verify that." });
  };

  const toggleActive = async () => {
    await setXTaskActive(accessToken, task.id, !task.active);
    onChanged();
  };

  const box: React.CSSProperties = {
    border: "2px solid var(--chibi-outline-light)", borderRadius: "var(--chibi-radius-sm)",
    padding: "12px 14px", background: "var(--chibi-cream)", opacity: task.active ? 1 : 0.6,
  };

  if (editing) {
    return (
      <div style={box}>
        <TaskForm accessToken={accessToken} task={task}
          onDone={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <b style={{ fontSize: "0.95rem" }}>{task.title}</b>
        {!task.active && <span className="mb-dash__chip" style={{ padding: "2px 8px", fontSize: "0.68rem" }}>hidden</span>}
        <span className="mb-dash__chip" style={{ marginLeft: "auto", padding: "3px 9px", fontSize: "0.72rem" }}>+{task.points} pts</span>
      </div>
      {task.description && (
        <p style={{ fontSize: "0.8rem", color: "var(--chibi-ink-soft)", margin: "0 0 8px" }}>{task.description}</p>
      )}

      {task.claimed ? (
        <div style={{ fontSize: "0.82rem", color: "#2db5ac", fontWeight: 700 }}>✓ Claimed — thanks!</div>
      ) : linked ? (
        <>
          <div style={{ fontSize: "0.78rem", color: "var(--chibi-ink-soft)", marginBottom: 8 }}>
            {verb} the post including your code{" "}
            <b className="mono" style={{ color: "var(--chibi-ink)", background: "var(--chibi-cream-deep)", padding: "1px 6px", borderRadius: 6 }}>{task.code}</b>
            {task.hashtag ? <> and {task.hashtag}</> : null}, then paste the link to your post below.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <a className="chibi-btn chibi-btn--secondary" href={xTaskIntentUrl(task)} target="_blank" rel="noopener noreferrer"
              style={{ padding: "8px 14px", fontSize: "0.8rem", textDecoration: "none" }}>
              𝕏 {verb} on X
            </a>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="chibi-input" value={url} placeholder="Paste your post link"
              onChange={(e) => setUrl(e.target.value)} spellCheck={false}
              style={{ flex: 1, minWidth: 0, padding: "8px 10px" }} />
            <button className="chibi-btn chibi-btn--primary" type="button" disabled={busy || url.trim().length < 8}
              onClick={() => void claim()} style={{ padding: "8px 16px", fontSize: "0.8rem" }}>
              {busy ? "…" : "Claim"}
            </button>
          </div>
        </>
      ) : (
        <a className="chibi-btn chibi-btn--secondary" href={task.targetUrl} target="_blank" rel="noopener noreferrer"
          style={{ padding: "8px 14px", fontSize: "0.8rem", textDecoration: "none" }}>
          View post on X
        </a>
      )}

      {msg && (
        <p style={{ fontSize: "0.78rem", margin: "8px 0 0", color: msg.ok ? "#2db5ac" : "#e0567a", fontWeight: 600 }}>{msg.text}</p>
      )}

      {admin && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "2px dashed var(--chibi-outline-light)" }}>
          <button className="chibi-btn chibi-btn--ghost" type="button" onClick={() => setEditing(true)} style={{ padding: "6px 12px", fontSize: "0.75rem" }}>Edit</button>
          <button className="chibi-btn chibi-btn--ghost" type="button" onClick={() => void toggleActive()} style={{ padding: "6px 12px", fontSize: "0.75rem" }}>
            {task.active ? "Hide" : "Show"}
          </button>
        </div>
      )}
    </div>
  );
}

function NewTaskButton({ accessToken, onCreated }: { accessToken: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="chibi-btn chibi-btn--ghost" type="button" onClick={() => setOpen(true)}
        style={{ marginTop: 12, padding: "8px 14px", fontSize: "0.8rem" }}>
        ＋ New task (admin)
      </button>
    );
  }
  return (
    <div style={{ marginTop: 12, borderTop: "2px dashed var(--chibi-outline-light)", paddingTop: 12 }}>
      <TaskForm accessToken={accessToken} onDone={() => { setOpen(false); onCreated(); }} onCancel={() => setOpen(false)} />
    </div>
  );
}

/** Shared create/edit form. Passing `task` switches it into edit mode. */
function TaskForm({ accessToken, task, onDone, onCancel }: {
  accessToken: string; task?: XTaskView; onDone: () => void; onCancel: () => void;
}) {
  const [type, setType] = useState<"reply" | "quote">(task?.type ?? "reply");
  const [title, setTitle] = useState(task?.title ?? "");
  const [targetUrl, setTargetUrl] = useState(task?.targetUrl ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [hashtag, setHashtag] = useState(task?.hashtag ?? "#MetricBase");
  const [points, setPoints] = useState(task?.points ?? 25);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    const payload: NewXTask = { type, title, targetUrl, description, hashtag, points };
    const r = task ? await updateXTask(accessToken, task.id, payload) : await createXTask(accessToken, payload);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Failed"); return; }
    onDone();
  };

  const input = { padding: "8px 10px", width: "100%" } as const;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="seg" role="group" aria-label="Type" style={{ alignSelf: "start" }}>
        <button type="button" aria-pressed={type === "reply"} onClick={() => setType("reply")} style={{ padding: "6px 12px" }}>Reply</button>
        <button type="button" aria-pressed={type === "quote"} onClick={() => setType("quote")} style={{ padding: "6px 12px" }}>Repost</button>
      </div>
      <input className="chibi-input" style={input} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="chibi-input" style={input} placeholder="Target tweet URL (x.com/…/status/…)" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} spellCheck={false} />
      <input className="chibi-input" style={input} placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <input className="chibi-input" style={{ ...input, flex: 1 }} placeholder="#hashtag" value={hashtag} onChange={(e) => setHashtag(e.target.value)} />
        <input className="chibi-input" style={{ ...input, width: 90 }} type="number" min={1} max={500} value={points} onChange={(e) => setPoints(+e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="chibi-btn chibi-btn--primary" type="button" disabled={busy || !title || !targetUrl} onClick={() => void submit()} style={{ padding: "8px 16px", fontSize: "0.8rem" }}>
          {busy ? "…" : task ? "Save changes" : "Post task"}
        </button>
        <button className="chibi-btn chibi-btn--ghost" type="button" onClick={onCancel} style={{ padding: "8px 14px", fontSize: "0.8rem" }}>Cancel</button>
      </div>
      {err && <p style={{ fontSize: "0.78rem", color: "#e0567a", margin: 0 }}>{err}</p>}
    </div>
  );
}
