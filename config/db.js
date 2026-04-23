// IMPORTO LE LIBRERIE //
/* importo mysql2, utile per la connessione a MySQL */
const mysql = require('mysql2');
/* importo dotenv, utile per leggere file .env */
const dotenv = require('dotenv');
/* leggo il file.env e carico le variabili nell'oggetto process.env */
dotenv.config();


/* Un pool è sostanzialmente una scorta di connessioni già aperte che il server tiene pronte. Funziona così: */
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true, // se il pool (le connessioni) è pieno, aspetta invece di dare errore
  connectionLimit: 10, // stabilisce il massimo di connessioni contemporanee
});



/*
mysql2 di default usa le callback, il vecchio modo di gestire operazioni asincrone in Node:
Chiamando .promise() sul pool ottieni una versione che supporta async/await, molto più pulita:
Quindi module.exports = pool.promise() esporta direttamente la versione "moderna" del pool, così in tutti i file del progetto usi sempre async/await senza pensarci.
*/

// module è il "cancello" attraverso cui un file decide cosa vuole rendere disponibile agli altri
module.exports = pool.promise();