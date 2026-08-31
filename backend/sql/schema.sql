CREATE DATABASE IF NOT EXISTS kds_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE kds_app;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL UNIQUE,
  nid VARCHAR(20) NULL,
  email VARCHAR(160) NULL,
  address VARCHAR(255) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'admin', 'rider', 'regionalAdmin', 'other') NOT NULL DEFAULT 'customer',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  cuisine VARCHAR(160) NOT NULL,
  rating DECIMAL(2,1) NOT NULL DEFAULT 4.5,
  minutes INT NOT NULL DEFAULT 25,
  delivery_fee INT NOT NULL DEFAULT 40,
  color_hex VARCHAR(20) NOT NULL DEFAULT '0xFFFFE7A3',
  image_url LONGTEXT NULL,
  is_approved TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurant_menu_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(255) NOT NULL,
  price INT NOT NULL,
  category VARCHAR(20) NOT NULL DEFAULT 'food',
  tag VARCHAR(60) NOT NULL DEFAULT 'Item',
  image_url LONGTEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
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
  rider_id BIGINT UNSIGNED NULL,
  rider_name VARCHAR(120) NULL,
  rider_phone VARCHAR(30) NULL,
  status_history LONGTEXT NULL,
  rider_issue VARCHAR(255) NULL,
  rider_issue_at TIMESTAMP NULL,
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

CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  merchant_type VARCHAR(20) NOT NULL,
  merchant_name VARCHAR(160) NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  stock_qty INT NOT NULL DEFAULT 100,
  track_stock TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_inventory_item (merchant_type, merchant_name, item_name)
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

INSERT INTO restaurants (id, name, cuisine, rating, minutes, delivery_fee, color_hex)
VALUES
  (1, 'Khilkhet Biryani House', 'Bangla, Biryani', 4.7, 24, 40, '0xFFFFE7A3'),
  (2, 'Airport Thai & Fast Food', 'Thai, Chinese', 4.5, 28, 40, '0xFFFFC8B8'),
  (3, 'Nikunj Burger Point', 'Burger, Fried Chicken', 4.4, 19, 40, '0xFFD9F99D')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  cuisine = VALUES(cuisine),
  rating = VALUES(rating),
  minutes = VALUES(minutes),
  delivery_fee = VALUES(delivery_fee),
  color_hex = VALUES(color_hex),
  is_active = 1,
  is_approved = 1;

INSERT INTO restaurant_menu_items
  (restaurant_id, name, description, price, tag)
SELECT 1, 'Chicken Biryani', 'Aromatic rice, tender chicken, salad', 180, 'Popular'
WHERE NOT EXISTS (SELECT 1 FROM restaurant_menu_items WHERE restaurant_id = 1 AND name = 'Chicken Biryani');
INSERT INTO restaurant_menu_items
  (restaurant_id, name, description, price, tag)
SELECT 1, 'Beef Tehari', 'Classic Dhaka tehari with mustard oil', 220, 'Local'
WHERE NOT EXISTS (SELECT 1 FROM restaurant_menu_items WHERE restaurant_id = 1 AND name = 'Beef Tehari');
INSERT INTO restaurant_menu_items
  (restaurant_id, name, description, price, tag)
SELECT 1, 'Borhani', 'Chilled spiced yogurt drink', 45, 'Drink'
WHERE NOT EXISTS (SELECT 1 FROM restaurant_menu_items WHERE restaurant_id = 1 AND name = 'Borhani');
INSERT INTO restaurant_menu_items
  (restaurant_id, name, description, price, tag)
SELECT 2, 'Chicken Fried Rice', 'Egg, vegetables, chicken and house sauce', 170, 'Combo'
WHERE NOT EXISTS (SELECT 1 FROM restaurant_menu_items WHERE restaurant_id = 2 AND name = 'Chicken Fried Rice');
INSERT INTO restaurant_menu_items
  (restaurant_id, name, description, price, tag)
SELECT 2, 'Thai Soup', 'Warm soup with chicken and prawns', 140, 'Hot'
WHERE NOT EXISTS (SELECT 1 FROM restaurant_menu_items WHERE restaurant_id = 2 AND name = 'Thai Soup');
INSERT INTO restaurant_menu_items
  (restaurant_id, name, description, price, tag)
SELECT 2, 'Wonton', 'Crispy wonton with chili dip', 130, 'Snack'
WHERE NOT EXISTS (SELECT 1 FROM restaurant_menu_items WHERE restaurant_id = 2 AND name = 'Wonton');
INSERT INTO restaurant_menu_items
  (restaurant_id, name, description, price, tag)
SELECT 3, 'Smoky Chicken Burger', 'Grilled patty, cheese, house sauce', 210, 'New'
WHERE NOT EXISTS (SELECT 1 FROM restaurant_menu_items WHERE restaurant_id = 3 AND name = 'Smoky Chicken Burger');
INSERT INTO restaurant_menu_items
  (restaurant_id, name, description, price, tag)
SELECT 3, 'Crispy Wings', 'Six pieces with garlic mayo', 240, 'Crispy'
WHERE NOT EXISTS (SELECT 1 FROM restaurant_menu_items WHERE restaurant_id = 3 AND name = 'Crispy Wings');
INSERT INTO restaurant_menu_items
  (restaurant_id, name, description, price, tag)
SELECT 3, 'French Fries', 'Salted fries with ketchup', 90, 'Side'
WHERE NOT EXISTS (SELECT 1 FROM restaurant_menu_items WHERE restaurant_id = 3 AND name = 'French Fries');

INSERT INTO inventory_items (merchant_type, merchant_name, item_name, stock_qty, track_stock, is_active)
VALUES
  ('shop', 'Tech Hub', 'Wireless Headphones', 18, 1, 1),
  ('shop', 'Tech Hub', 'Smart Watch', 9, 1, 1),
  ('shop', 'Home Bazaar', 'Laundry Detergent', 25, 1, 1),
  ('shop', 'Home Bazaar', 'Electric Kettle', 6, 1, 1)
ON DUPLICATE KEY UPDATE
  stock_qty = VALUES(stock_qty),
  track_stock = VALUES(track_stock),
  is_active = 1;
