USE kds_app;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS image_url LONGTEXT NULL AFTER color_hex;

ALTER TABLE restaurant_menu_items
  ADD COLUMN IF NOT EXISTS image_url LONGTEXT NULL AFTER tag;
