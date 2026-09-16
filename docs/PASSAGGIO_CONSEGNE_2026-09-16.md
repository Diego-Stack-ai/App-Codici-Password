# Passaggio di consegne — Codici & Password

Data: 16 settembre 2026. Relazione verificata su Git, cartelle locali, test e PR. Documento di consegna, non nuovo piano né autorizzazione al rilascio. Prevalgono baseline sicurezza e contratti specialistici.

## 1. Punto di partenza per il nuovo agente

- Repository GitHub: https://github.com/Diego-Stack-ai/App-Codici-Password
- **Cartella principale per continuare il programma MD:** `C:/Users/Diego/Documents/Progetti/App-Codici-Password`.
- Ramo di lavoro: `integration/vault-shell-v127-security`.
- Ultimo commit applicativo della candidata: **`ebf1b1fad55af1434cc202ed49d93354d4152e51`**, già inviato su GitHub. Questa relazione viene registrata in un successivo commit documentale: usare `git log -1` per il checkpoint più recente.
- PR sperimentale **#67**, ancora bozza: https://github.com/Diego-Stack-ai/App-Codici-Password/pull/67. Base **`experiment/m6-private-note-provider`**, NON master. Non cambiare base o unire tutta la PR per pubblicare una sola funzione.
- Versione realmente online: **1.2.128**, Hosting `https://appcodici-password.web.app`.
- Master remoto: **`4efda528b418d7cc15ad653ad179aaa55a2f396e`**, merge della PR #68; commit funzionale PDF **`9d0f70658e0d220ecb6c7404e6e2a76ce0749cf0`**.
- La candidata conserva numero 1.2.127: non è la versione online e non deve ricevere un bump solo per uniformare il numero.
- Ripresa automatica `completa-programma-md-codici-password` messa in **PAUSA** durante questa consegna per evitare due agenti scriventi. Riattivare solo dopo aver concordato chi controlla il ramo.

## 2. Scopo e obiettivo

L'app custodisce credenziali, profili personali/aziendali, Widget, dati bancari, documenti e allegati. Il programma MD serve a farla evolvere conservando le funzioni esistenti e rendendo verificabili sicurezza, autorizzazioni, scritture, disponibilità offline e recupero.

La direzione già approvata è una **shell persistente**: il documento rimane caricato durante la navigazione interna e la Vault Key resta esclusivamente nella memoria della sessione. Non è da ridiscutere come semplice scelta di stile e non si deve reintrodurre il wrapping della chiave in sessionStorage nella candidata.

L'obiettivo finale non è accumulare controlli o cambiare solo l'aspetto grafico: è sostituire gradualmente il percorso multipagina con un percorso completo, sicuro e collaudato, senza perdere dati o funzioni. Gli MD distinguono contratti, piani, prove e cronologia; non tutti i file Markdown rappresentano lavori indipendenti.

## 3. Cosa è già pubblicato

Non è corretto dire che non è stato pubblicato nulla. Durante il programma sono stati rilasciati correttivi isolati, mentre la migrazione complessiva è rimasta separata.

- Versioni precedenti: interventi su Account/Widget/banca/note e interfaccia; successive correzioni del bootstrap offline iPhone, preparazione offline di profilo/Widget/credenziali e protezione delle pagine private. La cronologia dettagliata è nel registro aggiornamenti e in master.
- **1.2.127:** protezione iniziale delle pagine private fino alla conferma Auth; PR #66, master precedente `0ba2332b`.
- **1.2.128:** scheda PDF aziendale, PR **#68** unita e pubblicata il 16/09/2026. Porting selettivo del PDF sperimentale `a2a0252a` sulla versione produttiva; non include la PR #67.
- Percorso PDF online: Azienda → Dati azienda → Scheda PDF. Scelta gruppi, anteprima, generazione sul dispositivo, download e condivisione su azione dell'utente. Password, PIN/PUK, note riservate, banca e allegati esclusi.
- Rilascio PDF: npm test completo, 23 test PDF, Chrome desktop/viewport mobile, download reale, documento sintetico multipagina renderizzato e ispezionato. CI **35071328912** superata. Asset online confrontati con SHA-256 locali; redirect anonimo della pagina aziendale al login verificato. Nessun accesso a dati reali.
- Safari iPhone e condivisione nativa WhatsApp/email restano da collaudare fisicamente; viewport mobile Chrome non li certifica. Il download è l'alternativa disponibile.

## 4. Cosa contiene la candidata non ancora pubblicata

Questi sono cambiamenti reali di codice, accompagnati da test: non soltanto analisi.

| Area | Implementato nella candidata | Limite da conservare |
|---|---|---|
| Shell e sessione | Navigazione interna, chiave RAM, revoca di viste/capability al blocco/logout/cambio UID | Percorso completo produttivo non ancora sostituito |
| Profili | Vista comune privato/azienda, panoramica, anagrafica, contatti, indirizzi, documenti e directory aziende | Parità completa degli editor ancora aperta |
| Offline | Preparazione automatica dei domini testuali allo sblocco, consultazione senza visita preventiva, riavvio offline e nuovo sblocco | Foto e byte degli allegati esclusi; eviction/disco/grandi archivi da collaudare |
| Account | Consultazione Widget, credenziali comuni e dati bancari; Widget legati al conto sopra le carte | Editor completi, ordine e altri flussi non tutti montati |
| Anagrafica | Modifica/svuotamento testi e note cifrati, conferma e refresh senza reload | Writer/trasporto candidati di laboratorio |
| Note Account | Editor della sola nota per Account collegati/aziendali, preservazione degli altri campi; percorso M6 di recupero coda mantenuto | Nuovo editor offline consultivo; parità UI completa ancora aperta |
| Collegamenti | Collega/Cambia/Scollega con ricerca personale/azienda, destinazioni riutilizzabili, riferimenti inversi atomici, UID/revisione/impronta/ricevuta | Origini solo con identità canonica supportata; code pendenti bloccano la mutazione |
| QR/vCard | Generazione da selezione esplicita, proiezione minima, editor privato e flag fissi aziendali | Extra/ID legacy e collaudo importazione foto su dispositivo aperti |
| PDF | Generatore locale e vista della candidata | Funzione già portata separatamente in produzione; non duplicare il rilascio |
| Excel | Proiezione revocabile e mascheramento corretti nella candidata | XLSX completo, UI, consenso/riautenticazione e download da integrare |

Ultime prove della candidata `ebf1b1fa`: npm test completo, **513 test shell**, emulatori e **109 verifiche browser Chrome** (77 entry online/offline + 32 arresto/riapertura). CI **35070097640** superata. Sono prove su fixture/progetto `demo-vault-shell`, non certificazione della produzione o di Safari.

Commit recenti utili: `ebf1b1fa` montaggio collegamenti; `781c7974` note e recupero coda; `e21202ac` provider note; `713127a1` servizio note; `053440f7` selettore Account; `8d5be66d` mutazioni atomiche dei collegamenti; `520aafd2` editor anagrafica; `a2a0252a` PDF sperimentale.

## 5. Perché non si pubblicano insieme tutti i commit

1. **Parità incompleta:** rilasciare tutta la shell ora potrebbe rendere indisponibili flussi di modifica/creazione o pagine ancora sul percorso precedente.
2. **Confine di laboratorio:** nuovi servizi usano bridge loopback e App Check sintetico negli emulatori. Non equivalgono a callable e attestazione produttivi.
3. **Transizione delle scritture:** occorre coordinare writer legacy, revisioni/ricevute, riferimenti e code pendenti. Non basta copiare la UI o allentare le Rules.
4. **Sicurezza della sessione:** **VS-P0-01 resta aperto in produzione** finché il wrapping legacy non viene realmente sostituito, con migrazione, revoca e rollback verificati. Il PDF non chiude questo problema.
5. **Gate reali aperti:** iPhone/Safari, Edge attuale, grandi archivi, eviction/disco, recuperi M5–M10 e audit indipendente.

Commit significa lavoro registrato in Git; push significa copia su GitHub; PR significa proposta di integrazione; merge significa integrazione del ramo; deploy significa pubblicazione online. Nessuno di questi passaggi implica automaticamente il successivo. Il workflow di produzione prevede deploy manuale; il rilascio PDF è stato eseguito esplicitamente, solo Hosting.

Al checkpoint prima di questa relazione, #67 aveva **48 commit rispetto alla propria base**. `origin/master..HEAD` mostrava 189 commit, ma include storia divergente, merge e lavori già portati selettivamente: NON significa 189 funzioni nuove da pubblicare. Non usare conteggio commit o numero di MD come percentuale di completamento.

## 6. Prossime attività, in ordine

1. **Riconciliare il rilascio PDF 1.2.128 con la candidata:** confrontare `4efda528`/`9d0f7065`, senza merge/cherry-pick cieco. Il generatore ora esiste anche nel percorso produttivo; condividere o riallineare selettivamente moduli/test preservando la chiave RAM della shell. Non copiare l'adapter legacy nella shell. Preparare integrazione/versione futura solo nel ramo sperimentale, senza nuovo deploy.
2. Completare editor contatti/indirizzi/documenti e creazione Account dal collegamento. Gestire ID persistiti, righe extra/legacy, utenze e documenti aziendali non ancora coperti. Nessun ID inventato da indici di lista.
3. Completare editor Account, Widget e banca mantenendo relazione conto/Widget/carte, credenziali condivise, cifratura e compatibilità della coda. Integrare scadenze, impostazioni, archivio, backup e salute credenziali nella shell.
4. Integrare Excel selettivamente: identità composta dominio/azienda/Account, filtraggio selettori, PUK/valueEnc mascherati prima di decifrare, consenso/riautenticazione, formula injection, revoca fino al download e parità dei metadati allegati. Non confondere Excel con backup cifrato.
5. Chiudere i gate tecnici M5–M10 ancora autonomi: staging/ripresa backup, retry, orfani e concorrenza su copie sintetiche; callable/Auth/App Check, transizione writer e Rules produttive da progettare/testare prima di attivare.
6. Eseguire i collaudi fisici/esterni rimasti, poi preparare cutover della shell e piano di rollback. Solo dopo parità e gate soddisfatti proporre un rilascio complessivo. Il programma NON è concluso.

Quando una voce dipende da Diego, registrarla e proseguire una voce indipendente. Nuovo ramo solo se serve un isolamento reale; evitare altri rami per il solo fatto di aver terminato un turno.

## 7. Cartelle controllate in Documenti

Ricognizione delle directory fino a otto livelli, escludendo dipendenze/cache e senza seguire junction. Confrontati Git, ramo, commit e package.json dei repository pertinenti; nessuna cartella spostata/cancellata, nessun contenuto di dati personali aperto.

| Cartella | Stato verificato | Cosa farne |
|---|---|---|
| `Documents/Progetti/App-Codici-Password` | Ramo candidata `integration/vault-shell-v127-security`, `ebf1b1fa` prima del commit di consegna | **Riferimento principale per continuare il programma MD** |
| `Documents/Codex/2026-09-12/co/work/company-pdf-release` | Worktree `release/company-pdf-summary`, `9d0f7065`, versione 1.2.128; PR #68 merged | Riferimento locale del PDF rilasciato. Master remoto `4efda528` è l'autorità per la produzione |
| `Documents/Progetti/Codici&Password` | Clone separato, ramo `codex/real-excel-export-preview`, `40052515`, package 1.2.99 | **Non usarlo come base aggiornata generale. Conservare** per lavoro Excel e modifiche locali |
| `Documents/Progetti/Codici&Password/.codex-worktrees/account-detail-ui-preview` | `codex/account-detail-ui-v118`, `d2ef897e`, 1.2.118 | Worktree storico; non base corrente |
| `Documents/Progetti/Codici&Password/.codex-worktrees/ui-redesign` | `codex/redesign-ui-typography`, `098110aa`, 1.2.26 | Worktree storico; non base corrente |
| `Documents/antigravity/elegant-goodall` | Repository senza origin, commit iniziale `9608609`, directory backend non tracciata | Non verificato come clone di Codici & Password; non usarlo come riferimento |

Nella cartella Progetti ci sono **modifiche NON committate** a `docs/PIANO_MATURITA_PROFESSIONALE.md` (3 righe aggiunte, 7 rimosse) e directory non tracciate `.qwen/`, `outputs/`. Non sono state importate o sovrascritte. Il commit Excel `40052515dd493279c0f49118205b9405eef05376` è già disponibile su `origin/codex/real-excel-export-preview` nel repository principale, ma questo non salva le modifiche locali sopra.

### Chiarimento sul recupero Excel

**Il codice Excel è già stato recuperato nel repository principale**, come ramo remoto `origin/codex/real-excel-export-preview` al commit `40052515`. Non è necessario ripartire dal vecchio clone per recuperare quel codice. La presenza dell'oggetto/ramo Git non significa che i suoi file siano già montati nel ramo attualmente aperto né che la funzione sia online: la nuova shell contiene per ora l'adattamento della proiezione, non l'integrazione XLSX completa.

Verifica precisa delle differenze della vecchia cartella:

- L'unica modifica a file già tracciati riguarda l'MD del piano: toglie dal post-M10 il censimento e collaudo dei lucchetti/campi protetti, riducendo il titolo e l'uscita a lingue/Impostazioni. Non è codice Excel e non è stata trasferita come nuova decisione; i controlli di sicurezza rimangono richiesti. Non è possibile attribuire l'autore di una modifica non committata dalla sola differenza Git.
- `.qwen/settings.json` è un file di configurazione locale non tracciato. Non è stato aperto né copiato: può contenere preferenze o dati d'ambiente non destinati al repository.
- `outputs/excel-export-prototype/` contiene un XLSX dimostrativo, anteprima-consultazione.png, errors.ndjson, inspection.ndjson e anteprime PNG di Account, Allegati, Aziende, Campi-account, Collegamenti, Contatti, Documenti, Indirizzi, Profilo, Scadenze e Utenze. Sono file di output/prova, non modifiche al sorgente; il contenuto dei dati non è stato letto in questa ricognizione.
- **Non risultano modifiche locali non committate al codice Excel.** Configurazioni e output non tracciati non viaggiano con fetch/push. Conservarli nella vecchia cartella finché non si decide se archiviarli, senza importarli ciecamente nell'app.

Le altre directory sotto `co/work` sono worktree dello stesso repository, non tutte copie da aggiornare: `account-bridges-release`, `common-widget-picker-release`, `company-contact-release`, `company-refresh-release`, `company-tabs-release`, `iphone-offline-bootstrap`, `offline-profile-widgets-release`, `shared-widget-release`, `widget-picker-style-release`. `git worktree list` ne descrive il legame. Non cancellarle con Explorer: prima verificare stato, patch non pubblicate e rimozione tramite Git. Nessuna pulizia autorizzata/eseguita in questa consegna.

La cartella principale NON contiene automaticamente il codice identico all'app online: contiene la candidata più avanzata. Per un correttivo produttivo partire da master aggiornato in un worktree dedicato. Non spostare ora tutto in Progetti: prima salvare e riconciliare il lavoro Excel.

## 8. Come leggere e aggiornare gli MD

1. `docs/GUIDA_PROGETTO.md`: indice e gerarchia.
2. `docs/ARCHITETTURA_SICUREZZA_V1.md`: baseline vincolante, invariata.
3. `docs/PIANO_MATURITA_PROFESSIONALE.md`: stato attuale e ordine dei lavori; le sezioni precedenti sono cronologia.
4. Contratti dell'area: `VAULT_KEY_CONTRACT.md`, `DATA_ACCESS_CONTRACT.md`, `FUNCTIONAL_DATA_CONTRACT.md`, `PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md`, M5–M10 secondo attività.
5. `Frontend/GUIDA.md` e `Frontend/GUIDA_AGGIORNAMENTI.md`: regole applicative, UI e diario.
6. Verificare sempre codice, Rules, Functions e test; un checkbox storico non certifica il nuovo percorso.

Prima della relazione risultavano 39 MD tracciati: comprendono guide, audit, inventari e contratti, non 39 programmi. Questa relazione aggiunge un documento di consegna, non una seconda roadmap. Le sezioni storiche conservano versione/data originali; lo stato corrente in testa prevale sulla vecchia lista operativa, senza derogare alla baseline.

## 9. Ambiente, test e limiti operativi

Windows/PowerShell, Node 24 locale; CI Node 22 e Java 21. Emulatori solo progetto `demo-vault-shell` per la candidata. Eseguire suite che usano gli stessi emulatori in sequenza, non in parallelo. Chrome 152 verificato; Edge locale nella candidata termina prima di DevTools, non attribuirgli successi non eseguiti. Nessun test qui autorizza l'accesso ai dati reali.

Comandi dalla cartella principale: `npm test`, `node scripts/run-vault-session-emulators.mjs --entry-browser`, `node scripts/run-vault-session-emulators.mjs --crash-browser` con `VAULT_SHELL_BROWSER=chrome`; `git diff --check`, `node scripts/audit-project-inventory.mjs`. Adattare i test al cambiamento; evitare ripetizioni senza nuove modifiche o dubbi.

Log locali delle ultime prove: nella cartella padre `co/work`, `profile-link-mounted-full.log`, `profile-link-mounted-entry.log`, `profile-link-mounted-crash.log`; rilascio PDF `pdf-release-full.log`, `pdf-release-browser.log`, `pdf-release-deploy.log`. Non allegare log grezzi senza controllare eventuali segreti. Non stampare l'output JSON di login Firebase: può includere token; usare soltanto stato filtrato.

Prima di lavorare: controllare directory, branch, status e processi propri. Non modificare master/deploy nella prosecuzione MD; il consenso del PDF riguardava quel rilascio isolato. Non integrare ramo documentale cloud `3a8e5a2` o patch `851b788` come base della shell. Non fare nuove migrazioni/distruzioni né cancellare code senza autorizzazione specifica. Commit coerenti e push sulla PR #67, documentando test e limiti. Il nuovo agente deve riferire prima ciò che ha verificato, poi proseguire il blocco concordato.
