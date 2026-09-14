require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'zonas_azules_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function setupTablas() {
  try {
    // 1. Crear tabla parking_spots
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parking_spots (
        id SERIAL PRIMARY KEY,
        zone_id INT REFERENCES zones(id) ON DELETE CASCADE,
        spot_number VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'available',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Convertir spot_number a VARCHAR si ya existia como INTEGER
    await pool.query(`
      ALTER TABLE parking_spots 
      ALTER COLUMN spot_number TYPE VARCHAR(20) USING spot_number::VARCHAR;
    `);

    // 2. Crear tabla parking_sessions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parking_sessions (
        id SERIAL PRIMARY KEY,
        spot_id INT REFERENCES parking_spots(id) ON DELETE CASCADE,
        license_plate VARCHAR(10) NOT NULL,
        entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        exit_time TIMESTAMP NULL,
        total_amount DECIMAL(10, 2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'active'
      );
    `);

    console.log('✅ Tablas parking_spots y parking_sessions configuradas.');

    // 3. Obtener ID de Zona Coliseo e insertar celdas COL-01 a COL-05
    const zoneRes = await pool.query("SELECT id FROM zones WHERE name = 'Zona Coliseo' LIMIT 1;");
    
    if (zoneRes.rows.length > 0) {
      const coliseoId = zoneRes.rows[0].id;

      for (let i = 1; i <= 5; i++) {
        const spotNum = `COL-0${i}`;
        await pool.query(`
          INSERT INTO parking_spots (zone_id, spot_number, status)
          VALUES ($1, $2, 'available');
        `, [coliseoId, spotNum]);
      }
      console.log('✅ Celdas COL-01 a COL-05 creadas exitosamente para el Coliseo.');
    }

  } catch (err) {
    console.error('❌ Error al configurar tablas:', err.message);
  } finally {
    await pool.end();
  }
}

setupTablas();