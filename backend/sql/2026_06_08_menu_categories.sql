USE kds_app;

ALTER TABLE restaurant_menu_items
  ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'food' AFTER price;

UPDATE restaurant_menu_items
SET category = 'food'
WHERE category IS NULL OR category = '';
