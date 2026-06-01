CREATE DATABASE IF NOT EXISTS kds_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE kds_app;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(30) NOT NULL UNIQUE,
  customer_id BIGINT UNSIGNED NOT NULL,
  restaurant_name VARCHAR(160) NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address VARCHAR(255) NOT NULL,
  subtotal INT NOT NULL,
  delivery_fee INT NOT NULL,
  total INT NOT NULL,
  status ENUM('pending', 'accepted', 'preparing', 'riderAssigned', 'onTheWay', 'delivered', 'rejected') NOT NULL DEFAULT 'pending',
  rider_name VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  item_description VARCHAR(255) NOT NULL,
  item_tag VARCHAR(60) NOT NULL,
  unit_price INT NOT NULL,
  quantity INT NOT NULL,
  line_total INT NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

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
