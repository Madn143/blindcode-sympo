import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { clientAuth } from "./lib/firebase";
import { api } from "./api";
import type {
  Answer,
  EventSettings,
  Participant,
  ParticipantEvent,
  Question,
} from "./types";
import "./index.css";

type Page = "home" | "login" | "register" | "dashboard" | "round1" | "round1-result" | "round2" | "admin";

const rules = [
  "Participants must use only the provided system and coding environment.",
  "Complete the coding challenge within the allotted time.",
  "Mobile phones and unauthorized devices are not allowed.",
  "Internet access or external assistance is not allowed unless permitted.",
  "Do not communicate with other participants during the challenge.",
  "Cheating may result in immediate disqualification.",
  "Follow instructions from event coordinators and judges.",
  "Do not refresh or close the event page after starting.",
  "The judges' decision is final.",
  "Starting the event means agreeing to all rules.",
];

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button className="logo" onClick={onClick}>
      ELVARIX<span>’</span>26
    </button>
  );
}
function Auth({
  mode,
  setPage,
}: {
  mode: "login" | "register";
  setPage: (page: Page) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (mode === "register" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        await createUserWithEmailAndPassword(clientAuth, email, password);
        await api("/profile", {
          method: "PUT",
          body: JSON.stringify({ name, collegeName: college }),
        });
        setSuccess("Registration successful! You can now login.");
        await signOut(clientAuth);
        setPage("login");
      } else await signInWithEmailAndPassword(clientAuth, email, password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === "login"
            ? "Incorrect email or password."
            : "Registration failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <p className="auth-subtitle">
          {mode === "login"
            ? "Login to participate in the event"
            : "Create your participant account"}
        </p>
        {mode === "register" && (
          <>
            <label>Name</label>
            <input
              className="legacy-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <label>College Name</label>
            <input
              className="legacy-input"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              required
            />
          </>
        )}
        <label>Email</label>
        <input
          className="legacy-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label>Password</label>
        <input
          className="legacy-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        {mode === "register" && (
          <>
            <label>Confirm Password</label>
            <input
              className="legacy-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </>
        )}
        {error && <div className="alert-error">{error}</div>}
        {success && <div className="alert-success">{success}</div>}
        <button className="gradient-button" disabled={busy}>
          {busy ? "PLEASE WAIT" : mode === "login" ? "LOGIN" : "REGISTER"}
        </button>
        <p className="auth-switch">
          {mode === "login" ? "Don't have an account?" : "Already registered?"}{" "}
          <button
            type="button"
            onClick={() => setPage(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Register" : "Login"}
          </button>
        </p>
      </form>
    </div>
  );
}
function Home({ setPage }: { setPage: (page: Page) => void }) {
  return (
    <div className="legacy-site">
      <nav>
        <Logo onClick={() => setPage("home")} />
        <button className="nav-link" onClick={() => setPage("login")}>
          Login
        </button>
      </nav>
      <section className="landing-hero">
        <div>
          <div className="badge">TECHNICAL EVENT</div>
          <h1>
            BLIND
            <br />
            <span>CODING</span>
          </h1>
          <p>
            Think without seeing. Code with precision. Compete with confidence.
          </p>
          <div className="hero-buttons">
            <button
              className="gradient-button small"
              onClick={() => setPage("login")}
            >
              ENTER THE ARENA
            </button>
            <a className="outline-button" href="#rules">
              VIEW RULES
            </a>
          </div>
        </div>
      </section>
      <section className="landing-section" id="rules">
        <h2>Two Rounds. One Winner.</h2>
        <div className="feature-grid">
          <div>
            <strong>01 / DEBUG</strong>
            <p>Find the broken line, correct it, and explain the error.</p>
          </div>
          <div>
            <strong>02 / BUILD</strong>
            <p>Write solutions under pressure and receive evaluation.</p>
          </div>
          <div>
            <strong>03 / COMPETE</strong>
            <p>Your score is calculated from every submitted answer.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
function Header({
  profile,
  onHome,
  onSignOut,
}: {
  profile: { name: string; collegeName: string };
  onHome: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="legacy-header">
      <Logo onClick={onHome} />
      <div className="participant">
        <div className="participant-info">
          <small>Participant</small>
          <b>{profile.name}</b>
          {profile.collegeName && <span>{profile.collegeName}</span>}
        </div>
        <div className="avatar">{profile.name.slice(0, 1).toUpperCase()}</div>
        <button className="header-logout" onClick={onSignOut}>
          Logout
        </button>
      </div>
    </header>
  );
}
function Dashboard({
  profile,
  setPage,
  onSignOut,
}: {
  profile: { name: string; collegeName: string };
  setPage: (page: Page) => void;
  onSignOut: () => void;
}) {
  const [showRules, setShowRules] = useState(false);
  const [agreed, setAgreed] = useState(false);
  async function startRound() {
    await document.documentElement.requestFullscreen?.().catch(() => undefined);
    setPage("round1");
  }
  return (
    <div className="dashboard-page">
      <Header
        profile={profile}
        onHome={() => setPage("home")}
        onSignOut={onSignOut}
      />
      <main className="dashboard-main">
        <div className="dashboard-card">
          <div className="badge">Blind Coding Challenge</div>
          <h1>Ready to Code?</h1>
          <p>
            Welcome, <strong>{profile.name}</strong>. Get ready to test your
            coding skills without seeing the source code.
          </p>
          <div className="event-card">
            <div className="event-icon">&lt;/&gt;</div>
            <h2>Blind Coding</h2>
            <p>
              Read the rules carefully before starting. Once the event begins,
              you will need to complete the challenge within the given time.
            </p>
            <button
              className="gradient-button"
              onClick={() => setShowRules(true)}
            >
              START EVENT
            </button>
          </div>
        </div>
      </main>
      {showRules && (
        <div className="modal">
          <div className="rules-box">
            <div className="rules-head">
              <h2>
                Event <span>Rules</span>
              </h2>
              <button onClick={() => setShowRules(false)}>×</button>
            </div>
            <p>
              Please read all the rules and regulations carefully before
              starting the Blind Coding event.
            </p>
            <ol>
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
            <label className="agreement">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />{" "}
              I have read and understood all the rules and regulations. I agree
              to follow them throughout the Blind Coding event.
            </label>
            <button
              className="gradient-button"
              disabled={!agreed}
              onClick={startRound}
            >
              I AGREE &amp; START EVENT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function ScoreCards({ data }: { data: ParticipantEvent }) {
  const r1Completed = data.profile.round1Completed;
  const r2Completed = data.settings.round2Finished && r1Completed;
  if (!r1Completed && !r2Completed) return null;
  return (
    <div className="score-grid">
      {r1Completed && (
        <div>
          <h3>Round 1</h3>
          <strong>✓ Submitted</strong>
        </div>
      )}
      {r2Completed && (
        <div>
          <h3>Round 2</h3>
          <strong>✓ Submitted</strong>
        </div>
      )}
    </div>
  );
}
function EventPage({
  data,
  setPage,
  onRefresh,
  round,
}: {
  data: ParticipantEvent;
  setPage: (page: Page) => void;
  onRefresh: () => void;
  round: "round1" | "round2";
}) {
  const [questions1, setQuestions1] = useState<Question[]>([]);
  const [questions2, setQuestions2] = useState<Question[]>([]);
  const [message, setMessage] = useState("");
  const [values, setValues] = useState<
    Record<
      string,
      {
        correctedLine: string;
        description: string;
        answer: string;
      }
    >
  >({});
  const [completion, setCompletion] = useState<{ score: number; qualified: boolean } | null>(null);
  const [exitWarning, setExitWarning] = useState("");
  const exitCount = useState({ value: 0 })[0];
  const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());
  const [evaluating, setEvaluating] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const enterExam = () => document.documentElement.requestFullscreen?.().catch(() => undefined);
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        exitCount.value += 1;
        if (exitCount.value === 1) {
          setExitWarning("Fullscreen was exited. Press Escape again and the round will restart.");
          document.documentElement.requestFullscreen?.().catch(() => undefined);
        }
        else { setExitWarning("The round was reset because fullscreen was exited twice."); setPage("dashboard"); }
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        exitCount.value += 1;
        if (exitCount.value === 1) {
          setExitWarning("Warning: Tab switching is not allowed. Do it again and you will be kicked out.");
        } else {
          setExitWarning("You were kicked out for switching tabs multiple times.");
          setPage("dashboard");
        }
      }
    };
    const blockExamActions = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof MouseEvent) event.preventDefault();
      if (event instanceof KeyboardEvent && (event.key === "F12" || (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(event.key.toLowerCase())))) event.preventDefault();
    };
    enterExam();
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("contextmenu", blockExamActions as EventListener);
    document.addEventListener("keydown", blockExamActions as EventListener);
    return () => { 
      document.removeEventListener("fullscreenchange", onFullscreenChange); 
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("contextmenu", blockExamActions as EventListener); 
      document.removeEventListener("keydown", blockExamActions as EventListener); 
    };
  }, [exitCount, setPage]);
  useEffect(() => {
    Promise.all([
      api<Question[]>("/questions/round1"),
      api<Question[]>("/questions/round2"),
    ])
      .then(([one, two]) => {
        setQuestions1(one);
        setQuestions2(two);
      })
      .catch((err) => setMessage(err.message));
  }, []);
  const old1 = new Map(
    data.round1Answers.map((answer) => [answer.questionId, answer]),
  );
  const old2 = new Map(
    data.round2Answers.map((answer) => [answer.questionId, answer]),
  );
  function value(id: string, answer?: Answer) {
    return (
      values[id] ?? {
        correctedLine: answer?.correctedLine ?? "",
        description: answer?.description ?? "",
        answer: answer?.answer ?? "",
      }
    );
  }
  async function submit1(question: Question) {
    const current = value(question.id, old1.get(question.id));
    setEvaluating((prev) => ({ ...prev, [question.id]: true }));
    setMessage("");
    try {
      await api<{ score: number; feedback?: string }>("/submissions/round1", {
        method: "POST",
        body: JSON.stringify({
          questionId: question.id,
          correctedLine: current.correctedLine,
          description: current.description,
        }),
      });
      setSavedQuestions((prev) => new Set(prev).add(question.id));
      onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Invalid submission.");
    } finally {
      setEvaluating((prev) => ({ ...prev, [question.id]: false }));
    }
  }
  async function submit2(question: Question) {
    const current = value(question.id, old2.get(question.id));
    setMessage("");
    setEvaluating((prev) => ({ ...prev, [question.id]: true }));
    try {
      const result = await api<{ submitted: boolean; submissionCount: number; maxAttempts: number; score?: number }>(
        "/submissions/round2",
        {
          method: "POST",
          body: JSON.stringify({
            questionId: question.id,
            answer: current.answer,
          }),
        },
      );
      setMessage(`Answer submitted (${result.submissionCount}/${result.maxAttempts} attempts used).`);
      onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setEvaluating((prev) => ({ ...prev, [question.id]: false }));
    }
  }
  async function completeRound1() {
    try {
      const result = await api<{ score: number; qualified: boolean }>("/submissions/round1/complete", { method: "POST" });
      setCompletion(result);
      onRefresh();
      setPage("round1-result");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to complete Round 1.");
    }
  }
  function update(
    id: string,
    key: keyof ReturnType<typeof value>,
    next: string,
  ) {
    setValues((current) => ({
      ...current,
      [id]: { ...value(id), [key]: next },
    }));
  }
  return (
    <>
      <Header
        profile={data.profile}
        onHome={() => setPage("dashboard")}
        onSignOut={() => signOut(clientAuth)}
      />
      <div className="event-page">
        {exitWarning && <div className="alert-error event-message">{exitWarning}</div>}
        <section className="event-hero">
          <h1>
            BLIND <span>CODING</span>
          </h1>
          <p>Debug. Think. Code. Compete.</p>
          <ScoreCards data={data} />
        </section>
        {message && (
          <div className="alert-success event-message">{message}</div>
        )}
        {round === "round1" && <section className="round-section">
          <div className="round-heading">
            <h2>Round 1 — Debugging</h2>
            <span className="live-badge">
              {questions1.length} Questions • 100 Marks
            </span>
          </div>
          {!data.settings.round1Started ? (
            <Locked
              title="Round 1 Not Started"
              text="Please wait for the administrator to start the round."
            />
          ) : (
            questions1.map((question, index) => {
              const old = old1.get(question.id);
              const current = value(question.id, old);
              return (
                <article className="question-card" key={question.id}>
                  <div className="question-top">
                    <b>Question {index + 1}</b>
                  </div>
                  <pre>{question.code}</pre>

                  <label>Enter the corrected code — 10 Marks</label>
                  <input
                    className="legacy-input"
                    placeholder="Enter corrected code"
                    value={current.correctedLine}
                    onChange={(e) =>
                      update(question.id, "correctedLine", e.target.value)
                    }
                    onCopy={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                  />
                  <label>Explanation</label>
                  <textarea
                    className="legacy-input code-input"
                    placeholder="Explain the error..."
                    value={current.description}
                    onChange={(e) =>
                      update(question.id, "description", e.target.value)
                    }
                    onCopy={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                  />
                  <button
                    className="gradient-button small"
                    onClick={() => submit1(question)}
                    disabled={!!evaluating[question.id]}
                  >
                    {evaluating[question.id] ? "Evaluating..." : "Save Answer"}
                  </button>
                  {evaluating[question.id] && (
                    <div className="saved">⏳ Evaluating with Gemini, please wait (this may take up to a minute during high traffic)...</div>
                  )}
                  {!evaluating[question.id] && (savedQuestions.has(question.id) || old) && (
                    <div className="saved">✓ Answer saved — your score will be revealed after Round 1 is complete.</div>
                  )}
                </article>
              );
            })
          )}
          <button className="gradient-button complete-round" onClick={completeRound1}>Complete Round 1</button>
        </section>}
        {round === "round2" && <section className="round-section">
          <div className="round-heading">
            <h2>Round 2 — Write Code</h2>
            <span
              className={
                data.settings.round2Started ? "live-badge" : "locked-badge"
              }
            >
              {data.settings.round2Started
                ? "LIVE • 4 Questions • 100 Marks"
                : "LOCKED"}
            </span>
          </div>
          {!data.settings.round2Started ? (
            <Locked
              title="Round 2 is Locked"
              text="The administrator has not started Round 2 yet. Please wait for the admin to activate the round."
            />
          ) : (
            <>
              <R2Timer settings={data.settings} />
              {questions2.map((question, index) => {
                const old = old2.get(question.id);
                const current = value(question.id, old);
                const attempts = old?.submissionCount ?? 0;
                const MAX_ATTEMPTS = 2;
                const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attempts);
                const timedOut = (() => {
                  if (!data.settings.round2StartedAt || !data.settings.round2DurationMinutes) return false;
                  return (Date.now() - data.settings.round2StartedAt) / 60000 > data.settings.round2DurationMinutes;
                })();
                const canSubmit = attemptsLeft > 0 && !timedOut && !evaluating[question.id];
                return (
                  <article className="question-card" key={question.id}>
                    <div className="question-top">
                      <b>Question {index + 1}</b>
                      <span className={attemptsLeft === 0 ? "attempts-badge exhausted" : "attempts-badge"}>
                        {attemptsLeft === 0 ? "No attempts left" : `${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining`}
                      </span>
                    </div>
                    <h3>{question.question}</h3>

                    <label>Type your code</label>
                    <div className="blind-wrapper">
                      <span>BLIND CODE</span>
                      <textarea
                        className="legacy-input code-input"
                        placeholder="Type your answer here..."
                        value={current.answer}
                        onChange={(e) =>
                          update(question.id, "answer", e.target.value)
                        }
                        onCopy={(e) => e.preventDefault()}
                        onPaste={(e) => e.preventDefault()}
                        onCut={(e) => e.preventDefault()}
                        disabled={!canSubmit}
                      />
                    </div>
                    <button
                      className="gradient-button small"
                      onClick={() => submit2(question)}
                      disabled={!canSubmit}
                    >
                      {evaluating[question.id] ? "Submitting..." : attemptsLeft === 0 ? "Attempts Exhausted" : "Submit for Evaluation"}
                    </button>
                    {attempts > 0 && (
                      <div className="saved">
                        {data.settings.round2Finished
                          ? old?.evaluated
                            ? `✓ Score: ${old.score ?? 0} / 25 — ${old.aiFeedback ?? ""}`
                            : "⏳ Awaiting evaluation..."
                          : `✓ Answer submitted (${attempts}/${MAX_ATTEMPTS} attempts used) — scores will be revealed after Round 2 is complete.`
                        }
                      </div>
                    )}
                  </article>
                );
              })}
            </>
          )}
        </section>}
      </div>
    </>
  );
}
function R2Timer({ settings }: { settings: import("./types").EventSettings }) {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!settings.round2StartedAt || !settings.round2DurationMinutes) { setSecsLeft(null); return; }
    const endMs = settings.round2StartedAt + settings.round2DurationMinutes * 60000;
    const tick = () => setSecsLeft(Math.max(0, Math.floor((endMs - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [settings.round2StartedAt, settings.round2DurationMinutes]);
  if (secsLeft === null) return null;
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const urgent = secsLeft <= 300;
  return (
    <div className={urgent ? "r2-timer urgent" : "r2-timer"}>
      ⏱ Time Remaining: {secsLeft === 0 ? "Time's up!" : `${mins}:${String(secs).padStart(2, "0")}`}
    </div>
  );
}
function Locked({ title, text }: { title: string; text: string }) {
  return (
    <div className="locked-box">
      <div>🔒</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
function Round1Result({ data, setPage }: { data: ParticipantEvent; setPage: (page: Page) => void }) {
  const qualified = data.profile.round1Qualified === true;
  return (
    <>
      <Header profile={data.profile} onHome={() => setPage("dashboard")} onSignOut={() => signOut(clientAuth)} />
      <main className="dashboard-main">
        <div className="dashboard-card" style={{ maxWidth: 560, textAlign: "center" }}>
          <div className="badge" style={{ display: "block", marginBottom: 8 }}>Round 1 Complete</div>
          <h1>{qualified ? "You Qualified! 🎉" : "Round 1 Complete"}</h1>
          <p>All your answers have been submitted. Scores are managed by the administrator.</p>
          <div className={qualified ? "alert-success" : "alert-error"}>
            {qualified ? "PASS — you can continue to Round 2 when the administrator starts it." : "FAIL — you did not qualify for Round 2."}
          </div>
          {qualified && (
            <div style={{ marginTop: 24 }}>
              <button className="gradient-button" disabled={!data.settings.round2Started} onClick={() => setPage("round2")}>
                {data.settings.round2Started ? "NEXT: ROUND 2" : "WAIT FOR ROUND 2"}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
function QuestionEditor({ round, question, onChange, onSave }: { round: "round1" | "round2"; question: Question; onChange: (question: Question) => void; onSave: () => void }) {
  const field = (key: keyof Question, label: string, multiline = false) => multiline
    ? <label>{label}<textarea className="legacy-input code-input" value={String(question[key] ?? "")} onChange={(event) => onChange({ ...question, [key]: event.target.value })} /></label>
    : <label>{label}<input className="legacy-input" value={String(question[key] ?? "")} onChange={(event) => onChange({ ...question, [key]: event.target.value })} /></label>;
  return <article className="question-editor"><b>Question {question.questionNo}</b>{round === "round1" ? <>{field("code", "Code", true)}{field("correctedLine", "Corrected code")}{field("description", "Description", true)}</> : <>{field("question", "Prompt", true)}{field("starterCode", "Starter code (optional)", true)}{field("expectedAnswer", "Expected Answer / Behavior", true)}</>}<button className="gradient-button small" onClick={onSave}>Save Question</button></article>;
}
type ParticipantDetail = {
  round1: { questionNo: number; questionId: string; correctedLine: string | null; score: number | null; feedback: string | null; status: string }[];
  round2: { questionNo: number; questionId: string; answer: string | null; score: number | null; aiFeedback: string | null; status: string }[];
};
function AdminPage({
  setPage,
  onSignOut,
}: {
  setPage: (page: Page) => void;
  onSignOut: () => void;
}) {
  const [settings, setSettings] = useState<EventSettings>({
    round1Started: true,
    round2Started: false,
    round1Finished: false,
    round2Finished: false,
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [qualifiers, setQualifiers] = useState<Array<{ id: string; name?: string; collegeName?: string; round1Score?: number }>>([]);
  const [questions1, setQuestions1] = useState<Question[]>([]);
  const [questions2, setQuestions2] = useState<Question[]>([]);
  const [message, setMessage] = useState("");
  const [round2Duration, setRound2Duration] = useState(60);
  const [detailParticipant, setDetailParticipant] = useState<Participant | null>(null);
  const [detail, setDetail] = useState<ParticipantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  async function refresh() {
    try {
      const [event, leaderboard, passed, one, two] = await Promise.all([
        api<EventSettings>("/admin/event"),
        api<Participant[]>("/admin/leaderboard"),
        api<Array<{ id: string; name?: string; collegeName?: string; round1Score?: number }>>("/admin/qualifiers"),
        api<Question[]>("/questions/round1"),
        api<Question[]>("/questions/round2"),
      ]);
      setSettings(event);
      setParticipants(leaderboard);
      setQualifiers(passed);
      setQuestions1(one);
      setQuestions2(two);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Unable to load admin page.",
      );
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  async function openDetail(participant: Participant) {
    setDetailParticipant(participant);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await api<ParticipantDetail>(`/admin/participants/${participant.id}/answers`);
      setDetail(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load participant detail.");
    } finally {
      setDetailLoading(false);
    }
  }
  async function update(patch: Partial<EventSettings>, success: string) {
    try {
      await api("/admin/event", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setMessage(success);
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed.");
    }
  }
  async function saveQuestion(round: "round1" | "round2", question: Question) {
    const body = round === "round1"
      ? { questionNo: question.questionNo, language: question.language, code: question.code ?? "", correctedLine: question.correctedLine ?? "", description: question.description ?? "" }
      : { questionNo: question.questionNo, language: question.language, question: question.question ?? "", starterCode: question.starterCode ?? "", expectedAnswer: question.expectedAnswer ?? "" };
    try { await api(`/admin/questions/${round}/${question.id}`, { method: "PATCH", body: JSON.stringify(body) }); setMessage(`Question ${question.questionNo} updated.`); } catch (err) { setMessage(err instanceof Error ? err.message : "Question update failed."); }
  }
  const statusIcon = (s: string) => s === "evaluated" ? "✅" : s === "pending" ? "⏳" : "—";
  return (
    <>
      <header className="legacy-header">
        <Logo onClick={() => setPage("admin")} />
        <div className="admin-label">
          Admin Control{" "}
          <button className="header-logout" onClick={onSignOut}>
            Logout
          </button>
        </div>
      </header>
      <div className="admin-page">
        <h1>Blind Coding — Admin Control</h1>
        {message && <div className="alert-success">✓ {message}</div>}
        <div className="admin-grid">
          <AdminStat title="Round 1" value={settings.round1Started ? "LIVE" : "STOPPED"} live={settings.round1Started} />
          <AdminStat title="Round 2" value={settings.round2Started ? "LIVE" : "LOCKED"} live={settings.round2Started} />
          <AdminStat title="Participants" value={String(participants.length)} />
          <AdminStat title="Maximum Score" value="200" />
        </div>
        <div className="admin-controls">
          <h2>Event Controls</h2>
          {!settings.round1Started ? (
            <button className="control-start" onClick={() => update({ round1Started: true }, "Round 1 has been started.")}>▶ START ROUND 1</button>
          ) : (
            <button className="control-stop" onClick={() => update({ round1Started: false }, "Round 1 has been locked.")}>■ LOCK ROUND 1</button>
          )}
          {!settings.round2Started ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ color: "#d4c9a0", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                Duration (min):
                <input type="number" min={5} max={180} value={round2Duration} onChange={(e) => setRound2Duration(Math.max(1, Number(e.target.value)))} className="legacy-input" style={{ width: 70, marginLeft: 8 }} />
              </label>
              <button className="control-start" onClick={() => update({ round2Started: true, round2DurationMinutes: round2Duration }, `Round 2 has been started (${round2Duration} min).`)}>▶ START ROUND 2</button>
            </div>
          ) : (
            <button className="control-stop" onClick={() => update({ round2Started: false }, "Round 2 has been locked.")}>■ LOCK ROUND 2</button>
          )}
          <button className="control-finish" onClick={() => update({ round1Finished: true }, "Round 1 marked as finished.")}>Finish Round 1</button>
          <button className="control-finish" onClick={() => update({ round2Finished: true }, "Round 2 marked as finished.")}>Finish Round 2</button>
        </div>
        <div className="leaderboard">
          <h2>Live Leaderboard <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "#a09070" }}>(click a row or button to view per-question evaluation status)</span></h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th><th>Participant</th><th>College</th><th>Round 1</th><th>Round 2</th><th>Total</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant, index) => (
                <tr key={participant.id} onClick={() => openDetail(participant)} title="Click to view evaluation details">
                  <td>#{index + 1}</td>
                  <td><strong>{participant.name}</strong></td>
                  <td>{participant.collegeName}</td>
                  <td>{participant.round1} / 100</td>
                  <td>{participant.round2} / 100</td>
                  <td className="total-score">{participant.total} / 200</td>
                  <td>
                    <button className="view-detail-btn" onClick={(e) => { e.stopPropagation(); openDetail(participant); }}>
                      🔍 View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="admin-editor">
          <h2>Round 1 Qualified Participants</h2>
          {qualifiers.length === 0 ? <p>No participants have qualified yet.</p> : <ul>{qualifiers.map((student) => <li key={student.id}>{student.name ?? "Participant"} — {student.collegeName ?? ""} — {student.round1Score ?? 0} / 100</li>)}</ul>}
          <h2>Edit Round 1 Questions</h2>
          {questions1.map((question) => <QuestionEditor key={question.id} round="round1" question={question} onChange={(next) => setQuestions1((items) => items.map((item) => item.id === question.id ? next : item))} onSave={() => saveQuestion("round1", question)} />)}
          <h2>Edit Round 2 Questions</h2>
          {questions2.map((question) => <QuestionEditor key={question.id} round="round2" question={question} onChange={(next) => setQuestions2((items) => items.map((item) => item.id === question.id ? next : item))} onSave={() => saveQuestion("round2", question)} />)}
        </section>
      </div>

      {/* Participant Detail Modal */}
      {detailParticipant && (
        <div className="modal" onClick={() => setDetailParticipant(null)}>
          <div className="rules-box" style={{ maxWidth: 700, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="rules-head">
              <h2>📋 {detailParticipant.name} <span style={{ fontSize: "0.85rem", fontWeight: 400 }}>— {detailParticipant.collegeName}</span></h2>
              <button onClick={() => setDetailParticipant(null)}>×</button>
            </div>
            <p style={{ marginBottom: 8, color: "#a09070" }}>R1: {detailParticipant.round1}/100 &nbsp;|&nbsp; R2: {detailParticipant.round2}/100 &nbsp;|&nbsp; Total: {detailParticipant.total}/200</p>
            {detailLoading && <p>⏳ Loading evaluation status...</p>}
            {detail && (
              <>
                <h3 style={{ marginTop: 16 }}>Round 1 — Debugging</h3>
                <table className="r1-table">
                  <thead><tr><th>Q</th><th>Answer</th><th>Score</th><th>Status</th><th>Feedback</th></tr></thead>
                  <tbody>
                    {detail.round1.map((row) => (
                      <tr key={row.questionId}>
                        <td>Q{row.questionNo}</td>
                        <td><code style={{ fontSize: "0.75rem" }}>{row.correctedLine ?? "—"}</code></td>
                        <td className={row.score !== null && row.score >= 7 ? "score-good" : row.score !== null && row.score >= 4 ? "score-mid" : "score-bad"}>
                          {row.score !== null && row.score >= 0 ? `${row.score}/10` : "—"}
                        </td>
                        <td>{statusIcon(row.status)}</td>
                        <td style={{ fontSize: "0.8rem", color: "#c0b090" }}>{row.feedback ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3 style={{ marginTop: 20 }}>Round 2 — Write Code</h3>
                <table className="r1-table">
                  <thead><tr><th>Q</th><th>Score</th><th>Status</th><th>Feedback</th></tr></thead>
                  <tbody>
                    {detail.round2.map((row) => (
                      <tr key={row.questionId}>
                        <td>Q{row.questionNo}</td>
                        <td className={row.score !== null && row.score >= 20 ? "score-good" : row.score !== null && row.score >= 10 ? "score-mid" : "score-bad"}>
                          {row.score !== null && row.score >= 0 ? `${row.score}/25` : "—"}
                        </td>
                        <td>{statusIcon(row.status)}</td>
                        <td style={{ fontSize: "0.8rem", color: "#c0b090" }}>{row.aiFeedback ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
function AdminStat({
  title,
  value,
  live,
}: {
  title: string;
  value: string;
  live?: boolean;
}) {
  return (
    <div className="admin-stat">
      <h3>{title}</h3>
      <strong
        className={live === undefined ? "" : live ? "running" : "stopped"}
      >
        {value}
      </strong>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [page, setPage] = useState<Page>(() => {
    return (sessionStorage.getItem("app_page") as Page) || "home";
  });

  useEffect(() => {
    sessionStorage.setItem("app_page", page);
  }, [page]);
  const [event, setEvent] = useState<ParticipantEvent | null>(null);
  async function loadEvent() {
    const next = await api<ParticipantEvent>("/me/event");
    setEvent(next);
  }
  useEffect(
    () =>
      onAuthStateChanged(clientAuth, async (next) => {
        setUser(next);
        if (next) {
          const result = await getIdTokenResult(next);
          const admin = result.claims.role === "admin";
          setIsAdmin(admin);
          setPage((prevPage) => {
            if (admin) return "admin";
            if (prevPage === "login" || prevPage === "register" || prevPage === "home") return "dashboard";
            return prevPage;
          });
          if (!admin) loadEvent().catch(() => undefined);
        } else {
          setIsAdmin(false);
          setPage("home");
          setEvent(null);
        }
      }),
    [],
  );
  if (!user)
    return page === "login" || page === "register" ? (
      <Auth mode={page} setPage={setPage} />
    ) : (
      <Home setPage={setPage} />
    );
  if (isAdmin && page === "admin")
    return (
      <AdminPage setPage={setPage} onSignOut={() => signOut(clientAuth)} />
    );
  if (!event) return <div className="loading-page">Loading...</div>;
  if (page === "round1" || page === "round2")
    return (
      <EventPage
        key={page}
        data={event}
        setPage={setPage}
        onRefresh={() => loadEvent().catch(() => undefined)}
        round={page}
      />
    );
  if (page === "round1-result") return <Round1Result data={event} setPage={setPage} />;
  return (
    <Dashboard
      profile={event.profile}
      setPage={setPage}
      onSignOut={() => signOut(clientAuth)}
    />
  );
}
