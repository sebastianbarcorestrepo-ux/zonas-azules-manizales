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

// 1. Obtener todas las zonas de parqueo
app.get('/api/zones', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM zones ORDER BY id ASC;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Obtener las celdas de una zona por su ID o por su Nombre
app.get('/api/zones/:identifier/spots', async (req, res) => {
  const { identifier } = req.params;
  try {
    // Buscar celdas por ID o por coincidencia parcial del nombre de la zona
    const result = await pool.query(
      `SELECT s.* 
       FROM parking_spots s
       JOIN zones z ON s.zone_id = z.id
       WHERE z.id::text = $1 OR LOWER(z.name) LIKE LOWER($2)
       ORDER BY s.spot_number ASC;`,
      [identifier, `%${identifier}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Endpoint para que la camara/video OCUPE una celda y registre la placa
app.post('/api/spots/occupy', async (req, res) => {
  const { spot_id, license_plate } = req.body;
  try {
    // Cambiar estado de la celda a ocupado
    await pool.query("UPDATE parking_spots SET status = 'occupied' WHERE id = $1;", [spot_id]);

    // Crear la sesion de parqueo activa
    const session = await pool.query(
      "INSERT INTO parking_sessions (spot_id, license_plate, status) VALUES ($1, $2, 'active') RETURNING *;",
      [spot_id, license_plate]
    );

    res.json({ message: 'Celda ocupada con exito', session: session.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Endpoint para que la camara/video LIBERE una celda y liquide el cobro
app.post('/api/spots/release', async (req, res) => {
  const { spot_id } = req.body;
  try {
    // Cambiar estado a disponible
    await pool.query("UPDATE parking_spots SET status = 'available' WHERE id = $1;", [spot_id]);

    // Finalizar la sesion activa y calcular total
    const session = await pool.query(
      `UPDATE parking_sessions 
       SET exit_time = CURRENT_TIMESTAMP, 
           status = 'completed',
           total_amount = GREATEST(100.00, ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - entry_time))/60 * 100.00, 2))
       WHERE spot_id = $1 AND status = 'active'
       RETURNING *;`,
      [spot_id]
    );

    res.json({ message: 'Celda liberada con exito', session: session.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutandose en http://localhost:${PORT}`);
});