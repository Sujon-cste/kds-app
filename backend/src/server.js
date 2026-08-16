import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
const corsOrigins = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    if (corsOrigins.includes('*') || !origin || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'kds_app',
  waitForConnections: true,
  connectionLimit: 10,
});

const menuCategories = new Set(['food', 'medicine', 'others']);

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function normalizeMenuCategory(category) {
  const normalized = String(category || 'food').trim().toLowerCase();
  return menuCategories.has(normalized) ? normalized : 'food';
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      phone: user.phone,
      name: user.name,
    },
    jwtSecret,
    { expiresIn: '7d' },
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
  };
}

function healthPayload() {
  return {
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

function auth(requiredRole) {
  return (request, response, next) => {
    const header = request.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      response.status(401).json({ message: 'Missing token' });
      return;
    }

    try {
      const user = jwt.verify(token, jwtSecret);
      if (requiredRole && user.role !== requiredRole) {
        response.status(403).json({ message: 'Forbidden' });
        return;
      }
      request.user = user;
      next();
    } catch {
      response.status(401).json({ message: 'Invalid token' });
    }
  };
}

async function findUserByPhone(phone) {
  const [rows] = await pool.execute(
    'SELECT id, name, phone, password_hash, role FROM users WHERE phone = ? AND is_active = 1 LIMIT 1',
    [phone],
  );
  return rows[0] || null;
}

async function createCustomer({ name, phone, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await pool.execute(
    'INSERT INTO users (name, phone, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, phone, passwordHash, 'customer'],
  );
  return {
    id: result.insertId,
    name,
    phone,
    role: 'customer',
  };
}

function mapOrder(row, items) {
  return {
    id: row.order_code,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address,
    restaurantName: row.restaurant_name,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    total: row.total,
    status: row.status,
    riderName: row.rider_name,
    createdAt: row.created_at,
    lines: items.map((item) => ({
      quantity: item.quantity,
      item: {
        name: item.item_name,
        description: item.item_description,
        price: item.unit_price,
        tag: item.item_tag,
      },
    })),
  };
}

async function readOrders(whereSql = '', params = []) {
  const [orderRows] = await pool.execute(
    `SELECT * FROM orders ${whereSql} ORDER BY created_at DESC`,
    params,
  );
  if (orderRows.length === 0) {
    return [];
  }

  const ids = orderRows.map((order) => order.id);
  const placeholders = ids.map(() => '?').join(',');
  const [itemRows] = await pool.execute(
    `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
    ids,
  );
  const itemsByOrderId = new Map();
  for (const item of itemRows) {
    const items = itemsByOrderId.get(item.order_id) || [];
    items.push(item);
    itemsByOrderId.set(item.order_id, items);
  }

  return orderRows.map((order) => mapOrder(order, itemsByOrderId.get(order.id) || []));
}

function mapRestaurant(row, items) {
  return {
    id: row.id,
    name: row.name,
    cuisine: row.cuisine,
    rating: Number(row.rating),
    minutes: row.minutes,
    deliveryFee: row.delivery_fee,
    colorHex: row.color_hex,
    imageUrl: row.image_url || '',
    approved: Boolean(row.is_approved),
    menu: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      tag: item.tag,
      category: item.category,
      imageUrl: item.image_url || '',
      stockQty: Number(item.stock_qty ?? 0),
    })),
  };
}

function mapShop(row, items) {
  return {
    id: row.id,
    name: row.name,
    deliveryFee: row.delivery_fee,
    colorHex: row.color_hex,
    imageUrl: row.image_url || '',
    active: Boolean(row.is_active),
    description: row.description || '',
    products: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      stockQty: Number(item.stock_qty ?? 0),
      trackStock: Boolean(item.track_stock),
      category: item.category,
      imageUrl: item.image_url || '',
    })),
  };
}

async function readRestaurants() {
  const [restaurantRows] = await pool.execute(
    `SELECT * FROM restaurants
     WHERE is_active = 1 AND is_approved = 1
     ORDER BY created_at DESC, id DESC`,
  );
  if (restaurantRows.length === 0) {
    return [];
  }

  const ids = restaurantRows.map((restaurant) => restaurant.id);
  const placeholders = ids.map(() => '?').join(',');
  const [itemRows] = await pool.execute(
    `SELECT
       restaurant_menu_items.*,
       inventory_items.stock_qty
     FROM restaurant_menu_items
     INNER JOIN restaurants ON restaurants.id = restaurant_menu_items.restaurant_id
     LEFT JOIN inventory_items
       ON inventory_items.merchant_type = 'restaurant'
      AND inventory_items.merchant_name = restaurants.name
      AND inventory_items.item_name = restaurant_menu_items.name
     WHERE restaurant_menu_items.restaurant_id IN (${placeholders})
       AND restaurant_menu_items.is_active = 1
     ORDER BY restaurant_menu_items.id ASC`,
    ids,
  );
  const itemsByRestaurantId = new Map();
  for (const item of itemRows) {
    const items = itemsByRestaurantId.get(item.restaurant_id) || [];
    items.push(item);
    itemsByRestaurantId.set(item.restaurant_id, items);
  }

  return restaurantRows.map((restaurant) =>
    mapRestaurant(restaurant, itemsByRestaurantId.get(restaurant.id) || []),
  );
}

async function readShops() {
  const [shopRows] = await pool.execute(
    `SELECT * FROM shops
     WHERE is_active = 1
     ORDER BY created_at DESC, id DESC`,
  );
  if (shopRows.length === 0) {
    return [];
  }

  const ids = shopRows.map((shop) => shop.id);
  const placeholders = ids.map(() => '?').join(',');
  const [itemRows] = await pool.execute(
    `SELECT
       shop_products.*,
       inventory_items.stock_qty,
       inventory_items.track_stock
     FROM shop_products
     INNER JOIN shops ON shops.id = shop_products.shop_id
     LEFT JOIN inventory_items
       ON inventory_items.merchant_type = 'shop'
      AND inventory_items.merchant_name = shops.name
      AND inventory_items.item_name = shop_products.name
     WHERE shop_products.shop_id IN (${placeholders})
       AND shop_products.is_active = 1
     ORDER BY shop_products.id ASC`,
    ids,
  );
  const itemsByShopId = new Map();
  for (const item of itemRows) {
    const items = itemsByShopId.get(item.shop_id) || [];
    items.push(item);
    itemsByShopId.set(item.shop_id, items);
  }

  return shopRows.map((shop) => mapShop(shop, itemsByShopId.get(shop.id) || []));
}

async function ensureColumn(tableName, columnName, definition, afterColumn) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS column_count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  if (Number(rows[0]?.column_count || 0) > 0) {
    return;
  }

  const afterClause = afterColumn ? ` AFTER ${afterColumn}` : '';
  await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}${afterClause}`);
}

async function ensureSchema() {
  await ensureColumn('restaurants', 'image_url', 'LONGTEXT NULL', 'color_hex');
  await ensureColumn('restaurant_menu_items', 'image_url', 'LONGTEXT NULL', 'tag');
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS inventory_items (
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
    )`,
  );
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS shops (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(160) NOT NULL UNIQUE,
      delivery_fee INT NOT NULL DEFAULT 50,
      color_hex VARCHAR(20) NOT NULL DEFAULT '#DFF4FF',
      image_url LONGTEXT NULL,
      description VARCHAR(255) NOT NULL DEFAULT '',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS shop_products (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      shop_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(160) NOT NULL,
      description VARCHAR(255) NOT NULL,
      price INT NOT NULL,
      category VARCHAR(60) NOT NULL DEFAULT 'general',
      image_url LONGTEXT NULL,
      stock_qty INT NOT NULL DEFAULT 0,
      track_stock TINYINT(1) NOT NULL DEFAULT 1,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_shop_products_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    )`,
  );
  await ensureColumn('inventory_items', 'track_stock', 'TINYINT(1) NOT NULL DEFAULT 1', 'stock_qty');
  await ensureColumn('inventory_items', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'track_stock');
  await ensureColumn('shop_products', 'track_stock', 'TINYINT(1) NOT NULL DEFAULT 1', 'stock_qty');

  await pool.execute(
    `INSERT INTO inventory_items (merchant_type, merchant_name, item_name, stock_qty, track_stock, is_active)
     SELECT 'restaurant', restaurants.name, restaurant_menu_items.name, 100
     FROM restaurant_menu_items
     INNER JOIN restaurants ON restaurants.id = restaurant_menu_items.restaurant_id
     WHERE restaurant_menu_items.is_active = 1
     ON DUPLICATE KEY UPDATE
       stock_qty = VALUES(stock_qty),
       track_stock = VALUES(track_stock),
       is_active = 1`,
  );

  await pool.execute(
    `INSERT INTO shops (id, name, delivery_fee, color_hex, image_url, description, is_active)
     VALUES
       (1, 'Tech Hub', 60, '#DFF4FF', NULL, 'Electronics and accessories', 1),
       (2, 'Home Bazaar', 45, '#FFF1D6', NULL, 'Home essentials and utilities', 1)
     ON DUPLICATE KEY UPDATE
       delivery_fee = VALUES(delivery_fee),
       color_hex = VALUES(color_hex),
       image_url = VALUES(image_url),
       description = VALUES(description),
       is_active = 1`,
  );

  await pool.execute(
    `INSERT INTO shop_products (shop_id, name, description, price, category, stock_qty, track_stock, is_active)
     SELECT 1, 'Wireless Headphones', 'Comfort fit, noise isolation, and long battery life.', 2490, 'electronics', 18, 1, 1
     WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE shop_id = 1 AND name = 'Wireless Headphones')`,
  );
  await pool.execute(
    `INSERT INTO shop_products (shop_id, name, description, price, category, stock_qty, track_stock, is_active)
     SELECT 1, 'Smart Watch', 'Track health, messages, and daily activity.', 3990, 'electronics', 9, 1, 1
     WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE shop_id = 1 AND name = 'Smart Watch')`,
  );
  await pool.execute(
    `INSERT INTO shop_products (shop_id, name, description, price, category, stock_qty, track_stock, is_active)
     SELECT 2, 'Laundry Detergent', 'Family-size detergent for everyday use.', 320, 'home', 25, 1, 1
     WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE shop_id = 2 AND name = 'Laundry Detergent')`,
  );
  await pool.execute(
    `INSERT INTO shop_products (shop_id, name, description, price, category, stock_qty, track_stock, is_active)
     SELECT 2, 'Electric Kettle', 'Compact kettle for quick tea and coffee.', 1590, 'home', 6, 1, 1
     WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE shop_id = 2 AND name = 'Electric Kettle')`,
  );

  await pool.execute(
    `INSERT INTO inventory_items (merchant_type, merchant_name, item_name, stock_qty, track_stock, is_active)
     SELECT 'shop', shops.name, shop_products.name, shop_products.stock_qty, shop_products.track_stock
     FROM shop_products
     INNER JOIN shops ON shops.id = shop_products.shop_id
     WHERE shop_products.is_active = 1
     ON DUPLICATE KEY UPDATE
       stock_qty = VALUES(stock_qty),
       track_stock = VALUES(track_stock),
       is_active = 1`,
  );
}

async function insertMenuItems(connection, restaurantId, menu) {
  const [restaurantRows] = await connection.execute(
    'SELECT name FROM restaurants WHERE id = ? LIMIT 1',
    [restaurantId],
  );
  const restaurantName = restaurantRows[0]?.name || '';
  for (const item of menu) {
    if (!item.name || !item.description || !item.price) {
      throw new Error('Every menu item needs name, description, and price');
    }
    const category = normalizeMenuCategory(item.category || item.tag);
    const imageUrl = String(item.imageUrl || '').trim() || null;
    await connection.execute(
      `INSERT INTO restaurant_menu_items
       (restaurant_id, name, description, price, tag, category, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        restaurantId,
        item.name,
        item.description,
        Number(item.price),
        item.tag || 'Item',
        category,
        imageUrl,
      ],
    );
    if (restaurantName) {
      await connection.execute(
        `INSERT INTO inventory_items
         (merchant_type, merchant_name, item_name, stock_qty)
         VALUES ('restaurant', ?, ?, ?)
         ON DUPLICATE KEY UPDATE stock_qty = inventory_items.stock_qty`,
        [restaurantName, item.name, Number(item.stockQty || 100)],
      );
    }
  }
}

async function syncShopInventoryItem(connection, shopName, productName, stockQty, trackStock) {
  await connection.execute(
    `INSERT INTO inventory_items (merchant_type, merchant_name, item_name, stock_qty, track_stock, is_active)
     VALUES ('shop', ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       stock_qty = VALUES(stock_qty),
       track_stock = VALUES(track_stock),
       is_active = 1`,
    [shopName, productName, Number(stockQty || 0), trackStock ? 1 : 0],
  );
}

async function insertShopProducts(connection, shopId, shopName, products) {
  for (const product of products) {
    if (!product.name || !product.description || !product.price) {
      throw new Error('Every product needs name, description, and price');
    }
    const trackStock = product.trackStock !== false;
    const stockQty = trackStock ? Number(product.stockQty || 0) : 0;
    const category = String(product.category || 'general').trim() || 'general';
    const imageUrl = String(product.imageUrl || '').trim() || null;
    await connection.execute(
      `INSERT INTO shop_products
       (shop_id, name, description, price, category, image_url, stock_qty, track_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shopId,
        product.name,
        product.description,
        Number(product.price),
        category,
        imageUrl,
        stockQty,
        trackStock ? 1 : 0,
      ],
    );
    await syncShopInventoryItem(connection, shopName, product.name, stockQty, trackStock);
  }
}

async function reserveInventoryStock(connection, merchantType, merchantName, itemName, quantity) {
  const [rows] = await connection.execute(
    `SELECT id, stock_qty, track_stock
     FROM inventory_items
     WHERE merchant_type = ? AND merchant_name = ? AND item_name = ?
     FOR UPDATE`,
    [merchantType, merchantName, itemName],
  );

  if (rows.length === 0) {
    throw new Error(`${itemName} is not available right now`);
  }

  const inventoryItem = rows[0];
  if (!Number(inventoryItem.track_stock)) {
    return;
  }
  const available = Number(inventoryItem.stock_qty || 0);
  if (available < quantity) {
    throw new Error(`Only ${available} left in stock for ${itemName}`);
  }

  await connection.execute(
    'UPDATE inventory_items SET stock_qty = stock_qty - ? WHERE id = ?',
    [quantity, inventoryItem.id],
  );
  if (merchantType === 'shop') {
    await connection.execute(
      `UPDATE shop_products
       SET stock_qty = stock_qty - ?
       WHERE shop_id = (SELECT id FROM shops WHERE name = ? LIMIT 1)
         AND name = ?`,
      [quantity, merchantName, itemName],
    );
  }
}

async function readInventoryItems() {
  const [rows] = await pool.execute(
    `SELECT id, merchant_type, merchant_name, item_name, stock_qty, track_stock, created_at, updated_at
     FROM inventory_items
     WHERE is_active = 1
     ORDER BY merchant_type ASC, merchant_name ASC, item_name ASC`,
  );
  return rows;
}

app.get(['/health', '/api/health'], (request, response) => {
  response.json(healthPayload());
});

app.get('/api', (request, response) => {
  response.json(healthPayload());
});

app.post('/auth/signup', asyncRoute(async (request, response) => {
  const phone = normalizePhone(request.body.phone);
  const name = String(request.body.name || '').trim();
  const password = String(request.body.password || '');
  if (!name || !phone || password.length < 6) {
    response.status(400).json({ message: 'Name, phone, and 6+ character password are required' });
    return;
  }

  const existing = await findUserByPhone(phone);
  if (existing) {
    response.status(409).json({ message: 'Phone number already registered' });
    return;
  }

  const user = await createCustomer({ name, phone, password });
  response.status(201).json({
    token: signToken(user),
    user: publicUser(user),
  });
}));

app.post('/auth/signin', asyncRoute(async (request, response) => {
  const phone = normalizePhone(request.body.phone);
  const password = String(request.body.password || '');
  if (!phone || !password) {
    response.status(400).json({ message: 'Phone and password are required' });
    return;
  }

  const user = await findUserByPhone(phone);
  if (!user) {
    response.status(401).json({ message: 'Invalid phone or password' });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    response.status(401).json({ message: 'Invalid phone or password' });
    return;
  }

  response.json({
    token: signToken(user),
    user: publicUser(user),
  });
}));

app.get('/restaurants', asyncRoute(async (request, response) => {
  const restaurants = await readRestaurants();
  response.json({ restaurants });
}));

app.get('/shops', asyncRoute(async (request, response) => {
  const shops = await readShops();
  response.json({ shops });
}));

app.get('/inventory', asyncRoute(async (request, response) => {
  const inventory = await readInventoryItems();
  response.json({ inventory });
}));

app.post('/restaurants', auth('admin'), asyncRoute(async (request, response) => {
  const {
    name,
    cuisine,
    rating = 4.5,
    minutes = 25,
    deliveryFee = 40,
    colorHex = '0xFFFFE7A3',
    imageUrl = '',
    menu,
  } = request.body;
  if (!name || !cuisine || !Array.isArray(menu) || menu.length === 0) {
    response.status(400).json({ message: 'Restaurant name, cuisine, and menu are required' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [restaurantResult] = await connection.execute(
      `INSERT INTO restaurants
       (name, cuisine, rating, minutes, delivery_fee, color_hex, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, cuisine, rating, minutes, deliveryFee, colorHex, String(imageUrl || '').trim() || null],
    );

    await insertMenuItems(connection, restaurantResult.insertId, menu);

    await connection.commit();
    const restaurants = await readRestaurants();
    const restaurant = restaurants.find((entry) => entry.id === restaurantResult.insertId);
    response.status(201).json({ restaurant });
  } catch (error) {
    await connection.rollback();
    response.status(400).json({ message: error.message });
  } finally {
    connection.release();
  }
}));

app.put('/restaurants/:id', auth('admin'), asyncRoute(async (request, response) => {
  const {
    name,
    cuisine,
    rating = 4.5,
    minutes = 25,
    deliveryFee = 40,
    colorHex = '0xFFFFE7A3',
    imageUrl = '',
    menu,
  } = request.body;
  const restaurantId = Number(request.params.id);
  if (!restaurantId || !name || !cuisine || !Array.isArray(menu) || menu.length === 0) {
    response.status(400).json({ message: 'Restaurant name, cuisine, and menu are required' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.execute(
      'SELECT name FROM restaurants WHERE id = ? LIMIT 1',
      [restaurantId],
    );
    const previousName = existingRows[0]?.name || '';
    const [updateResult] = await connection.execute(
      `UPDATE restaurants
       SET name = ?, cuisine = ?, rating = ?, minutes = ?, delivery_fee = ?, color_hex = ?, image_url = ?
       WHERE id = ?`,
      [name, cuisine, rating, minutes, deliveryFee, colorHex, String(imageUrl || '').trim() || null, restaurantId],
    );
    if (updateResult.affectedRows === 0) {
      throw new Error('Restaurant not found');
    }

    await connection.execute(
      'DELETE FROM restaurant_menu_items WHERE restaurant_id = ?',
      [restaurantId],
    );
    await insertMenuItems(connection, restaurantId, menu);
    if (previousName && previousName !== name) {
      await connection.execute(
        'UPDATE inventory_items SET merchant_name = ? WHERE merchant_type = ? AND merchant_name = ?',
        [name, 'restaurant', previousName],
      );
    }

    await connection.commit();
    const restaurants = await readRestaurants();
    const restaurant = restaurants.find((entry) => entry.id === restaurantId);
    response.json({ restaurant });
  } catch (error) {
    await connection.rollback();
    response.status(400).json({ message: error.message });
  } finally {
    connection.release();
  }
}));

app.delete('/restaurants/:id', auth('admin'), asyncRoute(async (request, response) => {
  const restaurantId = Number(request.params.id);
  if (!restaurantId) {
    response.status(400).json({ message: 'Invalid restaurant id' });
    return;
  }

  const [deleteResult] = await pool.execute(
    'UPDATE restaurants SET is_active = 0 WHERE id = ? AND is_active = 1',
    [restaurantId],
  );
  if (deleteResult.affectedRows === 0) {
    response.status(404).json({ message: 'Restaurant not found' });
    return;
  }

  response.json({ success: true });
}));

app.post('/shops', auth('admin'), asyncRoute(async (request, response) => {
  const {
    name,
    deliveryFee = 50,
    colorHex = '#DFF4FF',
    imageUrl = '',
    active = true,
    description = '',
    products,
  } = request.body;
  if (!name || !Array.isArray(products) || products.length === 0) {
    response.status(400).json({ message: 'Shop name and products are required' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [shopResult] = await connection.execute(
      `INSERT INTO shops
       (name, delivery_fee, color_hex, image_url, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, deliveryFee, colorHex, String(imageUrl || '').trim() || null, description, active ? 1 : 0],
    );

    await insertShopProducts(connection, shopResult.insertId, name, products);

    await connection.commit();
    const shops = await readShops();
    const shop = shops.find((entry) => entry.id === shopResult.insertId);
    response.status(201).json({ shop });
  } catch (error) {
    await connection.rollback();
    response.status(400).json({ message: error.message });
  } finally {
    connection.release();
  }
}));

app.put('/shops/:id', auth('admin'), asyncRoute(async (request, response) => {
  const {
    name,
    deliveryFee = 50,
    colorHex = '#DFF4FF',
    imageUrl = '',
    active = true,
    description = '',
    products,
  } = request.body;
  const shopId = Number(request.params.id);
  if (!shopId || !name || !Array.isArray(products) || products.length === 0) {
    response.status(400).json({ message: 'Shop name and products are required' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.execute(
      'SELECT name FROM shops WHERE id = ? LIMIT 1',
      [shopId],
    );
    const previousName = existingRows[0]?.name || '';
    const [updateResult] = await connection.execute(
      `UPDATE shops
       SET name = ?, delivery_fee = ?, color_hex = ?, image_url = ?, description = ?, is_active = ?
       WHERE id = ?`,
      [name, deliveryFee, colorHex, String(imageUrl || '').trim() || null, description, active ? 1 : 0, shopId],
    );
    if (updateResult.affectedRows === 0) {
      throw new Error('Shop not found');
    }

    await connection.execute('DELETE FROM shop_products WHERE shop_id = ?', [shopId]);
    await insertShopProducts(connection, shopId, name, products);
    if (previousName && previousName !== name) {
      await connection.execute(
        'UPDATE inventory_items SET merchant_name = ? WHERE merchant_type = ? AND merchant_name = ?',
        [name, 'shop', previousName],
      );
    }

    await connection.commit();
    const shops = await readShops();
    const shop = shops.find((entry) => entry.id === shopId);
    response.json({ shop });
  } catch (error) {
    await connection.rollback();
    response.status(400).json({ message: error.message });
  } finally {
    connection.release();
  }
}));

app.delete('/shops/:id', auth('admin'), asyncRoute(async (request, response) => {
  const shopId = Number(request.params.id);
  if (!shopId) {
    response.status(400).json({ message: 'Invalid shop id' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [deleteResult] = await connection.execute(
      'UPDATE shops SET is_active = 0 WHERE id = ? AND is_active = 1',
      [shopId],
    );
    if (deleteResult.affectedRows === 0) {
      response.status(404).json({ message: 'Shop not found' });
      await connection.rollback();
      return;
    }

    const [shopRows] = await connection.execute(
      'SELECT name FROM shops WHERE id = ? LIMIT 1',
      [shopId],
    );
    const shopName = shopRows[0]?.name || '';
    if (shopName) {
      await connection.execute(
        'UPDATE inventory_items SET is_active = 0 WHERE merchant_type = ? AND merchant_name = ?',
        ['shop', shopName],
      );
      await connection.execute(
        'UPDATE shop_products SET is_active = 0 WHERE shop_id = ?',
        [shopId],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    response.status(500).json({ message: error.message });
    return;
  } finally {
    connection.release();
  }

  response.json({ success: true });
}));

app.patch('/inventory/:id', auth('admin'), asyncRoute(async (request, response) => {
  const inventoryId = Number(request.params.id);
  const stockQty = Number(request.body.stockQty);
  if (!inventoryId || !Number.isInteger(stockQty) || stockQty < 0) {
    response.status(400).json({ message: 'Enter a valid stock quantity' });
    return;
  }

  const [updateResult] = await pool.execute(
    'UPDATE inventory_items SET stock_qty = ? WHERE id = ?',
    [stockQty, inventoryId],
  );
  if (updateResult.affectedRows === 0) {
    response.status(404).json({ message: 'Inventory item not found' });
    return;
  }

  const [rows] = await pool.execute(
    `SELECT id, merchant_type, merchant_name, item_name, stock_qty, track_stock, created_at, updated_at
     FROM inventory_items
     WHERE id = ?
     LIMIT 1`,
    [inventoryId],
  );
  const inventory = rows[0] || null;
  if (inventory?.merchant_type === 'shop') {
    await pool.execute(
      `UPDATE shop_products
       SET stock_qty = ?
       WHERE is_active = 1
         AND shop_id = (SELECT id FROM shops WHERE name = ? LIMIT 1)
         AND name = ?`,
      [stockQty, inventory.merchant_name, inventory.item_name],
    );
  }
  response.json({ inventory });
}));

app.post('/orders', auth('customer'), asyncRoute(async (request, response) => {
  const {
    merchantType = 'restaurant',
    restaurantName,
    customerName,
    phone,
    address,
    subtotal,
    deliveryFee,
    lines,
  } =
    request.body;
  if (!restaurantName || !address || !Array.isArray(lines) || lines.length === 0) {
    response.status(400).json({ message: 'Invalid order payload' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const total = Number(subtotal) + Number(deliveryFee);
    const [orderResult] = await connection.execute(
      `INSERT INTO orders
       (order_code, customer_id, restaurant_name, customer_name, phone, address, subtotal, delivery_fee, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `KDS-${Date.now()}`,
        request.user.id,
        restaurantName,
        customerName || request.user.name,
        phone || request.user.phone,
        address,
        subtotal,
        deliveryFee,
        total,
      ],
    );

    for (const line of lines) {
      const quantity = Number(line.quantity || 0);
      const itemName = String(line.item?.name || '').trim();
      if (!itemName || !Number.isInteger(quantity) || quantity <= 0) {
        throw new Error('Invalid order item payload');
      }

      await reserveInventoryStock(connection, merchantType, restaurantName, itemName, quantity);
      await connection.execute(
        `INSERT INTO order_items
         (order_id, item_name, item_description, item_tag, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderResult.insertId,
          itemName,
          String(line.item.description || ''),
          String(line.item.tag || 'Item'),
          Number(line.item.price || 0),
          quantity,
          Number(line.item.price || 0) * quantity,
        ],
      );
    }

    await connection.commit();
    const [orders] = await readOrders('WHERE id = ?', [orderResult.insertId]);
    response.status(201).json({ order: orders });
  } catch (error) {
    await connection.rollback();
    const message = String(error.message || '');
    if (message.includes('not available') || message.includes('left in stock')) {
      response.status(409).json({ message });
      return;
    }
    if (message.includes('Invalid order item payload')) {
      response.status(400).json({ message });
      return;
    }
    response.status(500).json({ message });
  } finally {
    connection.release();
  }
}));

app.get('/orders', auth(), asyncRoute(async (request, response) => {
  const orders = request.user.role === 'admin'
    ? await readOrders()
    : await readOrders('WHERE customer_id = ?', [request.user.id]);
  response.json({ orders });
}));

app.get('/orders/:orderCode', auth(), asyncRoute(async (request, response) => {
  const [rows] = await pool.execute(
    'SELECT customer_id FROM orders WHERE order_code = ? LIMIT 1',
    [request.params.orderCode],
  );
  if (rows.length === 0) {
    response.status(404).json({ message: 'Order not found' });
    return;
  }
  if (request.user.role !== 'admin' && rows[0].customer_id !== request.user.id) {
    response.status(403).json({ message: 'Forbidden' });
    return;
  }

  const [order] = await readOrders('WHERE order_code = ?', [request.params.orderCode]);
  response.json({ order });
}));

app.patch('/orders/:orderCode/status', auth('admin'), asyncRoute(async (request, response) => {
  const { status, riderName } = request.body;
  const allowedStatuses = [
    'pending',
    'accepted',
    'preparing',
    'riderAssigned',
    'onTheWay',
    'delivered',
    'rejected',
  ];
  if (!allowedStatuses.includes(status)) {
    response.status(400).json({ message: 'Invalid status' });
    return;
  }

  await pool.execute(
    'UPDATE orders SET status = ?, rider_name = COALESCE(?, rider_name) WHERE order_code = ?',
    [status, riderName || null, request.params.orderCode],
  );
  const [orders] = await readOrders('WHERE order_code = ?', [request.params.orderCode]);
  response.json({ order: orders });
}));

app.use((error, request, response, next) => {
  if (error.code?.startsWith('ER_ACCESS_DENIED')) {
    response.status(503).json({
      message: 'Database login failed. Check MYSQL_USER and MYSQL_PASSWORD in backend/.env.',
    });
    return;
  }
  if (error.code === 'ER_BAD_DB_ERROR') {
    response.status(503).json({
      message: 'Database not found. Import backend/sql/schema.sql first.',
    });
    return;
  }
  if (error.code === 'ECONNREFUSED') {
    response.status(503).json({
      message: 'MySQL server is not running.',
    });
    return;
  }
  response.status(500).json({ message: error.message });
});

app.listen(port, host, () => {
  console.log(`KDS API running on http://${host}:${port}`);
  void ensureSchema().catch((error) => {
    console.warn('Schema check skipped or failed:', error.message);
  });
});
