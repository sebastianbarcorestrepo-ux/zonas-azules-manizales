require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'zonas_azules_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Tarifa oficial: $3.900 COP / Hora (calculada por minuto)
const TARIFA_POR_MINUTO = 3900 / 60; 

// 1. Obtener todas las zonas de parqueo
app.get('/api/zones', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM zones ORDER BY id ASC;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Obtener las celdas con placa activa
app.get('/api/zones/:identifier/spots', async (req, res) => {
  const { identifier } = req.params;
  try {
    const result = await pool.query(
      `SELECT s.*, ps.license_plate AS current_plate 
       FROM parking_spots s
       JOIN zones z ON s.zone_id = z.id
       LEFT JOIN parking_sessions ps ON ps.spot_id = s.id AND ps.status = 'active'
       WHERE z.id::text = $1 OR LOWER(z.name) LIKE LOWER($2)
       ORDER BY s.spot_number ASC;`,
      [identifier, `%${identifier}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Endpoint: Ocupar celda
app.post('/api/spots/occupy', async (req, res) => {
  const { spot_id, license_plate } = req.body;
  try {
    await pool.query("UPDATE parking_spots SET status = 'occupied' WHERE id = $1;", [spot_id]);

    const session = await pool.query(
      "INSERT INTO parking_sessions (spot_id, license_plate, status) VALUES ($1, $2, 'active') RETURNING *;",
      [spot_id, license_plate]
    );

    res.json({ message: 'Celda ocupada con exito', session: session.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Endpoint: Liberar celda y liquidar a $3.900 COP / hora
app.post('/api/spots/release', async (req, res) => {
  const { spot_id } = req.body;
  try {
    await pool.query("UPDATE parking_spots SET status = 'available' WHERE id = $1;", [spot_id]);

    // Calcula minutos transcurridos e impone una tarifa minima de $3.900 si fue menos de una hora
    const session = await pool.query(
      `UPDATE parking_sessions 
       SET exit_time = CURRENT_TIMESTAMP, 
           status = 'completed',
           total_amount = GREATEST(3900.00, ROUND((EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - entry_time))/3600) * 3900.00, 2))
       WHERE spot_id = $1 AND status = 'active'
       RETURNING *;`,
      [spot_id]
    );

    res.json({ message: 'Celda liberada con exito', session: session.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Endpoint: Crear nueva celda
app.post('/api/spots', async (req, res) => {
  const { zone_id, spot_number } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO parking_spots (zone_id, spot_number, status) VALUES ($1, $2, 'available') RETURNING *;",
      [zone_id, spot_number]
    );
    res.json({ message: 'Celda creada con exito', spot: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Endpoint: Recaudo acumulado por zona
app.get('/api/zones/:identifier/revenue', async (req, res) => {
  const { identifier } = req.params;
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(ps.total_amount), 0) AS total_revenue, COUNT(ps.id) AS total_sessions
       FROM parking_sessions ps
       JOIN parking_spots s ON ps.spot_id = s.id
       JOIN zones z ON s.zone_id = z.id
       WHERE (z.id::text = $1 OR LOWER(z.name) LIKE LOWER($2)) AND ps.status = 'completed';`,
      [identifier, `%${identifier}%`]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutandose en http://localhost:${PORT}`);
});