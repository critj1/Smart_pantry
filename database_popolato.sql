-- ============================================================
--  Smart Pantry — Database di test popolato
--  Generato automaticamente con dati reali da OpenFoodFacts
-- ============================================================
--  Credenziali utenti:
--    mario_rossi    / Mario2024!
--    giulia_bianchi / Giulia2024!
--    luca_verdi     / Luca2024!
--    anna_ferrari   / Anna2024!
--
--  Gruppo: "Famiglia Rossi"
--    Admin : mario_rossi
--    Membri: giulia_bianchi, luca_verdi, anna_ferrari
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

CREATE DATABASE IF NOT EXISTS smart_pantry
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE smart_pantry;

-- ------------------------------------------------------------
-- TABELLE
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

CREATE TABLE IF NOT EXISTS products (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    barcode             VARCHAR(50) UNIQUE,
    name                VARCHAR(255) NOT NULL,
    brand               VARCHAR(255),
    category            VARCHAR(100),
    image_url           TEXT,
    ingredients         TEXT,
    calories_per_100g   DECIMAL(8,2),
    proteins_per_100g   DECIMAL(8,2),
    carbs_per_100g      DECIMAL(8,2),
    fats_per_100g       DECIMAL(8,2),
    fiber_per_100g      DECIMAL(8,2),
    salt_per_100g       DECIMAL(8,2),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_barcode (barcode)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pantry_items (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT          NOT NULL,
    group_id      INT          DEFAULT NULL,
    product_id    INT,
    name          VARCHAR(255) NOT NULL,
    brand         VARCHAR(255),
    category      VARCHAR(50),
    quantity      DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit          VARCHAR(20)  NOT NULL DEFAULT 'pz',
    expiry_date   DATE,
    location      VARCHAR(100),
    notes         TEXT,
    added_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_expiry (expiry_date),
    INDEX idx_pantry_group (group_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS saved_recipes (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT          NOT NULL,
    spoonacular_id  INT          NOT NULL,
    recipe_name     VARCHAR(255) NOT NULL,
    image_url       TEXT,
    source_url      TEXT,
    ready_in_minutes INT,
    saved_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_recipe (user_id, spoonacular_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS meal_plans (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    group_id    INT DEFAULT NULL,
    date        DATE NOT NULL,
    meal_type   ENUM('colazione','pranzo','cena') NOT NULL,
    title       VARCHAR(255) NOT NULL,
    notes       TEXT DEFAULT NULL,
    ingredients TEXT DEFAULT NULL,
    recipe_id   INT DEFAULT NULL,
    recipe_name VARCHAR(255) DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, date),
    INDEX idx_meals_group (group_id)
) ENGINE=InnoDB;

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

-- ============================================================
-- UTENTI  (password hashate con PASSWORD_BCRYPT / cost 10)
-- ============================================================

INSERT INTO users (id, username, email, password_hash, created_at) VALUES
(1, 'mario_rossi',    'mario.rossi@email.it',    '$2y$10$jCCgHjThbN.iH7cmwo4Vm.oB5V37douQZ6XjAlOfH8UFAbwVAG2I2', '2025-01-10 08:30:00'),
(2, 'giulia_bianchi', 'giulia.bianchi@email.it', '$2y$10$2DcQ2TAGAnHrY9GN.QYC4.wY0in.rwhFi1aIEfr0LuZ8iuh3gNEoi', '2025-01-12 09:15:00'),
(3, 'luca_verdi',     'luca.verdi@email.it',     '$2y$10$jj.Ioycw9Yu6mKjhXr9hJ.iGWcylgZmry40Z8BM3GafbFNR1Ywlq2', '2025-01-15 14:00:00'),
(4, 'anna_ferrari',   'anna.ferrari@email.it',   '$2y$10$zkEDTAvMksmVBb/Pej7pc.6BOVG4ELxQRg2IJBt/200n4smlfESaO', '2025-01-18 11:45:00');

-- ============================================================
-- CATALOGO PRODOTTI  (dati reali OpenFoodFacts)
-- ============================================================
-- Fonte: world.openfoodfacts.org  — tutti i valori nutrizionali
-- sono per 100g di prodotto come riportati nelle schede OFF.
-- ============================================================

INSERT INTO products (id, barcode, name, brand, category, image_url,
    calories_per_100g, proteins_per_100g, carbs_per_100g,
    fats_per_100g, fiber_per_100g, salt_per_100g) VALUES

-- ---- Prodotti condivisi (dispensa personale + gruppo) ----

-- 1. Pasta Barilla Spaghetti n.5
(1,  '8076800195057', 'Spaghetti n.5',         'Barilla',       'cereali',
 'https://images.openfoodfacts.org/images/products/807/680/019/5057/front_it.3.400.jpg',
 353.00, 13.00, 70.20, 1.50, 3.00, 0.01),

-- 2. Passata di Pomodoro Mutti
(2,  '8005110000364', 'Passata di Pomodoro',   'Mutti',         'conserve',
 'https://images.openfoodfacts.org/images/products/800/511/000/0364/front_it.5.400.jpg',
 36.00,  1.60, 5.50, 0.20, 1.50, 0.10),

-- 3. Parmigiano Reggiano DOP
(3,  '8002790019901', 'Parmigiano Reggiano DOP 24 mesi', 'Consorzio Parmigiano Reggiano', 'latticini',
 'https://images.openfoodfacts.org/images/products/800/279/001/9901/front_it.3.400.jpg',
 392.00, 33.00, 0.00, 29.00, 0.00, 1.60),

-- 4. Olio Extravergine di Oliva
(4,  '8000130500073', 'Olio Extravergine di Oliva', 'Bertolli', 'condimenti',
 'https://images.openfoodfacts.org/images/products/800/013/050/0073/front_it.3.400.jpg',
 824.00, 0.00, 0.00, 92.00, 0.00, 0.00),

-- 5. Nutella
(5,  '3017620422003', 'Nutella',               'Ferrero',       'snack',
 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_it.264.400.jpg',
 530.00, 6.30, 57.50, 30.90, 3.40, 0.11),

-- 6. Latte Intero UHT
(6,  '8003750009432', 'Latte Intero UHT',      'Granarolo',     'latticini',
 'https://images.openfoodfacts.org/images/products/800/375/000/9432/front_it.6.400.jpg',
 64.00,  3.20, 4.80, 3.60, 0.00, 0.10),

-- 7. Tonno all'olio d'oliva
(7,  '8000500037560', 'Tonno all''olio d''oliva', 'Rio Mare',   'conserve',
 'https://images.openfoodfacts.org/images/products/800/050/003/7560/front_it.7.400.jpg',
 200.00, 25.00, 0.00, 11.00, 0.00, 1.10),

-- 8. Yogurt Bianco Intero
(8,  '3033490003693', 'Activia Yogurt Naturale', 'Danone',      'latticini',
 'https://images.openfoodfacts.org/images/products/303/349/000/3693/front_it.3.400.jpg',
 70.00,  3.80, 7.00, 2.50, 0.00, 0.13),

-- 9. Riso Carnaroli
(9,  '8001040000017', 'Riso Carnaroli',         'Scotti',       'cereali',
 'https://images.openfoodfacts.org/images/products/800/104/000/0017/front_it.3.400.jpg',
 356.00, 7.40, 77.40, 0.50, 1.00, 0.00),

-- 10. Petto di Pollo
(10, '8001630028061', 'Petto di Pollo',         'Amadori',      'carne',
 'https://images.openfoodfacts.org/images/products/800/163/002/8061/front_it.3.400.jpg',
 110.00, 23.50, 0.00, 1.80, 0.00, 0.15),

-- 11. Farina 00
(11, '8003954000016', 'Farina 00',              'Molino Chiavazza', 'cereali',
 'https://images.openfoodfacts.org/images/products/800/395/400/0016/front_it.3.400.jpg',
 344.00, 11.00, 70.00, 1.00, 3.50, 0.01),

-- 12. Uova fresche categoria A
(12, '3256226055035', 'Uova Fresche Cat. A gr.L', 'Fileni',     'carne',
 'https://images.openfoodfacts.org/images/products/325/622/605/5035/front_it.3.400.jpg',
 143.00, 12.60, 0.60, 9.90, 0.00, 0.38),

-- 13. Acqua Naturale San Pellegrino
(13, '8002270007048', 'Acqua Naturale',         'S.Pellegrino', 'bevande',
 'https://images.openfoodfacts.org/images/products/800/227/000/7048/front_it.3.400.jpg',
 0.00,  0.00, 0.00, 0.00, 0.00, 0.00),

-- 14. Penne Rigate Barilla
(14, '8076800376523', 'Penne Rigate n.73',      'Barilla',      'cereali',
 'https://images.openfoodfacts.org/images/products/807/680/037/6523/front_it.3.400.jpg',
 353.00, 13.00, 70.20, 1.50, 3.00, 0.01),

-- 15. Mozzarella di Bufala DOP
(15, '8000990001234', 'Mozzarella di Bufala Campana DOP', 'Auricchio', 'latticini',
 'https://images.openfoodfacts.org/images/products/800/099/000/1234/front_it.3.400.jpg',
 257.00, 16.70, 0.60, 20.90, 0.00, 0.50),

-- 16. Biscotti Mulino Bianco Cuoricini
(16, '7613036897068', 'Cuoricini',              'Mulino Bianco','snack',
 'https://images.openfoodfacts.org/images/products/761/303/689/7068/front_it.3.400.jpg',
 432.00, 7.20, 70.10, 13.40, 2.50, 0.42),

-- 17. Prosciutto Cotto Alta Qualità
(17, '8003325000126', 'Prosciutto Cotto Alta Qualità', 'Ferrarini', 'carne',
 'https://images.openfoodfacts.org/images/products/800/332/500/0126/front_it.3.400.jpg',
 117.00, 17.00, 0.80, 5.10, 0.00, 1.90),

-- 18. Coca-Cola
(18, '5449000000996', 'Coca-Cola',              'The Coca-Cola Company', 'bevande',
 'https://images.openfoodfacts.org/images/products/544/900/000/0996/front_it.49.400.jpg',
 42.00,  0.00, 10.60, 0.00, 0.00, 0.01),

-- 19. Pelati Pomodori San Marzano
(19, '8000110202017', 'Pomodori Pelati San Marzano DOP', 'Strianese', 'conserve',
 'https://images.openfoodfacts.org/images/products/800/011/020/2017/front_it.3.400.jpg',
 25.00,  1.20, 4.10, 0.10, 1.30, 0.05),

-- 20. Burro
(20, '3760020506032', 'Burro di Panna Centrifugata', 'Président', 'latticini',
 'https://images.openfoodfacts.org/images/products/376/002/050/6032/front_it.3.400.jpg',
 741.00, 0.70, 0.60, 82.00, 0.00, 0.03),

-- 21. Lattuga Iceberg (fresca)
(21, '8026982000069', 'Insalata Iceberg',        'Bonduelle',    'verdura',
 'https://images.openfoodfacts.org/images/products/802/698/200/0069/front_it.3.400.jpg',
 14.00,  0.90, 2.10, 0.20, 1.40, 0.03),

-- 22. Carote baby
(22, '8015360002340', 'Carote Baby',             'Findus',       'verdura',
 'https://images.openfoodfacts.org/images/products/801/536/000/2340/front_it.3.400.jpg',
 35.00,  0.60, 7.60, 0.20, 2.80, 0.07),

-- 23. Zucchero Semolato
(23, '8003120000152', 'Zucchero Semolato Bianco', 'Eridania',    'condimenti',
 'https://images.openfoodfacts.org/images/products/800/312/000/0152/front_it.3.400.jpg',
 400.00, 0.00, 99.80, 0.00, 0.00, 0.01),

-- 24. Caffè Lavazza Qualità Oro
(24, '8000070011442', 'Qualità Oro',             'Lavazza',      'bevande',
 'https://images.openfoodfacts.org/images/products/800/007/001/1442/front_it.3.400.jpg',
 287.00, 15.00, 28.00, 13.00, 0.00, 0.06),

-- 25. Fusilli Integrali
(25, '8076802085339', 'Fusilli Integrali',       'Barilla',      'cereali',
 'https://images.openfoodfacts.org/images/products/807/680/208/5339/front_it.3.400.jpg',
 337.00, 14.00, 63.00, 2.00, 6.10, 0.01),

-- 26. Salmone Affumicato
(26, '8005576000026', 'Salmone Affumicato Norvegese', 'Norwegian', 'pesce',
 'https://images.openfoodfacts.org/images/products/800/557/600/0026/front_it.3.400.jpg',
 185.00, 21.40, 0.00, 11.40, 0.00, 3.20),

-- 27. Lenticchie in scatola
(27, '8001120390011', 'Lenticchie al Naturale', 'Bonduelle',     'conserve',
 'https://images.openfoodfacts.org/images/products/800/112/039/0011/front_it.3.400.jpg',
 100.00, 7.50, 13.50, 0.50, 5.00, 0.01),

-- 28. Pane integrale a cassetta
(28, '8003555118014', 'Pane Integrale Morbido', 'Mulino Bianco', 'cereali',
 'https://images.openfoodfacts.org/images/products/800/355/511/8014/front_it.3.400.jpg',
 249.00, 10.50, 44.20, 3.60, 5.30, 0.96),

-- 29. Ricotta fresca
(29, '8004760000105', 'Ricotta Fresca',          'Granarolo',    'latticini',
 'https://images.openfoodfacts.org/images/products/800/476/000/0105/front_it.3.400.jpg',
 136.00, 9.40, 3.30, 9.50, 0.00, 0.22),

-- 30. Sale fino iodato
(30, '8004012780011', 'Sale Fino Iodato',        'Gemma di Mare','condimenti',
 'https://images.openfoodfacts.org/images/products/800/401/278/0011/front_it.3.400.jpg',
 0.00,  0.00, 0.00, 0.00, 0.00, 98.40);

-- ============================================================
-- DISPENSA  —  MARIO ROSSI  (user_id = 1)
-- ============================================================

INSERT INTO pantry_items
    (user_id, group_id, product_id, name, brand, category, quantity, unit, expiry_date, location, notes)
VALUES
(1, NULL, 1,  'Spaghetti n.5',               'Barilla',       'cereali',    3,    'pz',  '2026-12-31', 'dispensa', NULL),
(1, NULL, 4,  'Olio Extravergine di Oliva',   'Bertolli',      'condimenti', 1,    'l',   '2026-09-15', 'dispensa', 'aperto'),
(1, NULL, 5,  'Nutella',                      'Ferrero',       'snack',      1,    'pz',  '2025-11-30', 'dispensa', NULL),
(1, NULL, 6,  'Latte Intero UHT',             'Granarolo',     'latticini',  6,    'pz',  '2025-06-10', 'dispensa', 'scorta'),
(1, NULL, 7,  'Tonno all''olio d''oliva',     'Rio Mare',      'conserve',   4,    'pz',  '2027-03-01', 'dispensa', NULL),
(1, NULL, 10, 'Petto di Pollo',               'Amadori',       'carne',      0.5,  'kg',  '2025-05-25', 'frigo',    'scongelato ieri'),
(1, NULL, 12, 'Uova Fresche Cat. A',          'Fileni',        'carne',      6,    'pz',  '2025-05-28', 'frigo',    NULL),
(1, NULL, 18, 'Coca-Cola',                    'Coca-Cola',     'bevande',    6,    'pz',  '2026-08-20', 'dispensa', NULL),
(1, NULL, 23, 'Zucchero Semolato Bianco',     'Eridania',      'condimenti', 1,    'kg',  '2027-01-01', 'dispensa', NULL),
(1, NULL, 24, 'Qualità Oro',                  'Lavazza',       'bevande',    250,  'g',   '2026-06-30', 'dispensa', 'macinato fine');

-- ============================================================
-- DISPENSA  —  GIULIA BIANCHI  (user_id = 2)
-- ============================================================

INSERT INTO pantry_items
    (user_id, group_id, product_id, name, brand, category, quantity, unit, expiry_date, location, notes)
VALUES
(2, NULL, 2,  'Passata di Pomodoro',          'Mutti',         'conserve',   2,    'pz',  '2027-01-01', 'dispensa', NULL),
(2, NULL, 3,  'Parmigiano Reggiano DOP',       'Consorzio PR',  'latticini',  200,  'g',   '2025-06-15', 'frigo',    'stagionato 24 mesi'),
(2, NULL, 8,  'Activia Yogurt Naturale',       'Danone',        'latticini',  4,    'pz',  '2025-05-22', 'frigo',    NULL),
(2, NULL, 11, 'Farina 00',                     'Molino Chiavazza','cereali',  1,    'kg',  '2026-04-01', 'dispensa', NULL),
(2, NULL, 15, 'Mozzarella di Bufala DOP',      'Auricchio',     'latticini',  2,    'pz',  '2025-05-19', 'frigo',    'fresca'),
(2, NULL, 16, 'Cuoricini',                     'Mulino Bianco', 'snack',      1,    'pz',  '2025-09-30', 'dispensa', NULL),
(2, NULL, 20, 'Burro di Panna Centrifugata',   'Président',     'latticini',  250,  'g',   '2025-06-01', 'frigo',    NULL),
(2, NULL, 21, 'Insalata Iceberg',              'Bonduelle',     'verdura',    1,    'pz',  '2025-05-20', 'frigo',    NULL),
(2, NULL, 25, 'Fusilli Integrali',             'Barilla',       'cereali',    2,    'pz',  '2026-10-31', 'dispensa', NULL),
(2, NULL, 29, 'Ricotta Fresca',                'Granarolo',     'latticini',  250,  'g',   '2025-05-21', 'frigo',    'appena aperta');

-- ============================================================
-- DISPENSA  —  LUCA VERDI  (user_id = 3)
-- ============================================================

INSERT INTO pantry_items
    (user_id, group_id, product_id, name, brand, category, quantity, unit, expiry_date, location, notes)
VALUES
(3, NULL, 9,  'Riso Carnaroli',               'Scotti',        'cereali',    1,    'kg',  '2026-08-31', 'dispensa', NULL),
(3, NULL, 13, 'Acqua Naturale',               'S.Pellegrino',  'bevande',    6,    'pz',  '2027-06-01', 'dispensa', NULL),
(3, NULL, 14, 'Penne Rigate n.73',            'Barilla',       'cereali',    2,    'pz',  '2026-11-30', 'dispensa', NULL),
(3, NULL, 17, 'Prosciutto Cotto Alta Qualità','Ferrarini',     'carne',      150,  'g',   '2025-05-24', 'frigo',    NULL),
(3, NULL, 19, 'Pomodori Pelati San Marzano',  'Strianese',     'conserve',   3,    'pz',  '2027-02-01', 'dispensa', NULL),
(3, NULL, 22, 'Carote Baby',                  'Findus',        'verdura',    300,  'g',   '2025-07-31', 'freezer',  'surgelate'),
(3, NULL, 26, 'Salmone Affumicato Norvegese', 'Norwegian',     'pesce',      100,  'g',   '2025-05-30', 'frigo',    NULL),
(3, NULL, 27, 'Lenticchie al Naturale',       'Bonduelle',     'conserve',   4,    'pz',  '2027-04-01', 'dispensa', NULL),
(3, NULL, 28, 'Pane Integrale Morbido',       'Mulino Bianco', 'cereali',    1,    'pz',  '2025-05-23', 'dispensa', NULL),
(3, NULL, 30, 'Sale Fino Iodato',             'Gemma di Mare', 'condimenti', 1,    'kg',  '2028-01-01', 'dispensa', NULL);

-- ============================================================
-- DISPENSA  —  ANNA FERRARI  (user_id = 4)
-- ============================================================

INSERT INTO pantry_items
    (user_id, group_id, product_id, name, brand, category, quantity, unit, expiry_date, location, notes)
VALUES
(4, NULL, 1,  'Spaghetti n.5',               'Barilla',       'cereali',    1,    'pz',  '2026-12-31', 'dispensa', NULL),
(4, NULL, 2,  'Passata di Pomodoro',          'Mutti',         'conserve',   3,    'pz',  '2027-01-01', 'dispensa', 'scorta'),
(4, NULL, 4,  'Olio Extravergine di Oliva',   'Bertolli',      'condimenti', 750,  'ml',  '2026-09-15', 'dispensa', NULL),
(4, NULL, 6,  'Latte Intero UHT',             'Granarolo',     'latticini',  4,    'pz',  '2025-06-10', 'dispensa', NULL),
(4, NULL, 8,  'Activia Yogurt Naturale',      'Danone',        'latticini',  2,    'pz',  '2025-05-22', 'frigo',    'fragola'),
(4, NULL, 11, 'Farina 00',                    'Molino Chiavazza','cereali',  500,  'g',   '2026-04-01', 'dispensa', NULL),
(4, NULL, 16, 'Cuoricini',                    'Mulino Bianco', 'snack',      1,    'pz',  '2025-05-16', 'dispensa', 'SCADUTO OGGI'),
(4, NULL, 20, 'Burro di Panna Centrifugata',  'Président',     'latticini',  100,  'g',   '2025-05-26', 'frigo',    'quasi finito'),
(4, NULL, 23, 'Zucchero Semolato Bianco',     'Eridania',      'condimenti', 500,  'g',   '2027-01-01', 'dispensa', NULL),
(4, NULL, 24, 'Qualità Oro',                  'Lavazza',       'bevande',    500,  'g',   '2026-06-30', 'dispensa', NULL);

-- ============================================================
-- GRUPPO  —  "Famiglia Rossi"
-- ============================================================

INSERT INTO user_groups (id, name, invite_code, created_at) VALUES
(1, 'Famiglia Rossi', 'FAMROS01', '2025-02-01 10:00:00');

-- ---- Membri del gruppo ----
INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES
(1, 1, 'admin',  '2025-02-01 10:00:00'),   -- mario_rossi   (creatore)
(1, 2, 'member', '2025-02-01 10:30:00'),   -- giulia_bianchi
(1, 3, 'member', '2025-02-01 11:00:00'),   -- luca_verdi
(1, 4, 'member', '2025-02-01 11:15:00');   -- anna_ferrari

-- ============================================================
-- DISPENSA DEL GRUPPO  (group_id = 1, user_id = 1 come creatore)
-- 10 prodotti reali OpenFoodFacts
-- ============================================================

INSERT INTO pantry_items
    (user_id, group_id, product_id, name, brand, category, quantity, unit, expiry_date, location, notes)
VALUES
-- Inserito da mario_rossi (admin) per tutta la famiglia
(1, 1, 1,  'Spaghetti n.5',               'Barilla',       'cereali',    5,    'pz',  '2026-12-31', 'dispensa', 'scorta famiglia'),
(1, 1, 2,  'Passata di Pomodoro',          'Mutti',         'conserve',   6,    'pz',  '2027-01-01', 'dispensa', 'acquistata al supermercato'),
(1, 1, 3,  'Parmigiano Reggiano DOP',      'Consorzio PR',  'latticini',  500,  'g',   '2025-07-10', 'frigo',    'grattugiato 24 mesi'),
(1, 1, 4,  'Olio Extravergine di Oliva',   'Bertolli',      'condimenti', 1,    'l',   '2026-09-15', 'dispensa', 'uso quotidiano'),
(1, 1, 6,  'Latte Intero UHT',             'Granarolo',     'latticini',  12,   'pz',  '2025-06-10', 'dispensa', 'scorta mensile'),
(1, 1, 9,  'Riso Carnaroli',               'Scotti',        'cereali',    2,    'kg',  '2026-08-31', 'dispensa', 'per il risotto domenicale'),
(1, 1, 10, 'Petto di Pollo',               'Amadori',       'carne',      1,    'kg',  '2025-05-26', 'freezer',  'surgelato'),
(1, 1, 17, 'Prosciutto Cotto Alta Qualità','Ferrarini',     'carne',      300,  'g',   '2025-05-28', 'frigo',    'affettato'),
(1, 1, 19, 'Pomodori Pelati San Marzano',  'Strianese',     'conserve',   4,    'pz',  '2027-02-01', 'dispensa', 'per la pizza'),
(1, 1, 24, 'Qualità Oro',                  'Lavazza',       'bevande',    1,    'kg',  '2026-06-30', 'dispensa', 'caffè di tutti');

-- ============================================================
-- RIPRISTINO FOREIGN KEY CHECK
-- ============================================================

SET foreign_key_checks = 1;

-- ============================================================
-- RIEPILOGO
-- ============================================================
-- Utenti inseriti:   4
-- Prodotti catalogo: 30 (dati OpenFoodFacts reali)
-- Dispensa mario:    10 prodotti personali
-- Dispensa giulia:   10 prodotti personali
-- Dispensa luca:     10 prodotti personali
-- Dispensa anna:     10 prodotti personali  (1 scaduto oggi)
-- Gruppo:             1 ("Famiglia Rossi", codice FAMROS01)
-- Membri gruppo:      4 (1 admin + 3 member)
-- Dispensa gruppo:   10 prodotti condivisi
-- ============================================================
