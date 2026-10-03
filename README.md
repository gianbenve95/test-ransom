# tazzedimerda

Sito ecommerce **cinematografico** per *tazzedimerda*, laboratorio ceramico di **Arena (VV), Calabria**.

La protagonista è una tazza 3D in tempo reale (WebGL / Three.js) che attraversa tutto il sito:
nell'hero fuma tra migliaia di particelle, nel laboratorio **nasce mentre scorri**
(blocco d'argilla → tornio → essiccazione e manico → smalto → forno a 1.240 °C → collaudo),
nel configuratore diventa la tua tazza su misura e chiude il film nei titoli di coda.

## Avvio

```bash
npm run serve        # oppure: python3 -m http.server 8080
# apri http://localhost:8080
```

Il sito è statico: `js/stage.js` è già compilato e incluso nel repository.

## Sviluppo della scena 3D

Il sorgente è in `src/stage.js`. Dopo una modifica:

```bash
npm install
npm run build        # crea js/stage.js (Three.js incluso) e copia Lenis in vendor/
```

## Cosa c'è

**Regia e pellicola**
- Titoli di testa legati al caricamento reale, carrellata all'indietro della camera, barre letterbox
- HUD da cinepresa (REC, timecode, capitolo, coordinate di Arena), grana, vignettatura, aberrazione cromatica legata alla velocità di scroll
- Scroll morbido (Lenis), cursore personalizzato, pulsanti magnetici
- Audio d'ambiente sintetizzato con Web Audio (stanza, bordone e crepitio del forno che aumenta col calore). Si attiva solo dal pulsante "Audio"

**Scena 3D (`src/stage.js`)**
- Tazza modellata al tornio virtuale (LatheGeometry) con morph argilla → tazza, manico tubolare, caffè con crema
- Materiale ceramico PBR: smalto lucido con clearcoat, oro metallico, piede in gres non smaltato, puntinatura ferrosa, emblema e scritta nello smalto
- Vapore volumetrico a rumore frattale, particelle GPU con bokeh e profondità di campo, braci nel forno, esplosione al clic
- Post-produzione: bloom, tone mapping ACES, grana, vignettatura, aberrazione cromatica
- "Studio fotografico" separato con ombre morbide: genera le foto prodotto dello shop e le rotazioni a 360°

**Ecommerce**
- 10 prodotti, filtri, ordinamento, scheda prodotto con rotazione a 360° trascinabile
- Configuratore (forma, smalto, emblema, scritta) con anteprima 3D trascinabile
- Carrello persistente, spedizione gratuita sopra 60 €, codice `ARENA10` (−10%), checkout **demo**

**Fallback**: senza WebGL il sito usa le tazze SVG di `js/data.js` e resta pienamente funzionante.
Rispetta `prefers-reduced-motion`.

## Da sostituire prima della messa online

Tutti i contenuti sono **segnaposto**:

- numeri (tazze consegnate, % clienti), recensioni e nomi dei clienti
- email, telefono, orari e indirizzo del laboratorio
- link social, Privacy / Cookie / Condizioni di vendita / Resi (`href="#"`)
- checkout e newsletter sono solo front-end: vanno collegati a un provider
  (es. Stripe / Shopify / WooCommerce e un servizio email)
