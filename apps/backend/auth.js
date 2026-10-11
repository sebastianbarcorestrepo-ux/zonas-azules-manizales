const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_zonas_azules';

// ==========================================
// 1. REGISTRO DE USUARIOS
// ==========================================
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    // Verificar si el correo ya existe
    const userExist = await db.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado.' });
    }

    // Obtener role_id correspondiente (driver por defecto)
    const targetRoleName = role ? role.toLowerCase().trim() : 'driver';
    const roleRes = await db.query('SELECT id FROM roles WHERE name = $1', [targetRoleName]);
    const roleId = roleRes.rows.length > 0 ? roleRes.rows[0].id : 3;

    // Hashear contraseña con bcrypt (10 rounds)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Guardar en la tabla users
    const newUser = await db.query(
      `INSERT INTO users (name, email, password_hash, role_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, email, role_id`,
      [name.trim(), cleanEmail, hashedPassword, roleId]
    );

    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: newUser.rows[0].id,
        name: newUser.rows[0].name,
        email: newUser.rows[0].email,
        role: targetRoleName
      }
    });

  } catch (err) {
    console.error('❌ Error en registro:', err);
    return res.status(500).json({ error: 'Error interno del servidor al registrar usuario.' });
  }
});

// ==========================================
// 2. INICIO DE SESIÓN (LOGIN CON BCRYPT + JWT)
// ==========================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.password_hash, r.name AS role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = $1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = result.rows[0];

    // Validación segura de contraseña con bcrypt
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Generar Token JWT con vigencia de 8 horas
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('❌ Error en login:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ==========================================
// 3. MIDDLEWARE PARA PROTEGER RUTAS PRIVADAS
// ==========================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Token de autorización requerido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
    req.user = decodedUser;
    next();
  });
}

module.exports = router;
module.exports.authenticateToken = authenticateToken;