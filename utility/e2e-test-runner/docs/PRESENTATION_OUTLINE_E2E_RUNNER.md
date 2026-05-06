# Scaletta presentazione - Nuova infrastruttura E2E (MapStore2)

## 1) Messaggio principale (1 min)

- Abbiamo introdotto una infrastruttura E2E automatizzata completa, che sostituisce il modello basato prevalentemente su test manuali.
- L'obiettivo della presentazione non e raccontare i passaggi intermedi, ma mostrare il risultato: una piattaforma di test ripetibile, scalabile e usabile da tutto il team.

## 2) Prima vs Oggi (2 min)

### Prima (manuale)

- Verifica lenta e dipendente dalle persone.
- Esito non sempre riproducibile.
- Difficile coprire molte combinazioni di configurazione.
- Onboarding lento per nuovi membri.

### Oggi (infrastruttura E2E)

- Esecuzione standardizzata con runner unico.
- Profili di esecuzione chiari (`base`, `geoserver`, `ldap`).
- Feature gating (`E2E_FEATURES`) per attivare i test solo quando la capability esiste.
- Pipeline locale/CI allineata e ripetibile.

## 3) Punti forti (2 min)

- Affidabilita: test eseguiti sempre con lo stesso processo.
- Scalabilita: aggiungere suite e profili senza riscrivere l'infrastruttura.
- Manutenibilita: convenzioni centralizzate, documentazione chiara, meno logica sparsa.
- Velocita di feedback: regressioni individuate prima e con maggiore confidenza.
- Collaborazione: base condivisa tra QA, sviluppo e operation.

## 4) Punti deboli / limiti reali (2 min)

- Costo iniziale di setup e manutenzione test data.
- Flakiness possibile su UI complesse o asincrone se non si seguono standard rigorosi.
- Necessita di disciplina su selector strategy, cleanup e feature gating.
- Tempo di build/esecuzione non nullo: va gestito con priorita e suite mirate.

## 5) Come accelerare la scrittura dei test (3 min)

- Standardizzare template test (Given/When/Then + `test.step`).
- Riusare helper comuni (login, navigation, cleanup) invece di duplicare flussi.
- Lavorare per feature/suite, non per pagine isolate.
- Definire una libreria di casi tipo riusabili (auth, smoke, maps, integrazioni).
- Usare prompt strutturati e checklist di review per ridurre iterazioni.
- Introdurre fast lane: smoke subset su PR, suite complete su schedule/nightly.

## 6) Come far creare test a chi non ha esperienza di coding (4 min)

### Modello operativo "No-code assisted"

- La persona funzionale descrive il comportamento atteso in linguaggio naturale.
- Usa un prompt guidato (template) per generare la bozza del test.
- Il sistema genera uno scheletro con feature gate, step leggibili e assertion base.
- Un reviewer tecnico fa solo validazione finale (selector stabilita, cleanup, naming).

### Ruoli consigliati

- Domain expert (non coder): definisce scenari, dati, criteri di accettazione.
- AI assistant: traduce scenario in test Playwright aderente alle convenzioni.
- Reviewer tecnico: approva robustezza e integrazione nella suite corretta.

### Guardrail minimi

- Ogni test deve dichiarare feature richiesta.
- Nessuna wait temporale hardcoded.
- Cleanup obbligatorio per dati creati.
- Checklist PR corta e uguale per tutti.

## 7) Demo suggerita (3 min)

- Mostrare la differenza pratica: scenario manuale vs esecuzione automatica dello stesso controllo.
- Eseguire un profilo completo e mostrare output pass/fail.
- Far vedere un esempio di prompt template compilato da una persona non tecnica e il test risultante.

## 8) Piano adozione team (2 min)

- Settimana 1: formazione breve su template prompt + checklist.
- Settimana 2-3: coppie domain expert + reviewer tecnico su primi scenari.
- Settimana 4+: raccolta libreria scenari riusabili e metriche (tempo scrittura, tasso failure, copertura).

## 9) Chiusura (30 sec)

- Non stiamo solo "automatizzando test": stiamo creando una capacita di team.
- Obiettivo: aumentare qualita e velocita, rendendo la scrittura test accessibile anche a profili non developer.
