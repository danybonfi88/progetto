/* ============================================================
   routes/files.js
   Gestisce l'archiviazione, l'upload, l'apertura e la 
   rimozione dei file. Integra Multer per la gestione 
 la gestione fisica dei file su disco e MySQL per i metadati.
   ============================================================ */

// IMPORTO LE LIBRERIE
/* express */
const express = require('express');
/* multer: utile a gestire l'upload dei file */
const multer = require('multer');
/* path: modulo built-in di Node.js. Serve per lavorare con i percorsi dei file */
const path = require('path');
/* fs: modulo built-in di Node.js. Permette di interagire con i file su disco */
const fs = require('fs');
/* db: importa il file db.js per la connessione al database */
const db = require('../config/db');
/* auth: importa il middleware di autenticazione per proteggere le rotte */
const auth = require('../middleware/auth');
/* jsonwebtoken: utile per la verifica manuale dei token nei download */
const jwt = require('jsonwebtoken');
/* router: creo il Router specifico di questa rotta */
const router = express.Router();


// CONFIGURAZIONE MULTER
/* 
   Configuro Multer per decidere dove e come salvare i file fisicamente.
   Uso diskStorage per salvare i file in una cartella dedicata.
*/
const storage = multer.diskStorage({
    /* Definizione della cartella di destinazione: i file vanno in 'uploads/' */
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    /* 
       Generazione del nome file fisico: 
       Per evitare che due file con lo stesso nome si sovrascrivano, 
       generiamo un nome unico usando il timestamp attuale e un numero casuale.
    */
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});

/* Istanza di multer con limite di 10MB per file */
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
});

/* ----------------------------------------------------------------------------
   SISTEMA DI ACCESSO AI FILE (ANTEPRIMA E DOWNLOAD)
   Queste rotte sono posizionate PRIMA di router.use(auth) perché l'apertura 
   e il download tramite link (window.open) non possono inviare Header Authorization.
   Pertanto, verifichiamo il token manualmente tramite la Query String (?token=...).
   ---------------------------------------------------------------------------- */

/* 
   SOTTO-FUNZIONE DI SUPPORTO: verificaToken
   Questa funzione interna serve a evitare di ripetere la stessa logica di 
   estrazione e verifica del token in ogni rotta di download/view.
   Ritorna l'ID dell'utente se il token è valido, altrimenti lancia un errore.
*/
async function verificaToken(req) {
    const token = req.query.token;
    if (!token) throw new Error('TOKEN_MANCANTE');
    /* Decodifichiamo il token usando la chiave segreta definita nel file .env */
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
}

/* 
   ROTTA 1: APERTURA IN ANTEPRIMA (/:id/view)
   Questa rotta serve per aprire il file in una nuova scheda del browser.
*/
router.get('/:id/view', async (req, res) => {
    try {
        /* Utilizziamo la funzione di supporto per recuperare l'ID utente dal token */
        const userId = await verificaToken(req);
        const fileId = req.params.id;

        /* 
           RECUPERO DATI: 
           Estraiamo il percorso fisico, il tipo MIME (per sapere se è un PDF, immagine, ecc.) 
           e il nome originale (per l'header del browser).
        */
        const [rows] = await db.query(
            `SELECT path_server, tipo_mime, nome_originale FROM files 
             WHERE id = ? AND (utente_id = ? OR gruppo_id IN (SELECT gruppo_id FROM utenti_gruppi WHERE utente_id = ?))`,
            [fileId, userId, userId]
        );

        if (rows.length === 0) return res.status(404).json({ error: 'File non trovato o accesso negato' });

        const file = rows[0];
        
        /* 
           CONFIGURAZIONE HEADER PER L'ANTEPRIMA (INLINE):
           1. Content-Type: Fondamentale affinché il browser sappia come renderizzare il file.
           2. Content-Disposition: Impostato a 'inline'. Questo suggerisce al browser 
              di mostrare il file invece di scaricarlo. Il parametro 'filename' 
              serve a dare un nome al file qualora l'utente decida di salvarlo manualmente.
        */
        res.setHeader('Content-Type', file.tipo_mime);
        res.setHeader('Content-Disposition', `inline; filename="${file.nome_originale}"`);
        
        /* Inviamo il file fisico trasformando il percorso relativo in assoluto */
        res.sendFile(path.resolve(file.path_server));

    } catch (err) {
        /* Gestione specifica per l'errore lanciato da verificaToken */
        if (err.message === 'TOKEN_MANCANTE') return res.status(401).json({ error: 'Token mancante' });
        res.status(403).json({ error: 'Token non valido o sessione scaduta' });
    }
});

/* 
   ROTTA 2: DOWNLOAD FORZATO (/:id/download)
   Questa rotta obbliga il browser a scaricare il file direttamente sul disco.
*/
router.get('/:id/download', async (req, res) => {
    try {
        const userId = await verificaToken(req);
        const fileId = req.params.id;

        /* Recuperiamo solo i dati necessari per il download fisico */
        const [rows] = await db.query(
            `SELECT path_server, nome_originale FROM files 
             WHERE id = ? AND (utente_id = ? OR gruppo_id IN (SELECT gruppo_id FROM utenti_gruppi WHERE utente_id = ?))`,
            [fileId, userId, userId]
        );

        if (rows.length === 0) return res.status(404).json({ error: 'File non trovato o accesso negato' });

        const file = rows[0];
        
        /* 
           SISTEMA DI DOWNLOAD (ATTACHMENT):
           res.download è una funzione di Express che automatizza l'impostazione dell'header 
           'Content-Disposition: attachment'. Questo forza l'apertura della finestra 
           "Salva con nome" del browser.
           Il secondo parametro definisce il nome che il file avrà una volta scaricato.
        */
        res.download(path.resolve(file.path_server), file.nome_originale);

    } catch (err) {
        if (err.message === 'TOKEN_MANCANTE') return res.status(401).json({ error: 'Token mancante' });
        res.status(403).json({ error: 'Token non valido o sessione scaduta' });
    }
});


// Tutte le route qui sotto richiedono il login (Middleware Auth)
router.use(auth);


// GET /api/files
router.get('/', async (req, res) => {
    try {
        /* 
           SISTEMAZIONE QUERY:
           Aggiungiamo un secondo LEFT JOIN per collegare la tabella 'files' alla tabella 'gruppi'.
           In questo modo l'API restituirà non solo l'id del gruppo, 
           ma anche il suo nome (estratto come 'gruppo_nome').
        */
        const [rows] = await db.query(`
        SELECT f.*,
                m.nome AS materia_nome,
                m.colore AS materia_colore,
                g.nome AS gruppo_nome
        FROM files f
        LEFT JOIN materie m ON f.materia_id = m.id
        LEFT JOIN gruppi g ON f.gruppo_id = g.id
        WHERE f.utente_id = ?
            OR f.gruppo_id IN (
                SELECT gruppo_id
                FROM utenti_gruppi
                WHERE utente_id = ?
            )
        ORDER BY f.data_upload DESC
        `, [req.user.id, req.user.id]); 
        
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


/* POST /api/files — Gestisce l'upload di un nuovo file tramite Multer */
router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nessun file caricato correttamente' });
    }

    const { materia_id, gruppo_id } = req.body;

    try {
        /* Inserimento dei metadati del file nel DB. 
           Sia il nome originale che il percorso fisico generato da Multer vengono salvati. */
        const [result] = await db.query(
        `INSERT INTO files
            (utente_id, materia_id, gruppo_id, nome_originale, path_server, tipo_mime, dimensione_bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            req.user.id,
            materia_id || null,
            gruppo_id  || null,
            req.file.originalname,
            req.file.path,
            req.file.mimetype,
            req.file.size,
        ]
        );

        res.status(201).json({
            id:             result.insertId,
            nome_originale: req.file.originalname,
            tipo_mime:      req.file.mimetype,
            dimensione:     req.file.size,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno durante l\'upload' });
    }
});


/* DELETE /api/files/:id — Elimina il file dal disco e dal database */
router.delete('/:id', async (req, res) => {
    try {
        /* Recupero del percorso fisico per l'eliminazione dal disco */
        const [rows] = await db.query(
        'SELECT path_server FROM files WHERE id = ? AND utente_id = ?',
        [req.params.id, req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'File non trovato o non autorizzato' });
        }

        /* Eliminazione fisica del file tramite modulo 'fs' */
        fs.unlinkSync(rows[0].path_server);

        /* Eliminazione del record dal database */
        await db.query(
        'DELETE FROM files WHERE id = ? AND utente_id = ?',
        [req.params.id, req.user.id]
        );

        res.json({ message: 'File eliminato con successo' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore durante l\'eliminazione del file' });
    }
});

/* PUT /api/files/:id — Permette di cambiare il nome visualizzato e il gruppo di un file */
router.put('/:id', async (req, res) => {
    /* Estraiamo sia il nuovo nome che l'eventuale nuovo gruppo dal body */
    const { nome_file, gruppo_id } = req.body;

    /* Validazione: il nome è obbligatorio per evitare file senza titolo */
    if (!nome_file) {
        return res.status(400).json({ error: 'Il nuovo nome del file è obbligatorio' });
    }

    try {
        /* 
           AGGIORNAMENTO DATABASE:
           Aggiorniamo sia 'nome_originale' che 'gruppo_id'.
           Il gruppo_id può essere null (se l'utente decide di rendere il file privato).
        */
        const [result] = await db.query(
            'UPDATE files SET nome_originale = ?, gruppo_id = ? WHERE id = ? AND utente_id = ?',
            [nome_file, gruppo_id || null, req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'File non trovato o non autorizzato' });
        }

        res.json({ message: 'File aggiornato con successo' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno del server durante l\'aggiornamento' });
    }
});

module.exports = router;
