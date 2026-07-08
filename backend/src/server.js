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
    approved: Boolean(row.is_approved),
    menu: items.map((item) => ({
      name: item.name,
      description: item.description,
      price: item.price,
      tag: item.tag,
      category: item.category,
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
    `SELECT * FROM restaurant_menu_items
     WHERE restaurant_id IN (${placeholders}) AND is_active = 1
     ORDER BY id ASC`,
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

async function insertMenuItems(connection, restaurantId, menu) {
  for (const item of menu) {
    if (!item.name || !item.description || !item.price) {
      throw new Error('Every menu item needs name, description, and price');
    }
    const category = normalizeMenuCategory(item.category || item.tag);
    await connection.execute(
      `INSERT INTO restaurant_menu_items
       (restaurant_id, name, description, price, tag, category)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        restaurantId,
        item.name,
        item.description,
        Number(item.price),
        item.tag || 'Item',
        category,
      ],
    );
  }
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

app.post('/restaurants', auth('admin'), asyncRoute(async (request, response) => {
  const {
    name,
    cuisine,
    rating = 4.5,
    minutes = 25,
    deliveryFee = 40,
    colorHex = '0xFFFFE7A3',
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
       (name, cuisine, rating, minutes, delivery_fee, color_hex)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, cuisine, rating, minutes, deliveryFee, colorHex],
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
    const [updateResult] = await connection.execute(
      `UPDATE restaurants
       SET name = ?, cuisine = ?, rating = ?, minutes = ?, delivery_fee = ?, color_hex = ?
       WHERE id = ?`,
      [name, cuisine, rating, minutes, deliveryFee, colorHex, restaurantId],
    );
    if (updateResult.affectedRows === 0) {
      throw new Error('Restaurant not found');
    }

    await connection.execute(
      'DELETE FROM restaurant_menu_items WHERE restaurant_id = ?',
      [restaurantId],
    );
    await insertMenuItems(connection, restaurantId, menu);

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

app.post('/orders', auth('customer'), asyncRoute(async (request, response) => {
  const { restaurantName, customerName, phone, address, subtotal, deliveryFee, lines } =
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
      await connection.execute(
        `INSERT INTO order_items
         (order_id, item_name, item_description, item_tag, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderResult.insertId,
          line.item.name,
          line.item.description,
          line.item.tag,
          line.item.price,
          line.quantity,
          line.item.price * line.quantity,
        ],
      );
    }

    await connection.commit();
    const [orders] = await readOrders('WHERE id = ?', [orderResult.insertId]);
    response.status(201).json({ order: orders });
  } catch (error) {
    await connection.rollback();
    response.status(500).json({ message: error.message });
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
});
