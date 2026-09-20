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

type Page = "home" | "login" | "register" | "dashboard" | "event" | "admin";

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
      CODE<span>⚡</span>ARENA
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
              onClick={() => setPage("event")}
            >
              I AGREE &amp; START EVENT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function ScoreCards({ scores }: { scores: ParticipantEvent["scores"] }) {
  return (
    <div className="score-grid">
      <div>
        <h3>Round 1</h3>
        <strong>{scores.round1} / 100</strong>
      </div>
      <div>
        <h3>Round 2</h3>
        <strong>{scores.round2} / 100</strong>
      </div>
      <div>
        <h3>Total</h3>
        <strong>{scores.total} / 200</strong>
      </div>
    </div>
  );
}
function EventPage({
  data,
  setPage,
  onRefresh,
}: {
  data: ParticipantEvent;
  setPage: (page: Page) => void;
  onRefresh: () => void;
}) {
  const [questions1, setQuestions1] = useState<Question[]>([]);
  const [questions2, setQuestions2] = useState<Question[]>([]);
  const [message, setMessage] = useState("");
  const [values, setValues] = useState<
    Record<
      string,
      {
        errorLine: string;
        correctedLine: string;
        description: string;
        answer: string;
      }
    >
  >({});
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
        errorLine: answer?.errorLine ?? "",
        correctedLine: answer?.correctedLine ?? "",
        description: answer?.description ?? "",
        answer: answer?.answer ?? "",
      }
    );
  }
  async function submit1(question: Question) {
    const current = value(question.id, old1.get(question.id));
    setMessage("");
    try {
      await api("/submissions/round1", {
        method: "POST",
        body: JSON.stringify({
          questionId: question.id,
          errorLine: current.errorLine,
          correctedLine: current.correctedLine,
          description: current.description,
        }),
      });
      setMessage("Answer saved successfully.");
      onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Invalid submission.");
    }
  }
  async function submit2(question: Question) {
    const current = value(question.id, old2.get(question.id));
    setMessage("");
    try {
      const result = await api<{ score: number; feedback?: string }>(
        "/submissions/round2",
        {
          method: "POST",
          body: JSON.stringify({
            questionId: question.id,
            answer: current.answer,
          }),
        },
      );
      setMessage(
        `Evaluation completed. Score: ${result.score} / 25. ${result.feedback ?? ""}`,
      );
      onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Evaluation failed.");
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
        <section className="event-hero">
          <h1>
            BLIND <span>CODING</span>
          </h1>
          <p>Debug. Think. Code. Compete.</p>
          <ScoreCards scores={data.scores} />
        </section>
        {message && (
          <div className="alert-success event-message">{message}</div>
        )}
        <section className="round-section">
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
            questions1.map((question) => {
              const old = old1.get(question.id);
              const current = value(question.id, old);
              return (
                <article className="question-card" key={question.id}>
                  <div className="question-top">
                    <b>Question {question.questionNo}</b>
                    <span>10 Marks</span>
                  </div>
                  <pre>{question.code}</pre>
                  <div className="description">
                    <b>Error Description:</b>
                    <br />
                    {question.description}
                  </div>
                  <label>1. Enter the error line number — 5 Marks</label>
                  <input
                    className="legacy-input"
                    placeholder="Example: 6"
                    value={current.errorLine}
                    onChange={(e) =>
                      update(question.id, "errorLine", e.target.value)
                    }
                  />
                  <label>2. Enter the corrected error line — 5 Marks</label>
                  <input
                    className="legacy-input"
                    placeholder="Enter corrected code line"
                    value={current.correctedLine}
                    onChange={(e) =>
                      update(question.id, "correctedLine", e.target.value)
                    }
                  />
                  <label>Explanation</label>
                  <textarea
                    className="legacy-input code-input"
                    placeholder="Explain the error..."
                    value={current.description}
                    onChange={(e) =>
                      update(question.id, "description", e.target.value)
                    }
                  />
                  <button
                    className="gradient-button small"
                    onClick={() => submit1(question)}
                  >
                    Save Answer
                  </button>
                  {old && (
                    <div className="saved">
                      ✓ Answer saved — Score: {old.score ?? 0} / 10
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>
        <section className="round-section">
          <div className="round-heading">
            <h2>Round 2 — Blind Coding</h2>
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
            questions2.map((question) => {
              const old = old2.get(question.id);
              const current = value(question.id, old);
              return (
                <article className="question-card" key={question.id}>
                  <div className="question-top">
                    <b>Question {question.questionNo}</b>
                    <span>25 Marks</span>
                  </div>
                  <h3>{question.question}</h3>
                  <div className="description">
                    <b>Input / Test Cases:</b>
                    <br />
                    {question.testCases}
                  </div>
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
                    />
                  </div>
                  <button
                    className="gradient-button small"
                    onClick={() => submit2(question)}
                  >
                    Submit for AI Evaluation
                  </button>
                  {old && old.evaluated ? (
                    <div className="evaluation">
                      <b>AI Evaluation</b>
                      <br />
                      <br />
                      Score: <strong>{old.score ?? 0} / 25</strong>
                      <br />
                      Syntax Errors: {old.syntaxErrors ?? 0}
                      <br />
                      Logical Errors: {old.logicalErrors ?? 0}
                      <br />
                      <br />
                      {old.aiFeedback}
                    </div>
                  ) : (
                    old && (
                      <div className="waiting">
                        ⏳ Waiting for evaluation...
                      </div>
                    )
                  )}
                </article>
              );
            })
          )}
        </section>
      </div>
    </>
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
  const [message, setMessage] = useState("");
  async function refresh() {
    try {
      const [event, leaderboard] = await Promise.all([
        api<EventSettings>("/admin/event"),
        api<Participant[]>("/admin/leaderboard"),
      ]);
      setSettings(event);
      setParticipants(leaderboard);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Unable to load admin page.",
      );
    }
  }
  useEffect(() => {
    refresh();
  }, []);
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
          <AdminStat
            title="Round 1"
            value={settings.round1Started ? "LIVE" : "STOPPED"}
            live={settings.round1Started}
          />
          <AdminStat
            title="Round 2"
            value={settings.round2Started ? "LIVE" : "LOCKED"}
            live={settings.round2Started}
          />
          <AdminStat title="Participants" value={String(participants.length)} />
          <AdminStat title="Maximum Score" value="200" />
        </div>
        <div className="admin-controls">
          <h2>Event Controls</h2>
          {!settings.round1Started ? (
            <button
              className="control-start"
              onClick={() =>
                update({ round1Started: true }, "Round 1 has been started.")
              }
            >
              ▶ START ROUND 1
            </button>
          ) : (
            <button
              className="control-stop"
              onClick={() =>
                update({ round1Started: false }, "Round 1 has been locked.")
              }
            >
              ■ LOCK ROUND 1
            </button>
          )}
          {!settings.round2Started ? (
            <button
              className="control-start"
              onClick={() =>
                update({ round2Started: true }, "Round 2 has been started.")
              }
            >
              ▶ START ROUND 2
            </button>
          ) : (
            <button
              className="control-stop"
              onClick={() =>
                update({ round2Started: false }, "Round 2 has been locked.")
              }
            >
              ■ LOCK ROUND 2
            </button>
          )}
          <button
            className="control-finish"
            onClick={() =>
              update({ round1Finished: true }, "Round 1 marked as finished.")
            }
          >
            Finish Round 1
          </button>
          <button
            className="control-finish"
            onClick={() =>
              update({ round2Finished: true }, "Round 2 marked as finished.")
            }
          >
            Finish Round 2
          </button>
        </div>
        <div className="leaderboard">
          <h2>Live Leaderboard</h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Participant</th>
                <th>College</th>
                <th>Round 1</th>
                <th>Round 2</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant, index) => (
                <tr key={participant.id}>
                  <td>#{index + 1}</td>
                  <td>{participant.name}</td>
                  <td>{participant.collegeName}</td>
                  <td>{participant.round1} / 100</td>
                  <td>{participant.round2} / 100</td>
                  <td className="total-score">{participant.total} / 200</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
  const [page, setPage] = useState<Page>("home");
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
          setPage(admin ? "admin" : "dashboard");
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
  if (page === "event")
    return (
      <EventPage
        data={event}
        setPage={setPage}
        onRefresh={() => loadEvent().catch(() => undefined)}
      />
    );
  return (
    <Dashboard
      profile={event.profile}
      setPage={setPage}
      onSignOut={() => signOut(clientAuth)}
    />
  );
}
