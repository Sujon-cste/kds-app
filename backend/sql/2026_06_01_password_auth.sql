USE kds_app;

ALTER TABLE users
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER phone;

UPDATE users
SET password_hash = '$2a$10$8VAXHqcUB1/Tm0wTQOAsROi/hADCtBkMAxZLqv0JyT6Y94/Tw3SzW'
WHERE role = 'admin' AND phone = '01700000000';

UPDATE users
SET password_hash = '$2a$10$8VAXHqcUB1/Tm0wTQOAsROi/hADCtBkMAxZLqv0JyT6Y94/Tw3SzW'
WHERE password_hash IS NULL;

ALTER TABLE users
  MODIFY password_hash VARCHAR(255) NOT NULL;

DROP TABLE IF EXISTS otp_codes;

INSERT INTO users (name, phone, password_hash, role)
VALUES (
  'KDS Super Admin',
  '01700000000',
  '$2a$10$8VAXHqcUB1/Tm0wTQOAsROi/hADCtBkMAxZLqv0JyT6Y94/Tw3SzW',
  'admin'
)
ON DUPLICATE KEY UPDATE
  role = 'admin',
  name = VALUES(name),
  password_hash = VALUES(password_hash),
  is_active = 1;
