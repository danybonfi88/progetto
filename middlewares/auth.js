// IMPORTO LE LIBRERIE //
/* importo jsonwebtoken, utile per creazione e verifica dei jwt */
const jwt = require('jsonwebtoken');
/* importo dotenv, utile per leggere file .env */
const dotenv = require('dotenv');
/* leggo il file.env e carico le variabili nell'oggetto process.env */
dotenv.config();

// module è il "cancello" attraverso cui un file decide cosa vuole rendere disponibile agli altri
module.exports = function authMiddleware(req, res, next) {
    // salvo l'header 'autorization' in una variabile, che contiene il jwt inviato dal front-end
    const authHeader = req.headers['authorization'];
    /* il valore dell'header arriva come stringa: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    il valore viene splittato e salvato in un array ['Bearer', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...']*/
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    // verifico se il token ha un valore, se il front-end l'ha mandato
    /* se non c'è, invio 401 Unauthorized */
    if (!token) {
        return res.status(401).json({ error: 'Token mancante' });
    }


    // il try catch serve per verificare il token tramite verify(), e intercettare l'errore lanciato in caso di firma non valida o token scaduto
    try {
        // verifico la firma -> il metodo verify:
        /* 1) verifica la firma del token
        /* 2) in caso sia verificata, decodifica il payload, e lo salva nella variabile
        /* 3) controlla la scadenza e, se scaduto, lancia un errore */
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        // nel parametro user della req, salvo l'oggetto con i claim estratti dal token
        req.user = payload; // { id, email, nome }
        next(); // passa alla route
    } catch (err) {
        return res.status(403).json({ error: 'Token non valido o scaduto' });
    }
};