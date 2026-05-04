// IMPORTO LE LIBRERIE
/* express */
const express = require('express');
/* db: importa il file db.js, salvato in un'altra cartella del progetto*/
const db = require('../config/db');
/* auth: importa il file auth.js, salvato in un'altra cartella del progetto*/
const auth = require('../middlewares/auth');
/* router: creo il Router specifico di questa rotta, su cui registro gli endpoint specifici*/
const router = express.Router();

// Tutte le route qui sotto richiedono il login
router.use(auth);


// GET /api/chat
router.get('/', async (req, res) => {
    try {
        // estraggo solo le righe della query, senza metadati (come solito)
        // estraggo tutti i campi di messaggi, appartenenti all'utente che fa la richiesta GET, ordinati per data crescente
        const [rows] = await db.query(
        `SELECT * FROM messaggi
        WHERE utente_id = ?
        ORDER BY timestamp ASC`,
        [req.user.id] // req.user viene dal middleware di autenticazione!
        );

        // restituisco il risulato della query (res.json() usa 200 di default)
        res.json(rows);
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// POST /api/chat
router.post('/', async (req, res) => {
    // estraggo i campi dal body per creare il nuovo messaggio (il testo)
    const { testo } = req.body;

    // verifico che il body abbia effettivamente mandato un body, se no -> 400
    if (!testo) {
        return res.status(400).json({ error: 'Messaggio obbligatorio' });
    }

    try {
        // 1. Salva il messaggio dell'utente nel DB
        // lo salvo subito, perchè dal prossimo passo recupero tutta la cronologia, incluso questo messaggi, per darla in pasto a claude
        await db.query(
        'INSERT INTO messaggi (utente_id, testo, mittente) VALUES (?, ?, ?)',
        [req.user.id, testo, 'user'] // req.user viene dal middleware di autenticazione!
        );


        // 2. Recupera la cronologia per darla come contesto a Groq
        // estraggo testo e mittente dei messaggi, riferiti all'utente che sta facendo la richiesta, ordinati per tempo crescente
        const [cronologia] = await db.query(
        `SELECT testo, mittente FROM messaggi
        WHERE utente_id = ?
        ORDER BY timestamp ASC`,
        [req.user.id] // req.user viene dal middleware di autenticazione!
        );


        // 3. Trasforma la cronologia nel formato che si aspetta l'API: per ogni messaggio estratto, lo conmverto nel formato richiesto
        // L'API di Groq si aspetta i messaggi in un formato preciso — un array di oggetti con role e content
        
        // map() è un metodo degli arrei che trasforma ogni elemento in qualcosa di diverso, producendo un array della stessa lunghezza dell'originale
        /* parametri del map(): elemento => trasformazione - arrayOriginale.map(elemento => trasformazione)
        Per ogni elemento dell'array originale, esegui la trasformazione e il risultato va nel nuovo array. L'array originale non viene modificato. */
        const messaggi = cronologia.map(m => ({
        role:    m.mittente === 'user' ? 'user' : 'assistant', // role è il mittente del messaggio (ruolo)
        /* nel nostro  db, come ruolo dei messaggi usiamo 'user' e 'bot. CLaude però utilizza e capisce solo 'user' e 'assistant'
        Leggi così: "se mittente è 'user' allora usa 'user', altrimenti usa 'assistant'". In pratica stai rinominando 'bot' in 'assistant'.*/
        content: m.testo // content è il testo del messaggio
        }));

        
        // 4. Chiama l'API di Groq
        /* 
        METHOD: post
        HEADERS:
        - content-type: indica il tipo del body inviato - JSON
        - authorization: la chiave segreta che ti autentica presso Groq (API). Viene da process.env.ANTHROPIC_API_KEY
        BODY:
        - model: modello di claude da usare - claude-haiku-4-5-20251001 è il più veloce ed economico, perfetto per un chatbot.
        - max_tokens: lunghezza massima della risposta. 1024 è sufficiente per risposte di studio.
        - system: il prompt di sistema. È una stringa che definisce il comportamento del bot — in questo caso lo istruisci a comportarsi da assistente allo studio. 
        - messages: l'array che hai costruito al passo precedente, con tutta la cronologia.
        */
        const risposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model:      'llama-3.1-8b-instant',
                max_tokens: 1024,
                messages:   [
                { role: 'system', content: 'Sei un assistente per lo studio. Aiuta lo studente in modo chiaro e conciso.' },
                ...messaggi  
                ]
            })
        });

        // aspetto la risposta della fatch appena eseguita
        const data = await risposta.json();
        // estraggo il contenuto della risposta
        /* data.content è un array — in teoria Groq potrebbe rispondere con più blocchi di contenuto, ma nella pratica per risposte testuali è sempre un array con un solo elemento. 
        Con [0].message.content prendi il testo della risposta. */
        const testoBot = data.choices[0].message.content;


        // 5. Salva la risposta del bot nel DB
        await db.query(
        'INSERT INTO messaggi (utente_id, testo, mittente) VALUES (?, ?, ?)',
        [req.user.id, testoBot, 'bot'] // req.user viene dal middleware di autenticazione!
        );


        // 6. Risponde al client
        // // restituisco la risposta dell'API CLaude al client (res.json() usa 200 di default)
        res.json({ risposta: testoBot });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// DELETE /api/chat
router.delete('/', async (req, res) => {
    try {
        // elimino tutti i messaggi appartenenti all'utente che fa la richiesta DELETE
        await db.query(
        'DELETE FROM messaggi WHERE utente_id = ?',
        [req.user.id] // req.user viene dal middleware di autenticazione!
        );

        // l'eliminazione ha avuto successo -> 200 (automatico con json()) e messaggio di successo
        res.json({ message: 'Cronologia eliminata' });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});

// esporto il Router specifico di chat.js, rendendo questa rotta disponibile negli altri file (in modo da poterlo montare in server.js)
module.exports = router;