-- ============================================================
-- Smart Pantry — Schema Database
-- Eseguire in MariaDB/phpMyAdmin prima di avviare l'app
-- ============================================================

CREATE DATABASE IF NOT EXISTS smart_pantry
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE smart_pantry;

-- ------------------------------------------------------------
-- Tabella utenti
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabella prodotti (catalogo globale, arricchito da OpenFoodFacts)
-- Un prodotto può essere condiviso tra più utenti nella dispensa
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    barcode             VARCHAR(50) UNIQUE,
    name                VARCHAR(255) NOT NULL,
    brand               VARCHAR(255),
    category            VARCHAR(100),
    image_url           TEXT,
    ingredients         TEXT,
    -- Valori nutrizionali per 100g
    calories_per_100g   DECIMAL(8,2),
    proteins_per_100g   DECIMAL(8,2),
    carbs_per_100g      DECIMAL(8,2),
    fats_per_100g       DECIMAL(8,2),
    fiber_per_100g      DECIMAL(8,2),
    salt_per_100g       DECIMAL(8,2),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_barcode (barcode)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabella dispensa utente
-- Ogni riga = un prodotto nella dispensa di un utente
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pantry_items (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT          NOT NULL,
    product_id    INT,                          -- NULL se prodotto inserito manualmente
    name          VARCHAR(255) NOT NULL,        -- nome del prodotto (duplicato per praticità)
    brand         VARCHAR(255),
    category      VARCHAR(50),                  -- latticini, verdura, carne, ecc.
    quantity      DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit          VARCHAR(20)  NOT NULL DEFAULT 'pz', -- pz, g, kg, ml, l, ecc.
    expiry_date   DATE,                         -- NULL se non applicabile
    location      VARCHAR(100),                 -- es: frigo, freezer, dispensa
    notes         TEXT,
    added_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_expiry (expiry_date)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabella ricette salvate dall'utente come preferite
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_recipes (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT          NOT NULL,
    spoonacular_id  INT          NOT NULL,      -- ID ricetta su Spoonacular
    recipe_name     VARCHAR(255) NOT NULL,
    image_url       TEXT,
    source_url      TEXT,
    ready_in_minutes INT,
    saved_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_recipe (user_id, spoonacular_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================================
-- MIGRAZIONE per database già creati (eseguire una sola volta):
-- ALTER TABLE pantry_items ADD COLUMN category VARCHAR(50) DEFAULT NULL AFTER brand;
-- ============================================================

-- ============================================================
-- Piano pasti (meal_plans)
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_plans (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    date        DATE NOT NULL,
    meal_type   ENUM('colazione','pranzo','cena') NOT NULL,
    title       VARCHAR(255) NOT NULL,
    notes       TEXT DEFAULT NULL,
    ingredients TEXT DEFAULT NULL,        -- JSON: ["pasta","pomodoro","basilico"]
    recipe_id   INT DEFAULT NULL,         -- ID Spoonacular (opzionale)
    recipe_name VARCHAR(255) DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, date)
) ENGINE=InnoDB;

-- ============================================================
-- Relazioni tra le tabelle:
--
-- users (1) ——< pantry_items (N) : un utente ha molti prodotti in dispensa
-- products (1) ——< pantry_items (N) : un prodotto del catalogo può essere
--                                     in più dispense (anche NULL se manuale)
-- users (1) ——< saved_recipes (N)  : un utente può salvare più ricette
-- ============================================================

-- ============================================================
-- Gruppi — consente a più utenti di condividere dispensa e piano pasti
-- ============================================================

CREATE TABLE IF NOT EXISTS user_groups (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    invite_code VARCHAR(10)  NOT NULL UNIQUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_invite_code (invite_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS group_members (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    group_id    INT NOT NULL,
    user_id     INT NOT NULL,
    role        ENUM('admin','member') NOT NULL DEFAULT 'member',
    joined_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(id)        ON DELETE CASCADE,
    UNIQUE KEY uq_group_member (group_id, user_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- Migrazione: aggiunge group_id alle tabelle esistenti (eseguire una sola volta)
ALTER TABLE pantry_items
    ADD COLUMN IF NOT EXISTS group_id INT DEFAULT NULL AFTER user_id,
    ADD INDEX  IF NOT EXISTS idx_pantry_group (group_id);

ALTER TABLE meal_plans
    ADD COLUMN IF NOT EXISTS group_id INT DEFAULT NULL AFTER user_id,
    ADD INDEX  IF NOT EXISTS idx_meals_group (group_id);
