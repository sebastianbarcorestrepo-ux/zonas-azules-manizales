require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'zonas_azules_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function agregarZona() {
  try {
    // Crear tabla zones por si no existe en esta BD
    await pool.query(`
      CREATE TABLE IF NOT EXISTS zones (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        address VARCHAR(200) NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        rate_per_minute DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insertar la Zona Coliseo
    const res = await pool.query(`
      INSERT INTO zones (name, address, latitude, longitude, rate_per_minute)
      VALUES ('Zona Coliseo', 'Carrera 24 entre Calles 63 y 65', 5.0601, -75.4985, 100.00)
      RETURNING *;
    `);

    console.log('✅ Zona agregada con éxito:', res.rows[0]);
  } catch (err) {
    console.error('❌ Error al insertar:', err.message);
  } finally {
    await pool.end();
  }
}

agregarZona();