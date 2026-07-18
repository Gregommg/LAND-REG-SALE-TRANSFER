-- =========================================================================
-- Land Registration, Sale & Transfer Management System
-- PostgreSQL Database Schema

-- =========================================================================

-- Drop existing objects (safe re-run during development)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS land_parcels CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS parcel_status CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;
DROP TYPE IF EXISTS transaction_status CASCADE;
DROP TYPE IF EXISTS payment_method_type CASCADE;

-- =========================================================================
-- ENUM TYPES
-- =========================================================================
-- 'citizen' is the single public-facing role: any verified citizen can
-- register, buy and sell land. 'admin'/'registrar'/'auditor' are internal
-- staff roles created by an administrator, never through public sign-up.
CREATE TYPE user_role AS ENUM ('admin', 'registrar', 'citizen', 'auditor');
CREATE TYPE parcel_status AS ENUM ('pending', 'registered', 'for_sale', 'under_transfer', 'transferred', 'disputed', 'rejected');
CREATE TYPE transaction_type AS ENUM ('sale', 'transfer');
CREATE TYPE transaction_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
-- A 'sale' must specify how payment is being handled; a 'transfer' (e.g. to
-- a relative, with no money involved) has no payment method at all.
CREATE TYPE payment_method_type AS ENUM ('bank_transfer', 'cash');

-- =========================================================================
-- USERS
-- =========================================================================
CREATE TABLE users (
    id                    SERIAL PRIMARY KEY,
    full_name             VARCHAR(120)  NOT NULL,
    email                 VARCHAR(150)  NOT NULL UNIQUE,
    password_hash         VARCHAR(255)  NOT NULL,
    national_id           VARCHAR(30)   UNIQUE,
    phone_number          VARCHAR(20)   NOT NULL UNIQUE,
    role                  user_role     NOT NULL DEFAULT 'citizen',
    profile_photo_path    VARCHAR(255),
    id_document_path      VARCHAR(255),
    verification_status   VARCHAR(20)   NOT NULL DEFAULT 'pending'
                           CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    verification_notes    TEXT,
    verified_by           INTEGER       REFERENCES users(id) ON DELETE SET NULL,
    verified_at           TIMESTAMPTZ,
    is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_verification_status ON users(verification_status);

-- =========================================================================
-- LAND PARCELS  (the central land record / cadastre entry)
-- =========================================================================
CREATE TABLE land_parcels (
    id                  SERIAL PRIMARY KEY,
    parcel_number       VARCHAR(50)   NOT NULL UNIQUE,
    title_deed_number   VARCHAR(50)   UNIQUE,
    county              VARCHAR(80)   NOT NULL,
    sub_county          VARCHAR(80),
    location            VARCHAR(150)  NOT NULL,
    size_acres          NUMERIC(10,2) NOT NULL CHECK (size_acres > 0),
    land_use            VARCHAR(60)   NOT NULL DEFAULT 'residential',
    latitude            NUMERIC(9,6),
    longitude           NUMERIC(9,6),
    asking_price        NUMERIC(14,2),
    title_deed_document_path VARCHAR(255),
    owner_id            INTEGER       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status              parcel_status NOT NULL DEFAULT 'pending',
    registered_by       INTEGER       REFERENCES users(id) ON DELETE SET NULL,
    registration_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_land_parcels_owner ON land_parcels(owner_id);
CREATE INDEX idx_land_parcels_status ON land_parcels(status);
CREATE INDEX idx_land_parcels_parcel_number ON land_parcels(parcel_number);

-- =========================================================================
-- TRANSACTIONS  (sale and transfer applications/workflow)
-- =========================================================================
CREATE TABLE transactions (
    id                  SERIAL PRIMARY KEY,
    parcel_id           INTEGER             NOT NULL REFERENCES land_parcels(id) ON DELETE CASCADE,
    seller_id           INTEGER             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    buyer_id            INTEGER             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    transaction_type    transaction_type    NOT NULL,
    amount              NUMERIC(14,2)       NOT NULL CHECK (amount >= 0),
    payment_method      payment_method_type,  -- required for 'sale', NULL for a no-money 'transfer'
    payment_confirmed_by_seller BOOLEAN      NOT NULL DEFAULT FALSE,
    payment_confirmed_at TIMESTAMPTZ,
    status              transaction_status  NOT NULL DEFAULT 'pending',
    notes               TEXT,
    approved_by         INTEGER             REFERENCES users(id) ON DELETE SET NULL,
    initiated_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    decided_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    CONSTRAINT chk_buyer_seller_diff CHECK (buyer_id <> seller_id),
    CONSTRAINT chk_sale_has_payment_method CHECK (transaction_type = 'transfer' OR payment_method IS NOT NULL)
);

CREATE INDEX idx_transactions_parcel ON transactions(parcel_id);
CREATE INDEX idx_transactions_status ON transactions(status);

-- =========================================================================
-- MESSAGES  (private one-to-one chat, encrypted at rest with AES-256-GCM)
-- =========================================================================
CREATE TABLE messages (
    id            SERIAL PRIMARY KEY,
    sender_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id  INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ciphertext    TEXT         NOT NULL, -- base64 AES-256-GCM ciphertext, never plaintext
    iv            VARCHAR(32)  NOT NULL, -- base64 initialization vector
    auth_tag      VARCHAR(32)  NOT NULL, -- base64 GCM authentication tag
    read_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_message_not_to_self CHECK (sender_id <> recipient_id)
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_conversation ON messages(sender_id, recipient_id, created_at);

-- =========================================================================
-- AUDIT LOGS  (traceability of sensitive actions across the system)
-- =========================================================================
CREATE TABLE audit_logs (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action       VARCHAR(100) NOT NULL,
    details      TEXT,
    ip_address   VARCHAR(45),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- =========================================================================
-- TRIGGER: keep updated_at current on users / land_parcels
-- =========================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_land_parcels_updated_at
    BEFORE UPDATE ON land_parcels
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- SEED DATA (demo accounts + sample records)
-- Default password for all seeded accounts is: Password123!
-- (hash generated with bcryptjs, 10 salt rounds)
-- =========================================================================
INSERT INTO users (full_name, email, password_hash, national_id, phone_number, role, verification_status, verified_at) VALUES
('System Administrator', 'admin@landregistry.go.ke', '$2a$10$EBLZ5Q6UDqWTiAYo1FVpcesx/H8vxO.GPm4Fi3vdyL7MZNt/26z1K', '10000001', '0700000001', 'admin', 'approved', NOW()),
('Jane Registrar', 'registrar@landregistry.go.ke', '$2a$10$EBLZ5Q6UDqWTiAYo1FVpcesx/H8vxO.GPm4Fi3vdyL7MZNt/26z1K', '10000002', '0700000002', 'registrar', 'approved', NOW()),
('Auditor General Office', 'auditor@landregistry.go.ke', '$2a$10$EBLZ5Q6UDqWTiAYo1FVpcesx/H8vxO.GPm4Fi3vdyL7MZNt/26z1K', '10000005', '0700000005', 'auditor', 'approved', NOW()),
('Peter Mwangi', 'peter.mwangi@example.com', '$2a$10$EBLZ5Q6UDqWTiAYo1FVpcesx/H8vxO.GPm4Fi3vdyL7MZNt/26z1K', '10000003', '0700000003', 'citizen', 'approved', NOW()),
('Susan Achieng', 'susan.achieng@example.com', '$2a$10$EBLZ5Q6UDqWTiAYo1FVpcesx/H8vxO.GPm4Fi3vdyL7MZNt/26z1K', '10000004', '0700000004', 'citizen', 'approved', NOW()),
('James Otieno', 'james.otieno@example.com', '$2a$10$EBLZ5Q6UDqWTiAYo1FVpcesx/H8vxO.GPm4Fi3vdyL7MZNt/26z1K', '10000006', '0700000006', 'citizen', 'pending', NULL);


INSERT INTO land_parcels (parcel_number, title_deed_number, county, sub_county, location, size_acres, land_use, latitude, longitude, asking_price, owner_id, status, registered_by) VALUES
('NRB/BLK1/001', 'TD-2024-001', 'Nairobi', 'Westlands', 'Westlands, Nairobi', 0.50, 'residential', -1.265700, 36.812100, NULL, 4, 'registered', 2),
('KJD/BLK2/014', 'TD-2024-014', 'Kiambu', 'Kiambu Town', 'Kiambu Town', 2.00, 'agricultural', -1.171400, 36.835600, 4500000.00, 4, 'for_sale', 2),
('MSA/BLK5/027', NULL, 'Mombasa', 'Nyali', 'Nyali, Mombasa', 0.35, 'residential', -4.019800, 39.708500, NULL, 5, 'pending', NULL);

INSERT INTO messages (sender_id, recipient_id, ciphertext, iv, auth_tag) VALUES
(5, 4, 'prRVMhjQvXs4YJQmnAk4KNKRsA5WDE1W9ftBQrY3Q/+EQXcZM5RyYboRee5NAfRr+DfhAIndj9O5JzaQVI1ruCuJi6+XazlJnIM=', 'RQX8ZCeQGkFDfkQ5', 'wUQ3GY/z9G9k9vmDdFI2Jg=='),
(4, 5, 'lF5DJRpnizA/NqsdMkcZoiKVj3JMkbiloWRVaWmHOiG8wfB/rLrTN162XViBoLqC4GaAR2YEEwgJoCDNqWeo7A==', 'fK3RMYu6vh40+ibd', 'ttO2MDx+vLuubtVcCgu59Q==');
