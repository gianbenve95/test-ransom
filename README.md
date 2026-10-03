# tazzedimerda

Sito ecommerce immersivo per **tazzedimerda**, laboratorio ceramico di **Arena (VV), Calabria**.
Statico, senza build e senza dipendenze: HTML + CSS + JavaScript puro.

## Avvio

```bash
python3 -m http.server 8080   # poi apri http://localhost:8080
```

(oppure apri direttamente `index.html`).

## Cosa c'è

- Loader animato, hero con particelle canvas, titolo gigante, cursore personalizzato, pulsanti magnetici
- Manifesto con testo che si illumina parola per parola e contatori animati
- **Shop**: 10 prodotti, filtri per categoria, ordinamento, scheda prodotto, tilt 3D sulle card
- **Il Laboratorio**: sezione a scroll orizzontale (5 stazioni + mappa stilizzata della Calabria con Arena)
- **Configuratore** "tazza su misura" con anteprima SVG live e prezzo dinamico
- **Carrello** con persistenza (localStorage), soglia spedizione gratuita (60 €), codice `ARENA10` (−10%)
- Checkout **demo** (nessun pagamento reale, nessun dato inviato)
- Recensioni trascinabili, FAQ, newsletter, footer; responsive e `prefers-reduced-motion`

Le tazze sono disegnate via SVG (`js/data.js`), quindi non servono immagini.

## Da sostituire prima della messa online

Tutti i contenuti sono **segnaposto**:

- numeri (tazze consegnate, % clienti, "dal 2019"), recensioni e nomi dei clienti
- email, telefono, orari e indirizzo del laboratorio (`index.html`, sezione Contatti)
- link social, Privacy / Cookie / Condizioni di vendita / Resi (`href="#"`)
- checkout e newsletter sono solo front-end: vanno collegati a un provider
  (es. Stripe / Shopify / WooCommerce e un servizio email)
