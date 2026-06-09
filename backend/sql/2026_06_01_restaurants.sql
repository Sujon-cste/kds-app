USE kds_app;

CREATE TABLE IF NOT EXISTS restaurants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  cuisine VARCHAR(160) NOT NULL,
  rating DECIMAL(2,1) NOT NULL DEFAULT 4.5,
  minutes INT NOT NULL DEFAULT 25,
  delivery_fee INT NOT NULL DEFAULT 40,
  color_hex VARCHAR(20) NOT NULL DEFAULT '0xFFFFE7A3',
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
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

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
