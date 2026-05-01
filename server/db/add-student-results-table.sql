USE jee_mock_test;

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
