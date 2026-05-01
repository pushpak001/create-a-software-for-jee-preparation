CREATE DATABASE IF NOT EXISTS jee_mock_test;
USE jee_mock_test;

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  test_code VARCHAR(40) NOT NULL,
  started_at DATETIME NOT NULL,
  submitted_at DATETIME NOT NULL,
  duration_seconds INT NOT NULL,
  score INT NOT NULL,
  total_marks INT NOT NULL,
  correct_count INT NOT NULL,
  wrong_count INT NOT NULL,
  unanswered_count INT NOT NULL,
  responses_json JSON NOT NULL,
  questions_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attempt_student FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS student_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  student_name VARCHAR(120) NOT NULL,
  result_date DATE NOT NULL,
  test_code VARCHAR(40) NOT NULL,
  marks INT NOT NULL,
  total_marks INT NOT NULL,
  attempt_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_student_result_attempt (attempt_id),
  CONSTRAINT fk_result_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_result_attempt FOREIGN KEY (attempt_id) REFERENCES test_attempts(id)
);

CREATE TABLE IF NOT EXISTS test_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  test_code VARCHAR(40) NOT NULL,
  status ENUM('P', 'A') NOT NULL DEFAULT 'A',
  attempt_id INT,
  marked_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_student_test_attendance (student_id, test_code),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_attendance_attempt FOREIGN KEY (attempt_id) REFERENCES test_attempts(id)
);
