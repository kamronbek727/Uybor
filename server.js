require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'uybor',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

// Helper to format rows to camelCase
const camelCase = (obj) => {
  if (!obj) return null;
  const newObj = {};
  for (let key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// --- AUTH & USERS ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
    if (rows.length > 0) {
      res.json(camelCase(rows[0]));
    } else {
      res.status(401).json({ error: 'Login yoki parol xato' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users');
    res.json(rows.map(camelCase));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { id, username, password, name, role, phone } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (id, username, password, name, role, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, username, password, name, role || 'makler', phone]
    );
    res.json(camelCase(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { name, username, password, phone } = req.body;
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'UPDATE users SET name=$1, username=$2, password=$3, phone=$4 WHERE id=$5 RETURNING *',
      [name, username, password, phone, id]
    );
    res.json(camelCase(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- LISTINGS ---
app.get('/api/listings', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT *, loc_lat as "locLat", loc_lng as "locLng", address_text as "addressText", makler_id as "maklerId", created_at as "createdAt" FROM listings');
    const formatted = rows.map(r => {
      const c = camelCase(r);
      c.loc = { lat: c.locLat, lng: c.locLng };
      delete c.locLat;
      delete c.locLng;
      return c;
    });
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/listings', async (req, res) => {
  const { id, maklerId, createdAt, loc, addressText, price, currency, category, type, rooms, area, images, desc } = req.body;
  try {
    await pool.query(
      `INSERT INTO listings (id, makler_id, created_at, loc_lat, loc_lng, address_text, price, currency, category, type, rooms, area, images, description) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, maklerId, createdAt || new Date(), loc?.lat || 0, loc?.lng || 0, addressText, price, currency, category, type, rooms, area, JSON.stringify(images || []), desc]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/listings/:id', async (req, res) => {
  const { loc, addressText, price, currency, category, type, rooms, area, images, desc } = req.body;
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE listings SET loc_lat=$1, loc_lng=$2, address_text=$3, price=$4, currency=$5, category=$6, type=$7, rooms=$8, area=$9, images=$10, description=$11 WHERE id=$12`,
      [loc?.lat || 0, loc?.lng || 0, addressText, price, currency, category, type, rooms, area, JSON.stringify(images || []), desc, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/listings/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM listings WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ARCHIVE ---
app.post('/api/archive/sell/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({
      error: "E'lon topilmadi"
    });
    const l = rows[0];
    await pool.query(
      `INSERT INTO archive (id, makler_id, created_at, sold_at, loc_lat, loc_lng, address_text, price, currency, category, type, rooms, area, images, description)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [l.id, l.makler_id, l.created_at, l.loc_lat, l.loc_lng, l.address_text, l.price, l.currency, l.category, l.type, l.rooms, l.area, JSON.stringify(l.images || []), l.description]
    );
    await pool.query('DELETE FROM listings WHERE id = $1', [id]);
    await pool.query('DELETE FROM requests WHERE listing_id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/archive', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT *, loc_lat as "locLat", loc_lng as "locLng", address_text as "addressText", makler_id as "maklerId", created_at as "createdAt", sold_at as "soldAt" FROM archive');
    const formatted = rows.map(r => {
      const c = camelCase(r);
      c.loc = { lat: c.locLat, lng: c.locLng };
      delete c.locLat;
      delete c.locLng;
      return c;
    });
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/archive', async (req, res) => {
  const { id, maklerId, createdAt, soldAt, loc, addressText, price, currency, category, type, rooms, area, images, desc } = req.body;
  try {
    await pool.query(
      `INSERT INTO archive (id, makler_id, created_at, sold_at, loc_lat, loc_lng, address_text, price, currency, category, type, rooms, area, images, description) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [id, maklerId, createdAt, soldAt || new Date(), loc?.lat || 0, loc?.lng || 0, addressText, price, currency, category, type, rooms, area, JSON.stringify(images || []), desc]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/archive/:id', async (req, res) => {
  const { loc, addressText, price, currency, category, type, rooms, area, images, desc } = req.body;
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE archive SET loc_lat=$1, loc_lng=$2, address_text=$3, price=$4, currency=$5, category=$6, type=$7, rooms=$8, area=$9, images=$10, description=$11 WHERE id=$12`,
      [loc?.lat || 0, loc?.lng || 0, addressText, price, currency, category, type, rooms, area, JSON.stringify(images || []), desc, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/archive/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM archive WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REQUESTS ---
app.get('/api/requests', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, listing_id as "listingId", makler_id as "maklerId", request_date as "date" FROM requests');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requests', async (req, res) => {
  const { id, listingId, maklerId, date } = req.body;
  try {
    await pool.query(
      `INSERT INTO requests (id, listing_id, makler_id, request_date) VALUES ($1, $2, $3, $4)`,
      [id, listingId, maklerId, date || new Date()]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/requests/approve/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: reqs } = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    if (reqs.length === 0) return res.status(404).json({
      error: "So'rov topilmadi"
    });
    const listingId = reqs[0].listing_id;

    const { rows } = await pool.query('SELECT * FROM listings WHERE id = $1', [listingId]);
    if (rows.length > 0) {
      const l = rows[0];
      await pool.query(
        `INSERT INTO archive (id, makler_id, created_at, sold_at, loc_lat, loc_lng, address_text, price, currency, category, type, rooms, area, images, description)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [l.id, l.makler_id, l.created_at, l.loc_lat, l.loc_lng, l.address_text, l.price, l.currency, l.category, l.type, l.rooms, l.area, JSON.stringify(l.images || []), l.description]
      );
      await pool.query('DELETE FROM listings WHERE id = $1', [listingId]);
    }
    await pool.query('DELETE FROM requests WHERE listing_id = $1', [listingId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.delete('/api/requests/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM requests WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`UyBor API Server running on port ${PORT}`);
});
