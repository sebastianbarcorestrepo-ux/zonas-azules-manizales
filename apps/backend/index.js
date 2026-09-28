const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// ==========================================
// SERVIR ARCHIVOS ESTÁTICOS Y RUTA FRONTEND
// ==========================================
// Se calcula dinámicamente la ruta absoluta hacia /apps/frontend
const frontendPath = path.resolve(__dirname, '../frontend');

app.use(express.static(frontendPath));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// ==========================================
// RUTAS DE NAVEGACIÓN Y ARCHIVOS HTML
// ==========================================

// RUTA RAÍZ: REDIRECCIÓN INTELIGENTE
app.get('/', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|wv|Mobile/i.test(userAgent);

  if (isMobile) {
    return res.sendFile(path.join(frontendPath, 'mobile.html'));
  }

  return res.sendFile(path.join(frontendPath, 'index.html'));
});

// Ruta explícita para la vista de conductor (user.html)
app.get('/user', (req, res) => {
  res.sendFile(path.join(frontendPath, 'user.html'));
});

app.get('/user.html', (req, res) => {
  res.sendFile(path.join(frontendPath, 'user.html'));
});

// Ruta explícita para la vista móvil
app.get('/mobile', (req, res) => {
  res.sendFile(path.join(frontendPath, 'mobile.html'));
});

app.get('/mobile.html', (req, res) => {
  res.sendFile(path.join(frontendPath, 'mobile.html'));
});

// Ruta explícita para el dashboard de administración
app.get('/admin', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ==========================================
// RUTA DIRECTA DE DESCARGA APK
// ==========================================
app.get('/api/download/apk', (req, res) => {
  const apkPath = path.join(__dirname, 'downloads', 'ZonasAzules.apk');
  res.download(apkPath, 'ZonasAzules.apk', (err) => {
    if (err) {
      console.error('Error al descargar el archivo APK:', err);
      if (!res.headersSent) {
        res.status(404).json({ error: 'El archivo ZonasAzules.apk no se encuentra disponible.' });
      }
    }
  });
});

// ==========================================
// 1. RUTA: AUTENTICACIÓN / LOGIN
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
  }

  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.password_hash, r.name AS role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = result.rows[0];

    if (user.password_hash !== password) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    return res.json({
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Error en autenticación:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ==========================================
// 2. RUTAS: EVENTOS DE VISIÓN-AI
// ==========================================
app.post('/api/ai/event', async (req, res) => {
  const { zone_name, spot_number, license_plate, action } = req.body;

  if (!zone_name || !spot_number || !action) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios en el evento IA.' });
  }

  const cleanPlate = license_plate ? license_plate.toUpperCase().trim() : null;

  try {
    const zoneRes = await db.query('SELECT id FROM zones WHERE name = $1', [zone_name]);
    if (zoneRes.rows.length === 0) {
      return res.status(404).json({ error: 'Zona no encontrada.' });
    }
    const zoneId = zoneRes.rows[0].id;

    const spotRes = await db.query(
      'SELECT id FROM spots WHERE zone_id = $1 AND spot_number = $2',
      [zoneId, spot_number]
    );

    if (spotRes.rows.length === 0) {
      return res.status(404).json({ error: 'Celda no encontrada.' });
    }
    const spotId = spotRes.rows[0].id;

    const newStatus = action === 'OCCUPY' ? 'occupied' : 'available';
    const plateToSave = action === 'OCCUPY' ? cleanPlate : null;

    await db.query(
      `UPDATE spots 
       SET status = $1, current_plate = $2, updated_at = NOW() 
       WHERE id = $3`,
      [newStatus, plateToSave, spotId]
    );

    await db.query(
      `INSERT INTO occupancy_history (spot_id, action, license_plate) 
       VALUES ($1, $2, $3)`,
      [spotId, action, cleanPlate]
    );

    return res.json({
      message: `Evento ${action} guardado en BD exitosamente.`,
      spot_number,
      status: newStatus,
      license_plate: cleanPlate
    });

  } catch (err) {
    console.error('Error procesando evento IA:', err);
    return res.status(500).json({ error: 'Error interno en el servidor.' });
  }
});

// ==========================================
// 3. RUTA: CONSULTAR COBRO POR PLACA
// ==========================================
app.get('/api/driver/check-fee/:plate', async (req, res) => {
  const cleanPlate = req.params.plate.toUpperCase().trim();

  try {
    const spotRes = await db.query(
      `SELECT s.id AS spot_id, s.spot_number, z.name AS zone_name, z.base_rate, s.updated_at
       FROM spots s
       JOIN zones z ON s.zone_id = z.id
       WHERE UPPER(s.current_plate) = $1 AND s.status = 'occupied'`,
      [cleanPlate]
    );

    if (spotRes.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró ningún vehículo activo estacionado con esa placa.' });
    }

    const activeSpot = spotRes.rows[0];

    const startTime = new Date(activeSpot.updated_at);
    const currentTime = new Date();
    const diffInMilliseconds = currentTime - startTime;
    const diffInMinutes = Math.max(1, Math.ceil(diffInMilliseconds / (1000 * 60)));
    
    const hoursToCharge = Math.max(1, Math.ceil(diffInMinutes / 60));
    const baseRate = parseFloat(activeSpot.base_rate) || 3900;
    const totalAmount = hoursToCharge * baseRate;

    return res.json({
      spot_id: activeSpot.spot_id,
      spot_number: activeSpot.spot_number,
      zone_name: activeSpot.zone_name,
      parked_at: startTime,
      minutes_elapsed: diffInMinutes,
      amount_to_pay: totalAmount,
      currency: 'COP'
    });

  } catch (err) {
    console.error('Error al consultar cobro por placa:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ==========================================
// 4. RUTA: CONSULTAR COBRO POR CÓDIGO QR / MÓVIL
// ==========================================
app.get('/api/mobile/spot-status', async (req, res) => {
  const { zone_id, spot_number } = req.query;

  if (!zone_id || !spot_number) {
    return res.status(400).json({ error: 'Se requieren los parámetros zone_id y spot_number.' });
  }

  try {
    const result = await db.query(
      `SELECT s.id AS spot_id, s.spot_number, s.status, s.current_plate, s.updated_at, z.name AS zone_name, z.base_rate 
       FROM spots s
       JOIN zones z ON s.zone_id = z.id
       WHERE s.zone_id = $1 AND s.spot_number = $2`,
      [zone_id, spot_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Celda o zona no encontrada.' });
    }

    const spot = result.rows[0];

    let feeDetails = null;
    if (spot.status === 'occupied' && spot.current_plate) {
      const startTime = new Date(spot.updated_at);
      const currentTime = new Date();
      const diffInMinutes = Math.max(1, Math.ceil((currentTime - startTime) / (1000 * 60)));
      const hoursToCharge = Math.max(1, Math.ceil(diffInMinutes / 60));
      const baseRate = parseFloat(spot.base_rate) || 3900;

      feeDetails = {
        parked_at: startTime,
        minutes_elapsed: diffInMinutes,
        amount_to_pay: hoursToCharge * baseRate,
        currency: 'COP'
      };
    }

    return res.json({
      spot: {
        id: spot.spot_id,
        number: spot.spot_number,
        status: spot.status,
        current_plate: spot.current_plate,
        zone_name: spot.zone_name
      },
      fee: feeDetails
    });

  } catch (err) {
    console.error('Error en API móvil spot-status:', err);
    return res.status(500).json({ error: 'Error interno en el servidor.' });
  }
});

// ==========================================
// 5. RUTA: PROCESAR PAGO Y LIBERAR CELDA
// ==========================================
app.post('/api/driver/pay', async (req, res) => {
  const { spot_id, license_plate, amount, payment_method } = req.body;

  if (!spot_id || !license_plate) {
    return res.status(400).json({ 
      error: 'Faltan datos obligatorios para procesar el pago (spot_id o license_plate vacíos).' 
    });
  }

  const cleanPlate = license_plate.toUpperCase().trim();
  const parsedAmount = parseFloat(amount) || 3900;
  const parsedSpotId = isNaN(spot_id) ? spot_id : parseInt(spot_id, 10);

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const paymentRes = await client.query(
      `INSERT INTO payments (spot_id, license_plate, amount, payment_method, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       RETURNING id, created_at`,
      [parsedSpotId, cleanPlate, parsedAmount, payment_method || 'PSE']
    );

    const paymentId = paymentRes.rows[0].id;
    const paymentDate = paymentRes.rows[0].created_at;

    await client.query(
      `UPDATE spots 
       SET status = 'available', current_plate = NULL, updated_at = NOW() 
       WHERE id = $1`,
      [parsedSpotId]
    );

    await client.query(
      `INSERT INTO occupancy_history (spot_id, action, license_plate) 
       VALUES ($1, 'VACATE', $2)`,
      [parsedSpotId, cleanPlate]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      payment_id: paymentId,
      license_plate: cleanPlate,
      amount: parsedAmount,
      date: paymentDate,
      message: '¡Pago procesado con éxito y celda liberada correctamente!'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error procesando el pago en BD:', err);
    return res.status(500).json({ 
      error: 'Error interno al procesar el pago en el servidor.',
      details: err.message 
    });
  } finally {
    client.release();
  }
});

// ==========================================
// 6. RUTA: REGISTRAR FACTURA ELECTRÓNICA (DIAN) Y RECIBO
// ==========================================
app.post('/api/driver/invoice', async (req, res) => {
  const { payment_id, name, document, email } = req.body;

  const clientName = name || 'Consumidor Final';
  const clientDocument = document || '222222222222';
  const clientEmail = email || 'consumidorfinal@dian.gov.co';

  if (!payment_id) {
    return res.status(400).json({ error: 'El ID del pago (payment_id) es obligatorio para facturar.' });
  }

  try {
    const payRes = await db.query('SELECT * FROM payments WHERE id = $1', [payment_id]);
    
    let paymentAmount = 3900;
    let paymentPlate = 'N/A';

    if (payRes.rows.length > 0) {
      paymentAmount = payRes.rows[0].amount;
      paymentPlate = payRes.rows[0].license_plate;
    }

    const invoiceNumber = `FE-ZA-${Date.now().toString().slice(-6)}`;
    const cufe = crypto
      .createHash('sha256')
      .update(`${invoiceNumber}-${paymentAmount}-${clientDocument}`)
      .digest('hex');

    console.log(`[FACTURA DIAN] Generando Factura ${invoiceNumber} para ${clientName} (${clientDocument}) - Email: ${clientEmail}`);

    return res.json({
      success: true,
      invoice: {
        invoice_number: invoiceNumber,
        cufe: cufe,
        customer_name: clientName,
        customer_document: clientDocument,
        customer_email: clientEmail,
        amount: paymentAmount,
        license_plate: paymentPlate,
        issue_date: new Date()
      },
      message: `Factura electrónica ${invoiceNumber} emitida exitosamente y enviada a ${clientEmail}`
    });

  } catch (err) {
    console.error('❌ Error emitiendo factura electrónica:', err);
    return res.status(500).json({ error: 'Error interno al generar la factura electrónica.' });
  }
});

// ==========================================
// 7. RUTAS: CONSULTAS DE ZONAS Y CELDAS
// ==========================================
app.get('/api/zones', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT z.*, COUNT(s.id) AS total_spots 
      FROM zones z 
      LEFT JOIN spots s ON z.id = s.zone_id 
      GROUP BY z.id 
      ORDER BY z.id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/zones/:id/spots', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM spots WHERE zone_id = $1 ORDER BY spot_number ASC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/spots', async (req, res) => {
  const { zone_id, spot_number } = req.body;
  if (!zone_id || !spot_number) {
    return res.status(400).json({ error: 'zone_id y spot_number son obligatorios.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO spots (zone_id, spot_number, status) 
       VALUES ($1, $2, 'available') 
       RETURNING *`,
      [zone_id, spot_number]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al agregar nueva celda:', err);
    res.status(500).json({ error: 'Error al agregar la celda.' });
  }
});

// ==========================================
// 8. RUTA: MÉTRICAS DEL DASHBOARD (ADMIN)
// ==========================================
app.get('/api/admin/metrics', async (req, res) => {
  try {
    const totalSpotsRes = await db.query('SELECT COUNT(*) FROM spots');
    const occupiedSpotsRes = await db.query("SELECT COUNT(*) FROM spots WHERE status = 'occupied'");
    
    const revenueRes = await db.query(`
      SELECT 
        COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE), 0) AS day_revenue,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS month_revenue,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)), 0) AS year_revenue
      FROM payments
    `);

    const total = parseInt(totalSpotsRes.rows[0].count, 10) || 1;
    const occupied = parseInt(occupiedSpotsRes.rows[0].count, 10) || 0;
    const rate = ((occupied / total) * 100).toFixed(1);

    const revenue = revenueRes.rows[0];

    res.json({
      revenue: { 
        day: parseFloat(revenue.day_revenue), 
        month: parseFloat(revenue.month_revenue), 
        year: parseFloat(revenue.year_revenue) 
      },
      occupancy: { rate, occupied, total }
    });
  } catch (err) {
    console.error('Error obteniendo métricas:', err);
    res.status(500).json({ error: err.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});