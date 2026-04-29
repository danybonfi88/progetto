// IMPORTO LE LIBRERIE
/* express */const express = require('express');
/* db: importa il file db.js, salvato in un'altra cartella del progetto*/
const db = require('../config/db');
/* auth: importa il file auth.js, salvato in un'altra cartella del progetto*/
const auth = require('../middleware/auth');
/* router: creo il Router specifico di questa rotta, su cui registro gli endpoint specifici*/
const router = express.Router();


// Tutte le route qui sotto richiedono il login
router.use(auth);


// GET /api/materie — lista materie dell'utente loggato
router.get('/', async (req, res) => {
    try {
        // estraggo tutte le righe query (tralasciando i metadata inviati da query()): le materie, 
        // ordinate abc per nome, in base all'di utente (passato nel body ela req dal middleware auth.js)
        const [rows] = await db.query(
        'SELECT * FROM materie WHERE utente_id = ? ORDER BY nome',
        [req.user.id]  // req.user viene dal middleware!
        );
        // restituisco il risulato della query (res.json() usa 200 di default)
        res.json(rows);

    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        res.status(500).json({ error: 'Errore interno' });
    }
});


// POST /api/materie — crea nuova materia
router.post('/', async (req, res) => {
    // estraggo i dati dalla richiesta
    const { nome, colore } = req.body;
    // se non esiste il nome (necessario) -> 400
    if (!nome) return res.status(400).json({ error: 'Nome obbligatorio' });

    try {
        // inserisco i valori, creando un nuovo elemento Materia tramite query
        /* Nota che non estrai utente_id dal body — non ti fidi mai del client per questo. L'id dell'utente 
        lo prendi sempre e solo da req.user.id, che viene dal token JWT verificato dal middleware. Se lo prendessi 
        dal body, un utente potrebbe mandarti un id diverso dal suo e creare materie a nome di qualcun altro. */
        const [result] = await db.query(
        'INSERT INTO materie (utente_id, nome, colore) VALUES (?, ?, ?)',
        // se il colore non è un valore truthy (non è stato inviatyop nel body), uso quello di default
        [req.user.id, nome, colore || '#6366F1']
        );
        // l'inserimento ha avuto successo -> 201 + infromazioni della nuova materia (insertId è l'id che MySQL ha assegnato alla nuova materia tramite AUTO_INCREMENT.)
        res.status(201).json({ id: result.insertId, nome, colore });

    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        res.status(500).json({ error: 'Errore interno' });
    }
});


// DELETE /api/materie/:id — elimina una materia
router.delete('/:id', async (req, res) => {
    try {
        // elimino la materia, indicata tramite parametro dinamico nell'url (/materie/:id -> req.params.id), e id dell'utente (un utente elimina solo le sue materie!)
        // come prima, l'id utente è preso da req.user.id, che viene dal JWT token verificato gia nel middleware
        await db.query(
        'DELETE FROM materie WHERE id = ? AND utente_id = ?',
        [req.params.id, req.user.id]  // AND utente_id = ? è fondamentale!
        );
        // l'eliminazione ha avuto successo -> 200 (automatico con json()) e messaggio di successo
        res.json({ message: 'Materia eliminata' });

    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        res.status(500).json({ error: 'Errore interno' });
    }
});

// esporto il Router specifico di materie.js, rendendo questa rotta disponibile negli altri file (in modo da poterlo montare in server.js)
module.exports = router;