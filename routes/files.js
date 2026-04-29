// IMPORTO LE LIBRERIE
/* express */
const express = require('express');
/* multer: utile a gestire l'upload dei file */
const multer = require('multer');
/* path: modulo built-in di Node.js (non va installato con npm). Serve per lavorare con i percorsi dei file in modo sicuro e compatibile tra sistemi operativi diversi. */
const path = require('path');
/* fs: modulo built-in di Node.js (non va installato con npm). Permette di interagire con i file su disco — leggerli, scriverli, eliminarli. */
const fs = require('fs');
/* db: importa il file db.js, salvato in un'altra cartella del progetto*/
const db = require('../config/db');
/* auth: importa il file auth.js, salvato in un'altra cartella del progetto*/
const auth = require('../middleware/auth');
/* router: creo il Router specifico di questa rotta, su cui registro gli endpoint specifici*/
const router = express.Router();


// CONFIGURAZIONE MULTER
/* Qui configuri dove e come multer salva i file. diskStorage significa che i file vengono salvati su disco — 
esiste anche memoryStorage che li tiene in RAM, ma per file grandi non è pratico. La configurazione ha due funzioni:*/
const storage = multer.diskStorage({
    // Dice a multer in quale cartella salvare i file. cb sta per callback — è il vecchio modo di gestire operazioni asincrone. 
    // Il primo argomento è l'errore (null = nessun errore), il secondo è il valore (la cartella in cui multer dovrà salvare) */
    destination: (req, file, cb) => {
        // cb() funziona come return (ritorna un valore), ma usato per contesti asincroni
        cb(null, 'uploads/');
    },
    /* Decide il nome con cui il file viene salvato su disco. Non puoi usare il nome originale del file perché:
    - due utenti potrebbero caricare un file con lo stesso nome e si sovrascriverebbero
    - nomi con spazi o caratteri speciali creano problemi */
    /* Genero quindi un nome unico: 
    Date.now() restituisce il timestamp attuale in millisecondi + Math.round(Math.random() * 1e9) genera un numero casuale tra 0 e 1 miliardo.*/
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        // path.extname(file.originalname): estrae l'estensione da un nome di file -> aggiungo al nome unico che ho appena creato, la sua estensione originale
        // Il primo argomento è l'errore (null = nessun errore), il secondo è il valore (il nome con cui multer dovrà salvare). */
        cb(null, unique + path.extname(file.originalname));
    }
});

// Crea l'istanza di multer con la configurazione appena definita. 
const upload = multer({
    // storage è la variabile con le configurazioni di multer creata qui sopr
    storage,
    // Il campo limits imposta un limite massimo alla dimensione del file.
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Tutte le route qui sotto richiedono il login
router.use(auth);


// GET /api/files
router.get('/', async (req, res) => {
    try {
        // come solito, uso il metodo query con la scrittura [rows], per estrarre solo le righe, senza metadata
        /* COSA ESTRAGGO: estraggo tutti gli attributi di files, nome e colore materia */
        /* DA DOVE ESTRAGGO: dalla tabella files, collegata alla tabella materie in base all'id materia.
        LEFT JOIN -> se le righe di files non hanno corrispondenza in materie, gli attributi di materie sono impostati a null*/
        /* CONDIZIONE: se vale una delle due condizioni 
        - f.utente_id = ? — il file è stato creato dall'utente loggato
        - f.gruppo_id IN (...) — il file appartiene a un gruppo di cui l'utente fa parte */
        /* ORDINE: ordino per data di upload dei file, crescente */
        const [rows] = await db.query(`
        SELECT f.*,
                m.nome AS materia_nome,
                m.colore AS materia_colore
        FROM files f
        LEFT JOIN materie m ON f.materia_id = m.id
        WHERE f.utente_id = ?
            OR f.gruppo_id IN (
                SELECT gruppo_id
                FROM utenti_gruppi
                WHERE utente_id = ?
            )
        ORDER BY f.data_upload DESC
        `, [req.user.id, req.user.id]); // req.user viene dal middleware di autenticazione!
        
        // restituisco il risulato della query (res.json() usa 200 di default)
        res.json(rows);
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// POST /api/files
// Questa è la prima differenza importante rispetto a tutte le route precedenti. Hai due middleware invece di uno:
// Express accetta una lista di middleware prima dell'handler finale. Li esegue in ordine, uno dopo l'altro
router.post('/', upload.single('file'), async (req, res) => {
    // Dice a multer di aspettarsi un solo file nel campo chiamato 'file'. 
    // Il nome deve corrispondere esattamente al nome del campo nel form HTML o nella chiamata fetch del frontend. Se il frontend usa un nome diverso, req.file sarà undefined. -> 400
    if (!req.file) {
        return res.status(400).json({ error: 'Nessun file caricato' });
    }

    // recupero id materia e id gruppo dal body
    const { materia_id, gruppo_id } = req.body;

    // Dopo che multer ha processato la richiesta, req.file contiene tutte le informazioni sul file appena salvato:
    /* - req.file.originalname — nome originale del file
       - req.file.path — percorso su disco
       - req.file.mimetype — tipo del file
       - req.file.size — dimensione in byte */
    try {
        // inserisco un nuovo elemento di files nel database
        const [result] = await db.query(
        `INSERT INTO files
            (utente_id, materia_id, gruppo_id, nome_originale, path_server, tipo_mime, dimensione_bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            req.user.id, // req.user viene dal middleware di autenticazione!
            materia_id || null,
            gruppo_id  || null,
            req.file.originalname,
            req.file.path,
            req.file.mimetype,
            req.file.size,
        ]
        );

        // l'inserimento ha avuto successo -> 201 + informazioni della nuova materia (insertId è l'id che MySQL ha assegnato al nuovo evento tramite AUTO_INCREMENT.)
        // non invio tutti i campi dell'evento creato, solo i principali, che potrebbero essere utili al client (principalmente l'id del file)
        res.status(201).json({
        id:             result.insertId,
        nome_originale: req.file.originalname,
        tipo_mime:      req.file.mimetype,
        dimensione:     req.file.size,
        });
    
        // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// DELETE /api/files/:id
// Nelle route precedenti la DELETE era semplice — una query e via. Qui invece hai tre step in sequenza, perché eliminare un file significa eliminare due cose:
// 1. trova il file nel DB e recupera il path sul disco
// 2. elimina il file fisicamente dal disco
// 3. elimina il record dal database
// perchè prima dal disco e poi dal DB? 
/* Se facessi prima la DELETE sul DB e poi unlinkSync fallisse, il record sarebbe sparito ma il file sarebbe ancora sul disco — un file orfano che non puoi più eliminare perché hai perso il riferimento nel DB.
Facendo il contrario — prima disco poi DB — se unlinkSync fallisce puoi gestire l'errore nel catch e il record nel DB è ancora lì intatto. Puoi riprovare. */
router.delete('/:id', async (req, res) => {
    try {
        // Primo passo: recupero il path del file dal DB, tramite una query SELECT
        const [rows] = await db.query(
        'SELECT path_server FROM files WHERE id = ? AND utente_id = ?',
        [req.params.id, req.user.id] // l'id del file viene dal paramtero dinamico dell'url, req.user viene dal middleware di autenticazione!
        );

        // se la query non trova nulla, il file non esiste o non appartiene all'utente -> 404
        if (rows.length === 0) {
        return res.status(404).json({ error: 'File non trovato' });
        }

        // Secondo passo: elimino il file dal disco
        // fs.unlinkSync elimina fisicamente il file dal disco, indicando il suo percorso. unlink è il termine Unix per "elimina file", 
        // Sync significa che è sincrono — blocca l'esecuzione finché il file non è stato eliminato.
        fs.unlinkSync(rows[0].path_server);

        // Terzo passo: elimino l'elemento file dal DB, tramite query
        await db.query(
        'DELETE FROM files WHERE id = ? AND utente_id = ?',
        [req.params.id, req.user.id]// l'id del file viene dal paramtero dinamico dell'url, req.user viene dal middleware di autenticazione!
        );

        // l'eliminazione ha avuto successo -> 200 (automatico con json()) e messaggio di successo
        res.json({ message: 'File eliminato' });

    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});

// esporto il Router specifico di files.js, rendendo questa rotta disponibile negli altri file (in modo da poterlo montare in server.js)
module.exports = router;