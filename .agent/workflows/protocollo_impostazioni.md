---
description: Protocollo Standard Titanium Impostazioni V1.0 (Based on Account V1.1)
---

# Titanium Impostazioni Standard Protocol V1.0
> **NOTA:** Questo protocollo definisce lo standard per le pagine di configurazione e gestione dati (Impostazioni, Profilo, Dati Tecnici).

Questo workflow definisce lo standard per le pagine di gestione (Settings/Dati). L'obiettivo è mantenere la coerenza visiva "Titanium" per tutte le pagine di configurazione, garantendo un'esperienza premium e blindata.

## 1. Pagine Target
Questo stile deve essere applicato a:
1.  `impostazioni.html` (Impostazioni App)
2.  `profilo_privato.html` / `dati_anagrafici_privato.html` (Dati Personali)
3.  `configurazione_automezzi.html` (Nuova pagina futura)
4.  Qualsiasi pagina di gestione dati (es. Dati Tecnici, Configurazione Dispositivi).

## 2. Requisiti di Stile (auth_impostazioni.css)
*   **CSS Unico**: Tutte queste pagine devono caricare `assets/css/auth_impostazioni.css`.
*   **No Tailwind**: Come per l'intera suite Titanium, Tailwind è VIETATO in favore del Pure CSS.
*   **Layout Adaptativo**: Utilizzare il `.settings-container` per gestire liste e gruppi di opzioni. Il `.glass-glow` (Faro) deve sempre fare da scenografia.

## 3. Standard Selettore Lingua (MANDATORIO)
È VIETATO usare accordion o menu standard per il cambio lingua.
*   **Standard**: Deve essere usato esclusivamente il **Floating Language Selector Premium** (`.lang-selector-container`).
*   **Posizionamento**: Sempre in alto a destra (`top: 1.5rem; right: 1.5rem;`).
*   **Coerenza**: La saetta sul bottone lingua deve essere presente e sincronizzata con la card profilo principale.

## 4. Componenti UI Standard
Ogni pagina di impostazione deve usare questi componenti:
1.  **Card Profilo/Hero**: `.titanium-vault.profile-card` con bordo `.border-glow`.
2.  **Lista Gruppi**: Struttura `.settings-group` (contenitore arrotondato).
3.  **Voci Singole**: `.settings-item` (display flex con header e info).
4.  **Icone Glass**: Glass box con classi colore (`.bg-blue-glass`, `.bg-amber-glass`, etc.).
5.  **Toggle**: Usare rigorosamente l'input `.titanium-toggle`.
6.  **Timer Selector**: Segmented control `.timer-selector` per opzioni temporizzate.

## 5. Checklist di Validazione Impostazioni
- [ ] **Pure CSS**: Tailwind rimosso completamente?
- [ ] **Premium Selector**: Il selettore lingua fluttuante è presente e orientato correttamente?
- [ ] **Coerenza Saetta**: La saetta è attiva su tutte le card e pulsanti premium?
- [ ] **Multilanguage**: Tutte le etichette (label e descrizioni) hanno `data-t`?
- [ ] **Responsive**: Il layout respira correttamente su schermi piccoli (< 768px)?
