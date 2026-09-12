require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión forzando la base de datos zonas_azules_db
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'zonas_azules_db',
  password: process.env.DB_PASSWORD || 'admin123',
  port: process.env.DB_PORT || 5432,
});

// Ruta para verificar salud del servidor
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'OK', message: 'Conexión a PostgreSQL exitosa', time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// Ruta para obtener las Zonas Azules
app.get('/api/zones', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM zones');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});