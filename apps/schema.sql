-- ================================================================
-- SISTEMA INTELIGENTE DE PARQUEO - ZONAS AZULES MANIZALES
-- Esquema Maestro Unificado de Base de Datos para PostgreSQL
-- ================================================================

-- 1. TABLA DE ROLES
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO roles (id, name) VALUES 
    (1, 'admin'), 
    (2, 'operator'), 
    (3, 'driver') 
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 2. TABLA DE USUARIOS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT REFERENCES roles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE ZONAS
CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    address VARCHAR(200),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    base_rate NUMERIC(10, 2) DEFAULT 3900.00,
    total_spots INT DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE zones ADD COLUMN IF NOT EXISTS address VARCHAR(200);
ALTER TABLE zones ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE zones ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE zones ADD COLUMN IF NOT EXISTS base_rate NUMERIC(10, 2) DEFAULT 3900.00;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS total_spots INT DEFAULT 10;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

INSERT INTO zones (id, name, address, latitude, longitude, base_rate, total_spots, is_active) 
VALUES 
    (1, 'Zona Coliseo 1 - Cra 24', 'Carrera 24 entre Calles 63 y 64', 5.06010000, -75.49850000, 3900.00, 10, TRUE),
    (2, 'Zona Coliseo 2 - Cra 24', 'Carrera 24 entre Calles 64 y 65', 5.06050000, -75.49880000, 3900.00, 10, TRUE),
    (3, 'Zona El Cable - Av Santander', 'Av. Santander con Calle 65', 5.05600000, -75.48600000, 3900.00, 10, TRUE),
    (4, 'Zona Milán - Cra 23', 'Carrera 23 Zona Rosa Milán', 5.04800000, -75.47600000, 3900.00, 10, TRUE),
    (5, 'Zona Centro - Cra 22', 'Carrera 22 entre Calles 20 y 24', 5.06800000, -75.51700000, 3900.00, 10, TRUE),
    (6, 'Zona Chipre - Mirador', 'Av. 12 de Octubre - Chipre', 5.07200000, -75.52500000, 3900.00, 10, TRUE)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    base_rate = EXCLUDED.base_rate,
    total_spots = EXCLUDED.total_spots,
    is_active = EXCLUDED.is_active;

SELECT setval(pg_get_serial_sequence('zones', 'id'), COALESCE(MAX(id), 1)) FROM zones;

-- 4. TABLA DE CELDAS (SPOTS)
CREATE TABLE IF NOT EXISTS spots (
    id SERIAL PRIMARY KEY,
    zone_id INT REFERENCES zones(id) ON DELETE CASCADE,
    spot_number INT NOT NULL,
    status VARCHAR(20) DEFAULT 'available',
    current_plate VARCHAR(20),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_zone_spot UNIQUE (zone_id, spot_number)
);

DO $$
DECLARE
    z RECORD;
    s INT;
BEGIN
    FOR z IN SELECT id FROM zones LOOP
        FOR s IN 1..10 LOOP
            INSERT INTO spots (zone_id, spot_number, status)
            VALUES (z.id, s, 'available')
            ON CONFLICT (zone_id, spot_number) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 5. TABLA DE HISTORIAL DE EVENTOS (Visión por Computador / IA)
CREATE TABLE IF NOT EXISTS occupancy_history (
    id SERIAL PRIMARY KEY,
    spot_id INT REFERENCES spots(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,
    license_plate VARCHAR(20),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA DE PAGOS Y TRANSACCIONES
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    spot_id INT REFERENCES spots(id) ON DELETE SET NULL,
    license_plate VARCHAR(20) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'PSE',
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLA DE FACTURAS ELECTRÓNICAS (DIAN / CUFE)
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    payment_id INT REFERENCES payments(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE,
    cufe VARCHAR(64),
    customer_name VARCHAR(150),
    customer_document VARCHAR(50),
    customer_email VARCHAR(100),
    amount NUMERIC(10, 2),
    dian_status VARCHAR(50) DEFAULT 'issued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_id INT REFERENCES payments(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cufe VARCHAR(64);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_document VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_email VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS dian_status VARCHAR(50) DEFAULT 'issued';

-- 8. USUARIOS SEMILLA (Contraseñas Hasheadas con Bcrypt)
INSERT INTO users (name, email, password_hash, role_id)
VALUES 
    ('Administrador General', 'admin@zonasazules.gov.co', '$2b$10$YNi4tIYwAGM3dJTAnHAiee01ZKlyh9sg1eTVXt6ssIGBtRj4QNwJS', 1),
    ('Conductor Prueba', 'conductor@correo.com', '$2b$10$b8nBIUbc/fHJvo9k3aXoteg12crj3WuWCL4h3RpxgXdWkvDEkkX/O', 3)
ON CONFLICT (email) DO UPDATE SET 
    name = EXCLUDED.name,
    password_hash = EXCLUDED.password_hash,
    role_id = EXCLUDED.role_id;