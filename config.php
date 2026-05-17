<?php
// Configurazione del progetto — NON committare questo file con dati reali

// Chiavi API Spoonacular — la seconda viene usata automaticamente se la prima raggiunge il limite
define('SPOONACULAR_API_KEY',   'aef0e85a8e854cfca43025b1b8efd918');
define('SPOONACULAR_API_KEY_2', 'c46644dc333e412eb40addc5d867a8ed');

// Configurazione database MariaDB
define('DB_HOST', 'localhost');
define('DB_NAME', 'smart_pantry');
define('DB_USER', 'root');
define('DB_PASS', '');

// Configurazione sessione
define('SESSION_NAME', 'smart_pantry_session');

// URL base API OpenFoodFacts
define('OPENFOODFACTS_URL', 'https://world.openfoodfacts.org/api/v0/product/');

// URL base API Spoonacular
define('SPOONACULAR_URL', 'https://api.spoonacular.com');

// Giorni di preavviso scadenza (prodotti che scadono entro X giorni mostrano avviso)
define('EXPIRY_WARNING_DAYS', 7);
