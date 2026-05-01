import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, Flag, LogOut, UserRound } from 'lucide-react';
import './styles.css';

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics'];
const TEST_DURATION_SECONDS = 150 * 60;

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function groupedQuestions(questions) {
  return SUBJECTS.reduce((groups, subject) => {
    groups[subject] = questions.filter((question) => question.subject === subject);
    return groups;
  }, {});
}

function getQuestionStatus(questionId, responses, visited) {
  const response = responses[questionId];
  if (response?.marked && Number.isInteger(response.selected)) return 'answered-marked';
  if (response?.marked) return 'marked';
  if (Number.isInteger(response?.selected)) return 'answered';
  if (visited.has(questionId)) return 'not-answered';
  return 'not-visited';
}

function LoginScreen({ onLogin, loginStatus, onViewAttendance }) {
  const [student, setStudent] = useState({ name: '', email: '', phone: '' });

  function submit(event) {
    event.preventDefault();
    onLogin(student);
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-strip">
          <span>Magnivus Tech Education Foundation</span>
          <strong>JEE Main Mock Test Portal</strong>
        </div>
        <form className="login-card" onSubmit={submit}>
          <div className="login-title">
            <UserRound size={38} />
            <div>
              <h1>Candidate Login</h1>
              <p>Only registered candidates saved in the database can enter.</p>
            </div>
          </div>
          <label>
            Candidate Name
            <input required value={student.name} onChange={(event) => setStudent({ ...student, name: event.target.value })} />
          </label>
          <label>
            Email / Login ID
            <input required type="email" value={student.email} onChange={(event) => setStudent({ ...student, email: event.target.value })} />
          </label>
          <label>
            Phone
            <input value={student.phone} onChange={(event) => setStudent({ ...student, phone: event.target.value })} />
          </label>
          {loginStatus?.message && <p className={`login-status ${loginStatus.type}`}>{loginStatus.message}</p>}
          <button type="submit" className="primary-btn" disabled={loginStatus?.type === 'saving'}>
            {loginStatus?.type === 'saving' ? 'Saving Login...' : 'Sign In'}
          </button>
          <button type="button" className="secondary-btn" onClick={onViewAttendance}>
            <ClipboardList size={16} /> Attendance Section
          </button>
        </form>
      </section>
    </main>
  );
}

function InstructionScreen({ student, onStart }) {
  const [accepted, setAccepted] = useState(false);
  const [attendanceAccepted, setAttendanceAccepted] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState(null);

  async function beginTest() {
    setAttendanceStatus({ type: 'saving', message: 'Marking attendance...' });
    try {
      const response = await fetch('/api/attendance/mark-present', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not mark attendance.');
      }

      setAttendanceStatus({ type: 'success', message: 'Attendance marked as P - Present.' });
      onStart();
    } catch (error) {
      setAttendanceStatus({ type: 'error', message: error.message });
    }
  }

  return (
    <main className="instruction-page">
      <header className="nta-header">
        <div>
          <span>JEE Main Mock Test</span>
          <strong>General Instructions</strong>
        </div>
        <div className="candidate-chip">{student.name}</div>
      </header>
      <section className="instruction-shell">
        <div className="instruction-copy">
          <h1>Please read the instructions carefully</h1>
          <ol>
            <li>Total test duration is 2 hours 30 minutes.</li>
            <li>The paper contains Physics, Chemistry, and Mathematics with 30 questions in each subject.</li>
            <li>Each correct answer carries 4 marks. Each wrong answer carries -1 mark.</li>
            <li>You can use Save & Next, Clear Response, Mark for Review, and subject tabs during the test.</li>
            <li>The test submits automatically when the timer reaches zero.</li>
            <li>Your responses, score, and question JSON are saved to MySQL/RDS when database credentials are configured.</li>
          </ol>
          <label className="terms">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            I have read and understood the instructions and agree to the terms and conditions.
          </label>
          <label className="terms attendance-check">
            <input type="checkbox" checked={attendanceAccepted} onChange={(event) => setAttendanceAccepted(event.target.checked)} />
            Mark my attendance as Present (P) for today's mock test.
          </label>
          {attendanceStatus?.message && <p className={`login-status ${attendanceStatus.type}`}>{attendanceStatus.message}</p>}
        </div>
        <button className="primary-btn wide" disabled={!accepted || !attendanceAccepted || attendanceStatus?.type === 'saving'} onClick={beginTest}>
          {attendanceStatus?.type === 'saving' ? 'Marking Attendance...' : 'I am ready to begin'}
        </button>
      </section>
    </main>
  );
}

function TestScreen({ student, questions, onSubmit }) {
  const groups = useMemo(() => groupedQuestions(questions), [questions]);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [visited, setVisited] = useState(new Set([questions[0]?.id]));
  const [secondsLeft, setSecondsLeft] = useState(TEST_DURATION_SECONDS);
  const [startedAt] = useState(new Date().toISOString());
  const currentQuestions = groups[subject] || [];
  const current = currentQuestions[index] || questions[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          onSubmit({ student, responses, startedAt, durationSeconds: TEST_DURATION_SECONDS });
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onSubmit, responses, startedAt, student]);

  useEffect(() => {
    if (current?.id) {
      setVisited((previous) => new Set(previous).add(current.id));
    }
  }, [current?.id]);

  function chooseOption(optionIndex) {
    setResponses((previous) => ({
      ...previous,
      [current.id]: { ...previous[current.id], selected: optionIndex }
    }));
  }

  function goToQuestion(nextSubject, nextIndex) {
    setSubject(nextSubject);
    setIndex(nextIndex);
  }

  function nextQuestion() {
    if (index < currentQuestions.length - 1) {
      setIndex(index + 1);
      return;
    }

    const nextSubject = SUBJECTS[SUBJECTS.indexOf(subject) + 1];
    if (nextSubject) {
      setSubject(nextSubject);
      setIndex(0);
    }
  }

  function markForReview() {
    setResponses((previous) => ({
      ...previous,
      [current.id]: { ...previous[current.id], marked: true }
    }));
    nextQuestion();
  }

  function saveAndNext() {
    setResponses((previous) => ({
      ...previous,
      [current.id]: { ...previous[current.id], marked: false }
    }));
    nextQuestion();
  }

  function clearResponse() {
    setResponses((previous) => {
      const next = { ...previous };
      if (next[current.id]?.marked) {
        next[current.id] = { marked: true };
      } else {
        delete next[current.id];
      }
      return next;
    });
  }

  function submitNow() {
    onSubmit({ student, responses, startedAt, durationSeconds: TEST_DURATION_SECONDS - secondsLeft });
  }

  const counts = questions.reduce((summary, question) => {
    summary[getQuestionStatus(question.id, responses, visited)] += 1;
    return summary;
  }, { 'answered': 0, 'not-answered': 0, 'not-visited': 0, 'marked': 0, 'answered-marked': 0 });

  return (
    <main className="exam-page">
      <header className="exam-topbar">
        <div className="exam-title">
          <strong>JEE Main Mock Test</strong>
          <span>Computer Based Test</span>
        </div>
        <div className="timer"><Clock3 size={18} /> Time Left: {formatTime(secondsLeft)}</div>
      </header>

      <div className="subject-tabs">
        {SUBJECTS.map((name) => (
          <button key={name} className={name === subject ? 'active' : ''} onClick={() => goToQuestion(name, 0)}>{name}</button>
        ))}
      </div>

      <section className="exam-layout">
        <article className="question-area">
          <div className="question-meta">
            <span>Question No. {index + 1}</span>
            <span>Marks: +4 / -1</span>
          </div>
          <div className="question-box">
            <p>{current.question}</p>
            <div className="options">
              {current.options.map((option, optionIndex) => (
                <label key={option} className={responses[current.id]?.selected === optionIndex ? 'selected' : ''}>
                  <input
                    type="radio"
                    name={current.id}
                    checked={responses[current.id]?.selected === optionIndex}
                    onChange={() => chooseOption(optionIndex)}
                  />
                  <span>{optionIndex + 1}</span>
                  {option}
                </label>
              ))}
            </div>
          </div>
          <div className="action-bar">
            <button onClick={saveAndNext} className="save-btn">Save & Next</button>
            <button onClick={clearResponse}>Clear Response</button>
            <button onClick={markForReview} className="review-btn"><Flag size={16} /> Mark for Review & Next</button>
            <button onClick={submitNow} className="submit-btn">Submit</button>
          </div>
        </article>

        <aside className="palette-panel">
          <div className="candidate-box">
            <div className="avatar">{student.name.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{student.name}</strong>
              <span>{student.email}</span>
            </div>
          </div>
          <div className="legend">
            <Legend state="answered" label="Answered" count={counts.answered} />
            <Legend state="not-answered" label="Not Answered" count={counts['not-answered']} />
            <Legend state="not-visited" label="Not Visited" count={counts['not-visited']} />
            <Legend state="marked" label="Marked" count={counts.marked} />
            <Legend state="answered-marked" label="Answered & Marked" count={counts['answered-marked']} />
          </div>
          <h2>{subject}</h2>
          <div className="palette-grid">
            {currentQuestions.map((question, questionIndex) => {
              const status = getQuestionStatus(question.id, responses, visited);
              return (
                <button
                  key={question.id}
                  className={`palette-number ${status} ${questionIndex === index ? 'current' : ''}`}
                  onClick={() => goToQuestion(subject, questionIndex)}
                >
                  {questionIndex + 1}
                </button>
              );
            })}
          </div>
        </aside>
      </section>
    </main>
  );
}

function Legend({ state, label, count }) {
  return (
    <div className="legend-row">
      <span className={`palette-number tiny ${state}`}>{count}</span>
      <span>{label}</span>
    </div>
  );
}

function ResultScreen({ result, onRestart }) {
  const attempt = result?.attempt;
  const details = attempt?.result;

  return (
    <main className="result-page">
      <section className="result-panel">
        <div className="result-icon"><CheckCircle2 size={54} /></div>
        <h1>Test Submitted Successfully</h1>
        <p>{result?.saved ? 'Result saved in MySQL/RDS database.' : 'Result calculated locally. Add RDS credentials in .env to save in MySQL.'}</p>
        <div className="score-card">
          <span>Score</span>
          <strong>{details?.score ?? 0} / {details?.totalMarks ?? 360}</strong>
        </div>
        <div className="result-grid">
          <div><span>Correct</span><strong>{details?.correct ?? 0}</strong></div>
          <div><span>Wrong</span><strong>{details?.wrong ?? 0}</strong></div>
          <div><span>Unanswered</span><strong>{details?.unanswered ?? 0}</strong></div>
          <div><span>Test Code</span><strong>{attempt?.testCode}</strong></div>
        </div>
        <button className="primary-btn" onClick={onRestart}><LogOut size={16} /> Back to Login</button>
      </section>
    </main>
  );
}

function AttendanceScreen({ onBack }) {
  const [attendance, setAttendance] = useState([]);
  const [testCode, setTestCode] = useState('');
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');

  useEffect(() => {
    fetch('/api/attendance')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not load attendance.');
        }
        setAttendance(data.attendance || []);
        setTestCode(data.testCode || '');
      })
      .catch((error) => setAttendanceError(error.message))
      .finally(() => setLoadingAttendance(false));
  }, []);

  const presentCount = attendance.filter((row) => row.status === 'P').length;
  const absentCount = attendance.filter((row) => row.status === 'A').length;

  return (
    <main className="attendance-page">
      <header className="nta-header">
        <div>
          <span>Magnivus Tech Education Foundation</span>
          <strong>Attendance Section</strong>
        </div>
        <button className="header-btn" onClick={onBack}>Back to Login</button>
      </header>
      <section className="attendance-shell">
        <div className="attendance-summary">
          <div>
            <span>Test Code</span>
            <strong>{testCode || 'Today'}</strong>
          </div>
          <div>
            <span>Present</span>
            <strong>P: {presentCount}</strong>
          </div>
          <div>
            <span>Absent</span>
            <strong>A: {absentCount}</strong>
          </div>
        </div>

        {loadingAttendance && <p className="attendance-message">Loading attendance...</p>}
        {attendanceError && <p className="attendance-message error">{attendanceError}</p>}
        {!loadingAttendance && !attendanceError && (
          <div className="attendance-table-wrap">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Meaning</th>
                  <th>Marked At</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((row) => (
                  <tr key={`${row.student_id}-${row.test_code}`}>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td><span className={`attendance-badge ${row.status}`}>{row.status}</span></td>
                    <td>{row.attendance_label}</td>
                    <td>{row.marked_at ? new Date(row.marked_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function App() {
  const [screen, setScreen] = useState('login');
  const [student, setStudent] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loginStatus, setLoginStatus] = useState(null);

  useEffect(() => {
    fetch('/api/questions')
      .then((response) => response.json())
      .then((data) => setQuestions(data.questions || []))
      .catch(() => setError('Could not load question paper. Start the backend server and try again.'))
      .finally(() => setLoading(false));
  }, []);

  async function login(nextStudent) {
    setLoginStatus({ type: 'saving', message: 'Saving candidate details...' });
    try {
      const response = await fetch('/api/students/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextStudent)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not save login details.');
      }

      setStudent(data.student || nextStudent);
      setLoginStatus({
        type: 'success',
        message: 'Login verified from MySQL/RDS.'
      });
      setScreen('instructions');
    } catch (loginError) {
      setLoginStatus({ type: 'error', message: loginError.message });
    }
  }

  async function submitAttempt(payload) {
    setLoading(true);
    try {
      const response = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, submittedAt: new Date().toISOString() })
      });
      const data = await response.json();
      setResult(data);
      setScreen('result');
    } catch {
      setError('Could not submit test. Please check the API server.');
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <main className="error-page">
        <AlertTriangle size={42} />
        <h1>{error}</h1>
      </main>
    );
  }

  if (loading && screen !== 'test') {
    return <main className="loading-page">Loading JEE mock test...</main>;
  }

  if (screen === 'login') {
    return (
      <LoginScreen
        onLogin={login}
        loginStatus={loginStatus}
        onViewAttendance={() => setScreen('attendance')}
      />
    );
  }
  if (screen === 'attendance') return <AttendanceScreen onBack={() => setScreen('login')} />;
  if (screen === 'instructions') return <InstructionScreen student={student} onStart={() => setScreen('test')} />;
  if (screen === 'test') return <TestScreen student={student} questions={questions} onSubmit={submitAttempt} />;
  return <ResultScreen result={result} onRestart={() => window.location.reload()} />;
}

createRoot(document.getElementById('root')).render(<App />);
