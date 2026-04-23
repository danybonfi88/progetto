// IMPORTO LE LIBRERIE
/* express */
const express = require('express');
/* bcrypt: utile ad hashare le psw prima di salvarle */
const bcrypt = require('bcrypt');
/* jsonwebtoken: utile per creazione e verifica dei jwt*/
const jwt = require('jsonwebtoken');
/* db: importa il file db.js, salvato in un'altra cartella del progetto*/
const db = require('../config/db');
/* router: creo il Router specifico di questa rotta, su cui registro gli endpoint specifici*/
const router = express.Router();
/* importo dotenv, utile per leggere file .env */
const dotenv = require('dotenv');
/* leggo il file.env e carico le variabili nell'oggetto process.env */
dotenv.config();


// POST /api/auth/register
router.post('/register', async (req, res) => {
    // estraggo il body della req
    const { nome, email, password } = req.body;

    // verifico il body, se manca qualcosa -> 400
    if (!nome || !email || !password) {
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }


    try {
        // il metodo .query sostituisce tutto il procedimento php della connessione tramite oggetto (compreso prepare, binding...)
        /* .query restituisce un array di due elementi [righe, metadata] -> con la scrittura [rows], 
        prendo solo il primo elemento, ovvero le righe della tabella temporanea generata dalla query */
        // seleziono quindi l'id utente, associato all'email inserita
        const [rows] = await db.query(
        'SELECT id FROM utenti WHERE email = ?', [email]
        );
        // se la query resitutisce > 0 righe, vi è gia un utente registrato con quella mail
        if (rows.length > 0) {
            return res.status(409).json({ error: 'Email già registrata' });
        }

        // la password mandata nel body viene cryptata salvata come hash (10 è il costo dell'algoritmo, cioè quante volte viene 
        // eseguito internamente. Più è alto, più è sicuro ma più è lento. 10 è il valore standard, un buon compromesso.)
        const hash = await bcrypt.hash(password, 10);

        // a questo punto, controllato che l'utente non esista, inseriamo i suoi dati nel database, e restituisco code e messaggio di successo
        // !ATTENZIONE!: l'utente non ha fatto il login, si è solo registrato, il login sarà eseguito poi
        await db.query(
        'INSERT INTO utenti (nome, email, password_hash) VALUES (?, ?, ?)',
        [nome, email, hash]
        );
        res.status(201).json({ message: 'Registrazione avvenuta con successo' });
    
    // Se qualcosa va storto in qualsiasi punto del try — connessione al DB persa, query fallita, qualsiasi cosa — l'errore viene catturato qui
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    // estraggo il body della req (il nome non serve)
    const { email, password } = req.body;

    // verifico il body, se manca qualcosa -> 400
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password obbligatorie' });
    }

    try {
      // prendo il primo elemento della query, tramite [rows], estraendo tutti i dati dell'utente con la email inserita
      const [rows] = await db.query(
        'SELECT * FROM utenti WHERE email = ?', [email]
      );
      // se l'array è vuoto, restituisco 401, in quanto non esiste un utente con quella email
      if (rows.length === 0) {
        // perchè ritorno solo 'Credenziali non valide'?? -> MAI indicare quale dei due parametri è sbagliato, altrimenti un attaccante sa se ha indicasto correttamente uno dei due
        return res.status(401).json({ error: 'Credenziali non valide' });
      }

      // salvo i dati utenti estratti dalla query in un oggetto 
      const utente = rows[0];

      // confronto la password inserita dall'utente, con quella estratta dal database -> il valoreè TRUE se sono uguali, FALSE invece
      /* non utilizzo un confronto tradizionale (password === utente.password_hash) perchè la password del database è cryptata: il metodo comapre della libreria bcryp sa come confrontare */
      const match = await bcrypt.compare(password, utente.password_hash);
      // se è false (le passowrd non matchano), restituisco 401
      if (!match) {
        // perchè ritorno solo 'Credenziali non valide'?? -> MAI indicare quale dei due parametri è sbagliato, altrimenti un attaccante sa se ha indicasto correttamente uno dei due
        return res.status(401).json({ error: 'Credenziali non valide' });
      }

      // creo il token jwt (il mnetodo sign():
      /*1. prende il payload { id: 1, email: '...', nome: '...' }
        2. aggiunge { exp: <timestamp scadenza> }
        3. codifica header e payload in Base64
        4. calcola la firma: HMAC-SHA256(header + '.' + payload, JWT_SECRET)
        5. restituisce: header.payload.firma */
      const token = jwt.sign(
        // inserendo nel payload solo i dati non sensibili (il payload non è cifrato!)
        { id: utente.id, email: utente.email, nome: utente.nome },
        // la firma invece è cifrata, calcolata tramite la SECRET, che prendo dalle variabili di ambiente (file .env -> oggetto process.env)
        process.env.JWT_SECRET,
        // scadenza: 7 giorni
        { expiresIn: '7d' }
      );

      // restituisco all'utente il token e il suo nome.
      /* il client salva il front end nel suo localStorage, e lo invia ad ogni req successiva nell'header Authorization: bearer <token> */
      res.json({ token, nome: utente.nome });
    
    // Se qualcosa va storto in qualsiasi punto del try l'errore viene catturato qui
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
});

// esporto il Router specifico di auth.js, rendendo questa rotta disponibile negli altri file
module.exports = router;