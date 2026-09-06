# Baseline runtime M0 — iPhone e PC

> Misure raccolte il 6 settembre 2026 tramite la diagnostica locale della versione 1.2.51. I report contengono soltanto tempi, pagina, stato rete e conteggi tecnici.

## Metodo

- PC portatile: viewport 1536×695, connessione indicata come 4G dal browser.
- iPhone: viewport 393×852, classe touch.
- Navigazione ripetuta tra Home, Profilo, Area privata, Account, Aziende, Scadenze e Impostazioni.
- `page-navigation` misura la disponibilità della struttura iniziale.
- `private-page-bootstrap` misura il completamento dell'inizializzazione applicativa della pagina.
- Le mediane sono preferite ai singoli valori; i picchi restano registrati perché indicano attese intermittenti reali.

## Risultati sintetici

| Pagina | PC online | PC offline | iPhone online | iPhone offline | Valutazione iniziale |
|---|---:|---:|---:|---:|---|
| Home | ~1,76 s; picchi 9,50/18,67 s | ~0,50 s; prima navigazione 28,85 s | ~1,08 s; picco 3,62 s | ~0,15 s | bootstrap normalmente buono; picchi online e timeout iniziale PC da isolare |
| Area privata | 2,10 s | ~1,75 s | ~1,13 s | 0,54 s | PC da ottimizzare |
| Account privati | 9,57 s | 6,20 s | ~4,15 s; picco 33,37 s | 2,98 s | priorità critica su entrambi i dispositivi |
| Dettaglio account privato | non campionato | 0,50 s | 1,18 s | 0,17 s | buono |
| Lista aziende | ~0,84 s | 0,30 s | ~0,72 s | ~0,09 s | buono |
| Account aziendali | ~6,52 s | 4,84 s | ~3,16 s | 2,43 s | priorità critica |
| Dettaglio account aziendale | 1,66 s | non campionato | campione incompleto | 0,21 s | percorso offline buono; completare campioni online durante la correzione |
| Dati azienda | non campionato | non campionato | 1,05 s | ~0,12 s | buono |
| Profilo | ~2,90 s | 1,45 s | ~1,42 s | 0,60 s | PC online da ottimizzare |
| Scadenze | 1,42 s | non campionato | ~0,73 s | non campionato | buono nei campioni disponibili |
| Impostazioni | ~2,97 s | 1,04 s | ~1,10 s | prova conclusa tornando online | PC online da ottimizzare |
| Archivio | non campionato | non campionato | 25,14 s | non campionato | priorità critica, campione singolo da confermare |

## Evidenze architetturali

1. Le liste Account restano lente offline: la causa include elaborazione, decifratura, composizione delle condivisioni o rendering, non soltanto la rete.
2. Il PC ha atteso 28,85 secondi nella prima navigazione dopo la disconnessione, mentre il relativo bootstrap Home è durato 0,65 secondi. Va verificata la strategia di navigazione/fallback del Service Worker o un'attesa di rete precedente al documento.
3. Su iPhone online ogni pagina ha riportato circa 229–238 KB trasferiti, mentre sul PC caldo il trasferimento era 0 KB. Va verificata l'interazione tra Safari/PWA, Service Worker e header `no-store`, in particolare per il runtime Firebase condiviso.
4. I dettagli dei singoli Account sono rapidi offline: non è necessario nascondere le credenziali dietro un ulteriore passaggio per ottenere prestazioni accettabili.
5. `offline-sync` identifica la preparazione della cache e può comparire online; non rappresenta da solo una prova in modalità aereo.

## Priorità risultante

1. Account privati e Account aziendali.
2. Archivio e picchi intermittenti Home.
3. Prima apertura offline su PC.
4. Cache degli asset su iPhone.
5. Profilo, Impostazioni e Area privata su PC.

## Gate di confronto

- Online caldo: primo contenuto utile entro 1,5 s come obiettivo.
- Offline caldo: primo contenuto utile entro 1 s come obiettivo.
- Online freddo: entro 3 s come obiettivo iniziale.
- Nessuna attesa di rete lunga prima del fallback offline.
- Nessuna regressione delle pagine che oggi rientrano già nei limiti.

Questa baseline chiude M0 ma non certifica che tutti gli obiettivi siano raggiunti: costituisce il riferimento prima/dopo per M1–M4.
