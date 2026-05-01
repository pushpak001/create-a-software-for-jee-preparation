USE jee_mock_test;

-- Add registered students here. Only students in this table can login.
-- Replace these sample values with your real student details.

INSERT INTO students (name, email, phone)
VALUES
  ('Pushpak', 'pushpak@gmail.com', '9146756738')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  phone = VALUES(phone);
