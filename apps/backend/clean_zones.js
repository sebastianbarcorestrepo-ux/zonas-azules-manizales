require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'zonas_azules_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function eliminarDuplicado() {
  try {
    const res = await pool.query(`
      DELETE FROM zones
      WHERE name = 'Zona Coliseo'
        AND id NOT IN (
          SELECT id FROM zones
          WHERE name = 'Zona Coliseo'
          ORDER BY created_at ASC, id ASC
          LIMIT 1
        );
    `);

    console.log('✅ Duplicado eliminado. Registros removidos:', res.rowCount);
  } catch (err) {
    console.error('❌ Error al eliminar duplicado:', err.message);
  } finally {
    await pool.end();
  }
}

eliminarDuplicado();