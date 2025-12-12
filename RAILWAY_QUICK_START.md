# 🚂 Railway.app - Quick Start Guide

## ✅ Checklist Pre-Deploy

Prima di iniziare, assicurati che questi file siano nel repository GitHub:

- [x] `index.js`
- [x] `scraper-safe.js`
- [x] `package.json`
- [x] `package-lock.json`
- [x] `Dockerfile` (o `Dockerfile.railway`)

**Tutto è già pronto!** 🎉

### ⚠️ Nota sul Dockerfile

Railway può usare il `Dockerfile` esistente (che clona da GitHub), ma è più efficiente usare `Dockerfile.railway` che usa i file già presenti.

**Opzione 1:** Usa `Dockerfile` così com'è (funziona)
**Opzione 2:** Rinomina `Dockerfile.railway` in `Dockerfile` prima del deploy (più efficiente)

## 🚀 Step 1: Crea account Railway

1. Vai su **https://railway.app**
2. Clicca **"Start a New Project"** o **"Login"**
3. Seleziona **"Login with GitHub"**
4. Autorizza Railway ad accedere ai tuoi repository GitHub
5. Completa la registrazione

## 🚀 Step 2: Crea nuovo progetto

1. Nel dashboard Railway, clicca il pulsante **"New Project"** (in alto a destra)
2. Seleziona **"Deploy from GitHub repo"**
3. Se non vedi il repository, clicca **"Configure GitHub App"** e autorizza
4. Seleziona il repository: **`mynameismaurizio/filmtv-x-stremio`**
5. Railway inizierà automaticamente il deploy!

## 🚀 Step 3: Aspetta il deploy

Railway:
1. Clonerà il repository
2. Costruirà il Docker container
3. Installerà le dipendenze
4. Avvierà l'app

**Tempo stimato: 2-4 minuti**

Puoi vedere il progresso nei **Logs** in tempo reale!

## 🚀 Step 4: Ottieni l'URL

1. Nel dashboard Railway, clicca sul tuo progetto
2. Vai su **Settings** (icona ingranaggio)
3. Scrolla a **"Domains"**
4. Railway ha già generato un URL tipo:
   ```
   https://filmtv-x-stremio-production.up.railway.app
   ```

### Opzionale: Genera un dominio più corto

1. In **Settings** → **Domains**
2. Clicca **"Generate Domain"**
3. Scegli un nome (es: `filmtv-stremio`)
4. Ottieni un URL più corto: `https://filmtv-stremio.railway.app`

## 🚀 Step 5: Testa l'app

Apri nel browser:
```
https://TUO-URL.railway.app/manifest.json
```

Dovresti vedere il JSON del manifest con tutti i cataloghi!

## 🚀 Step 6: Installa in Stremio

1. Apri **Stremio**
2. Vai su **Addons** (icona puzzle in alto a destra)
3. Clicca **"Community Addons"** (in basso)
4. Incolla l'URL del manifest:
   ```
   https://TUO-URL.railway.app/manifest.json
   ```
5. Clicca **"Install"**
6. Quando richiesto, inserisci la tua **chiave TMDB API**
7. Clicca **"Save"** e poi **"Install"**

## ✅ Fatto!

L'addon è ora live su Railway e sempre attivo! 🎉

## 🔄 Deploy Automatico

Ogni volta che fai push su GitHub sul branch `main`:
- Railway rileva automaticamente i cambiamenti
- Fa rebuild e redeploy
- L'app si aggiorna automaticamente!

## 📊 Monitoraggio

### Logs
- Clicca su **"View Logs"** per vedere i log in tempo reale
- Molto più chiari di Hugging Face!

### Metrics
- Vai su **"Metrics"** per vedere:
  - CPU usage
  - Memory usage
  - Network traffic
  - Request count

### Usage (Costi)
- Vai su **"Usage"** per vedere i crediti usati
- $5 gratis/mese è più che sufficiente!

## 🔍 Troubleshooting

### Build fallisce
1. Controlla i **Logs** in Railway
2. Verifica che tutti i file siano nel repository
3. Assicurati che `package.json` sia presente

### App non risponde
1. Controlla i **Logs** per errori
2. Verifica che l'URL sia corretto
3. Testa `/manifest.json` nel browser

### Costi troppo alti
1. Monitora l'uso in **Usage**
2. Il rate limiting che abbiamo implementato dovrebbe mantenere i costi bassi
3. Stima: ~$0.17-0.33/mese

## 🎯 Prossimi Passi

1. ✅ Deploy completato
2. ✅ URL ottenuto
3. ✅ Testato nel browser
4. ✅ Installato in Stremio
5. 🎉 Goditi l'addon sempre attivo!

## 📝 Note

- **Sempre attivo**: Railway mantiene l'app sempre attiva, anche nel piano gratuito
- **Cache persistente**: La cache in-memory persiste tra le richieste
- **Rate limiting**: Il rate limiting implementato è perfetto per Railway
- **Porta**: Railway imposta automaticamente `PORT`, il codice lo gestisce già

## 🔗 Link Utili

- Dashboard: https://railway.app/dashboard
- Documentazione: https://docs.railway.app
- Status: https://status.railway.app

---

**Hai bisogno di aiuto?** Controlla i log in Railway - sono molto chiari e ti diranno esattamente cosa sta succedendo!

