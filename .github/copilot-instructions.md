# Istruzioni degli agenti — Codici & Password

Leggere [indice e regole documentali](../docs/LEGGIMI.md), [stato](../docs/progetto/STATO.md) e [incarico corrente](../docs/progetto/INCARICO_CORRENTE.md). Leggere quindi la [baseline sicurezza](../docs/regole/SICUREZZA.md), i contratti e le decisioni pertinenti. La cronologia si consulta solo quando necessaria.

La struttura è chiusa a **31 MD**. Solo un ordine esplicito di Diego autorizza aggiunte, eliminazioni, rinomine, spostamenti o modifica dell’elenco/controlli. Non creare README, AGENTS, nuovi piani o rapporti Markdown fuori elenco. Aggiornare i contenuti necessari all’incarico nello stesso lavoro; nessuna approvazione aggiuntiva per normale manutenzione documentale già autorizzata.

Solo INCARICO_CORRENTE abilita lavoro: gli ordini nello storico non sono eseguibili. Un solo esecutore; nessuna auto-approvazione. Non dedurre commit, push, merge, deploy o incarichi successivi da un test verde. La skill di orchestrazione non amplia i permessi del progetto.

Distinguere decisioni, runtime del ramo, laboratorio, produzione e storico. Preservare dati, compatibilità, sicurezza e gate; niente segreti in log, screenshot o rapporti. Una modifica alle regole di un dominio aggiorna il relativo contratto; una nuova domanda entra nella raccolta esistente dopo aver cercato eventuali risposte.

Prima della consegna eseguire `npm run test:docs`; indicare fonti lette, documenti aggiornati o motivo della non necessità, verifiche e limiti. Il controllo automatico non sostituisce la revisione della coerenza fra decisioni, stato e requisiti.
