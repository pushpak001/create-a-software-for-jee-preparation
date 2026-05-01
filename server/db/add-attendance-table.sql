USE jee_mock_test;

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

-- Optional: create today's attendance rows for all registered students as Absent.
-- Change the test code date if needed.
INSERT INTO test_attendance (student_id, test_code, status)
SELECT id, CONCAT('JEE-', CURDATE()), 'A'
FROM students
ON DUPLICATE KEY UPDATE student_id = test_attendance.student_id;
