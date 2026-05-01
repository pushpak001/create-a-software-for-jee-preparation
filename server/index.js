import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, isDatabaseConfigured } from './mysql.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, '..', 'dist');
const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function getTestCode(date = new Date()) {
  return `JEE-${date.toISOString().slice(0, 10)}`;
}

async function readQuestions() {
  const file = await fs.readFile(path.join(__dirname, 'data', 'questions.json'), 'utf8');
  return JSON.parse(file);
}

async function ensureAttendanceForStudent(pool, studentId, testCode) {
  await pool.execute(
    `INSERT INTO test_attendance (student_id, test_code, status)
     VALUES (?, ?, 'A')
     ON DUPLICATE KEY UPDATE student_id = VALUES(student_id)`,
    [studentId, testCode]
  );
}

async function ensureAttendanceForAllStudents(pool, testCode) {
  await pool.execute(
    `INSERT INTO test_attendance (student_id, test_code, status)
     SELECT id, ?, 'A' FROM students
     ON DUPLICATE KEY UPDATE student_id = test_attendance.student_id`,
    [testCode]
  );
}

function publicQuestion(question) {
  const { answer, ...safeQuestion } = question;
  return safeQuestion;
}

function scoreAttempt(questions, responses) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  const checkedResponses = Object.entries(responses).map(([questionId, response]) => {
    const question = byId.get(questionId);
    const selected = Number.isInteger(response?.selected) ? response.selected : null;
    if (!question || selected === null) {
      unanswered += 1;
      return { questionId, selected: null, status: 'unanswered', marks: 0 };
    }

    if (selected === question.answer) {
      correct += 1;
      score += question.marks;
      return { questionId, selected, status: 'correct', marks: question.marks };
    }

    wrong += 1;
    score -= question.negative;
    return { questionId, selected, status: 'wrong', marks: -question.negative };
  });

  unanswered += questions.length - checkedResponses.length;

  return {
    score,
    totalMarks: questions.reduce((sum, question) => sum + question.marks, 0),
    correct,
    wrong,
    unanswered,
    checkedResponses
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mysqlConfigured: isDatabaseConfigured() });
});

app.get('/api/questions', async (_req, res, next) => {
  try {
    const questions = await readQuestions();
    res.json({ questions: questions.map(publicQuestion) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/attendance', async (req, res, next) => {
  try {
    if (!isDatabaseConfigured()) {
      return res.status(503).json({ error: 'MySQL/RDS is not configured. Attendance requires the database.' });
    }

    const testCode = req.query.testCode || getTestCode();
    const pool = getPool();
    await ensureAttendanceForAllStudents(pool, testCode);

    const [attendance] = await pool.execute(
      `SELECT
         s.id AS student_id,
         s.name,
         s.email,
         s.phone,
         a.test_code,
         a.status,
         CASE WHEN a.status = 'P' THEN 'Present' ELSE 'Absent' END AS attendance_label,
         a.marked_at,
         a.attempt_id
       FROM students s
       LEFT JOIN test_attendance a
         ON a.student_id = s.id AND a.test_code = ?
       ORDER BY s.name ASC`,
      [testCode]
    );

    res.json({ testCode, attendance });
  } catch (error) {
    next(error);
  }
});

app.post('/api/students/login', async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Candidate name and email are required.' });
    }

    if (!isDatabaseConfigured()) {
      return res.status(503).json({
        error: 'MySQL/RDS is not configured. Login is allowed only for students already saved in the database.'
      });
    }

    const pool = getPool();
    const [students] = await pool.execute(
      'SELECT id, name, email, phone FROM students WHERE email = ? LIMIT 1',
      [email]
    );

    if (students.length === 0) {
      return res.status(401).json({ error: 'Login denied. This email is not registered in the database.' });
    }

    const savedStudent = students[0];
    const submittedName = name.trim().toLowerCase();
    const savedName = savedStudent.name.trim().toLowerCase();
    const submittedPhone = String(phone || '').trim();
    const savedPhone = String(savedStudent.phone || '').trim();

    if (submittedName !== savedName) {
      return res.status(401).json({ error: 'Login denied. Candidate name does not match database records.' });
    }

    if (savedPhone && submittedPhone !== savedPhone) {
      return res.status(401).json({ error: 'Login denied. Phone number does not match database records.' });
    }

    await ensureAttendanceForStudent(pool, savedStudent.id, getTestCode());

    res.json({
      saved: true,
      student: savedStudent
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/attendance/mark-present', async (req, res, next) => {
  try {
    const { student } = req.body;
    if (!student?.id || !student?.email) {
      return res.status(400).json({ error: 'Student ID and email are required to mark attendance.' });
    }

    if (!isDatabaseConfigured()) {
      return res.status(503).json({ error: 'MySQL/RDS is not configured. Attendance requires the database.' });
    }

    const pool = getPool();
    const [students] = await pool.execute(
      'SELECT id FROM students WHERE id = ? AND email = ? LIMIT 1',
      [student.id, student.email]
    );

    if (students.length === 0) {
      return res.status(401).json({ error: 'Attendance rejected. Student is not registered in the database.' });
    }

    const testCode = getTestCode();
    const markedAt = new Date();
    await pool.execute(
      `INSERT INTO test_attendance (student_id, test_code, status, marked_at)
       VALUES (?, ?, 'P', ?)
       ON DUPLICATE KEY UPDATE status = 'P', marked_at = VALUES(marked_at)`,
      [student.id, testCode, markedAt]
    );

    res.json({ saved: true, attendance: { studentId: student.id, testCode, status: 'P', markedAt } });
  } catch (error) {
    next(error);
  }
});

app.post('/api/attempts', async (req, res, next) => {
  try {
    const { student, responses, startedAt, submittedAt, durationSeconds } = req.body;
    if (!student?.id || !student?.name || !student?.email || !responses || !startedAt || !submittedAt) {
      return res.status(400).json({ error: 'Missing student, responses, startedAt, or submittedAt.' });
    }

    const questions = await readQuestions();
    const result = scoreAttempt(questions, responses);
    const attempt = {
      testCode: getTestCode(),
      startedAt,
      submittedAt,
      durationSeconds: Number(durationSeconds || 0),
      responses,
      questions: questions.map(publicQuestion),
      result
    };

    if (!isDatabaseConfigured()) {
      return res.status(503).json({ error: 'MySQL/RDS is not configured. Attempts can be saved only for registered students.' });
    }

    const pool = getPool();
    const [students] = await pool.execute(
      'SELECT id FROM students WHERE id = ? AND email = ? LIMIT 1',
      [student.id, student.email]
    );

    if (students.length === 0) {
      return res.status(401).json({ error: 'Attempt rejected. Student is not registered in the database.' });
    }

    const [attemptRows] = await pool.execute(
      `INSERT INTO test_attempts
       (student_id, test_code, started_at, submitted_at, duration_seconds, score, total_marks,
        correct_count, wrong_count, unanswered_count, responses_json, questions_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON))`,
      [
        student.id,
        attempt.testCode,
        new Date(startedAt),
        new Date(submittedAt),
        attempt.durationSeconds,
        result.score,
        result.totalMarks,
        result.correct,
        result.wrong,
        result.unanswered,
        JSON.stringify(responses),
        JSON.stringify(attempt.questions)
      ]
    );

    await pool.execute(
      `INSERT INTO test_attendance (student_id, test_code, status, attempt_id, marked_at)
       VALUES (?, ?, 'P', ?, ?)
       ON DUPLICATE KEY UPDATE status = 'P', attempt_id = VALUES(attempt_id), marked_at = VALUES(marked_at)`,
      [student.id, attempt.testCode, attemptRows.insertId, new Date(submittedAt)]
    );

    res.json({ saved: true, attempt });
  } catch (error) {
    next(error);
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Server error', detail: error.message });
});

app.listen(port, () => {
  console.log(`JEE mock test API running on http://localhost:${port}`);
});
