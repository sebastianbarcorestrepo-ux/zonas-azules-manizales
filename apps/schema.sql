-- 1. Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO roles (name) VALUES ('admin'), ('operator'), ('driver') 
ON CONFLICT (name) DO NOTHING;

-- 2. Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT REFERENCES roles(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de zonas
CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    base_rate NUMERIC(10, 2) DEFAULT 3900.00,
    total_spots INT DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO zones (id, name, base_rate, total_spots) 
VALUES 
    (1, 'Zona Coliseo 1 - Cra 24', 3900.00, 10),
    (2, 'Zona Coliseo 2 - Cra 24', 3900.00, 10)
ON CONFLICT (id) DO NOTHING;

-- 4. Tabla de celdas (spots)
CREATE TABLE IF NOT EXISTS spots (
    id SERIAL PRIMARY KEY,
    zone_id INT REFERENCES zones(id) ON DELETE CASCADE,
    spot_number INT NOT NULL,
    status VARCHAR(20) DEFAULT 'available',
    current_plate VARCHAR(20),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_zone_spot UNIQUE (zone_id, spot_number)
);

-- Inicializar celdas (10 celdas para cada zona)
DO $$
BEGIN
    FOR z IN 1..2 LOOP
        FOR s IN 1..10 LOOP
            INSERT INTO spots (zone_id, spot_number, status)
            VALUES (z, s, 'available')
            ON CONFLICT (zone_id, spot_number) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 5. Tabla de historial de eventos (Visión por Computador)
CREATE TABLE IF NOT EXISTS occupancy_history (
    id SERIAL PRIMARY KEY,
    spot_id INT REFERENCES spots(id),
    action VARCHAR(20) NOT NULL,
    license_plate VARCHAR(20),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabla de transacciones
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    spot_id INT REFERENCES spots(id),
    license_plate VARCHAR(20) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabla de facturas electrónicas
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    transaction_id INT REFERENCES transactions(id),
    customer_name VARCHAR(150),
    customer_document VARCHAR(50),
    customer_email VARCHAR(100),
    dian_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);