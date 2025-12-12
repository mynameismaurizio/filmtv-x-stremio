# 🚂 Deploy su Railway.app (Sempre Attivo!)

Railway.app è perfetto per questo progetto perché:
- ✅ **Sempre attivo** (anche nel piano gratuito!)
- ✅ Deploy automatico da GitHub
- ✅ Log chiari e in tempo reale
- ✅ Molto facile da configurare
- ✅ Supporto Docker nativo
- ✅ $5 crediti gratis/mese (più che sufficiente)

## 📋 Step 1: Preparare il codice

Assicurati che questi file siano nel repository GitHub:
- ✅ `index.js`
- ✅ `scraper-safe.js`
- ✅ `package.json`
- ✅ `package-lock.json`
- ✅ `Dockerfile` (già configurato)

## 📋 Step 2: Creare account Railway

1. Vai su https://railway.app
2. Clicca **"Start a New Project"**
3. Seleziona **"Login with GitHub"**
4. Autorizza Railway ad accedere ai tuoi repository

## 📋 Step 3: Creare nuovo progetto

1. Nel dashboard Railway, clicca **"New Project"**
2. Seleziona **"Deploy from GitHub repo"**
3. Seleziona il repository: `mynameismaurizio/filmtv-x-stremio`
4. Railway inizierà automaticamente il deploy!

## 📋 Step 4: Configurare il Service

Railway rileva automaticamente il Dockerfile e configura tutto. Ma puoi verificare:

1. Clicca sul service appena creato
2. Vai su **Settings**
3. Verifica:
   - **Build Command**: (lascia vuoto, usa Dockerfile)
   - **Start Command**: (lascia vuoto, usa Dockerfile)
   - **Healthcheck Path**: `/manifest.json` (opzionale)

### Environment Variables

**NON serve impostare `TMDB_API_KEY`** - l'utente lo inserisce in Stremio!

## 📋 Step 5: Ottenere l'URL

1. Nel dashboard Railway, vai su **Settings**
2. Scrolla a **"Domains"**
3. Railway ti ha già assegnato un URL tipo:
   ```
   https://filmtv-x-stremio-production.up.railway.app
   ```

Oppure puoi creare un dominio personalizzato:
- Clicca **"Generate Domain"** per un URL più corto
- O usa un dominio custom (se ne hai uno)

Il manifest sarà:
```
https://TUO-URL.railway.app/manifest.json
```

## 📋 Step 6: Installare in Stremio

1. Apri **Stremio**
2. Vai su **Addons** → **Community Addons**
3. Incolla l'URL del manifest
4. Clicca **"Install"**
5. Inserisci la tua chiave TMDB quando richiesto

## 🔄 Deploy Automatico

Railway fa deploy automatico ogni volta che pushi su GitHub sul branch `main`!

## 📊 Monitoraggio

### Logs
- Clicca su **"View Logs"** per vedere i log in tempo reale
- Molto più chiari di Hugging Face!

### Metrics
- Vedi CPU, memoria, e traffico in tempo reale
- Utile per monitorare l'uso delle risorse

### Costi
- Vai su **"Usage"** per vedere i crediti usati
- $5 gratis/mese è più che sufficiente per questo tipo di app

## ⚙️ Configurazioni Avanzate

### Health Check

Railway può verificare che l'app funzioni:
1. Vai su **Settings** → **Healthcheck**
2. **Path**: `/manifest.json`
3. **Interval**: 30 secondi

### Auto-Deploy

- ✅ Attivo di default
- Railway fa rebuild automatico ad ogni push su `main`
- Puoi disabilitarlo in **Settings** → **Source**

### Region

Railway sceglie automaticamente la regione migliore, ma puoi cambiarla:
1. **Settings** → **Region**
2. Scegli la più vicina (es: `Europe`)

## 🔍 Troubleshooting

### Build fallisce
- Controlla i **Logs** in Railway (molto chiari!)
- Verifica che il Dockerfile sia corretto
- Assicurati che `package.json` sia presente

### App non risponde
- Controlla i **Logs** per errori
- Verifica che la porta sia corretta (Railway usa `PORT` env var)
- Il codice usa già `process.env.PORT || 7860`, quindi funziona!

### Costi troppo alti
- Monitora l'uso in **Usage**
- Se superi $5/mese, considera di ottimizzare il rate limiting
- Il rate limiting che abbiamo implementato dovrebbe mantenere i costi bassi

## 💰 Costi

**Piano Gratuito:**
- $5 crediti gratis/mese
- Sempre attivo (non si spegne!)
- Più che sufficiente per questo progetto

**Stima costi:**
- App Node.js: ~$0.000463/GB-ora
- Con 512MB RAM: ~$0.17/mese
- Con 1GB RAM: ~$0.33/mese
- **Rimani ben dentro i $5 gratis!**

## 🎯 Vantaggi rispetto a Hugging Face

| Feature | Hugging Face | Railway.app |
|---------|--------------|-------------|
| Sempre attivo | ✅ | ✅ |
| Log chiari | ❌ | ✅ |
| Feedback errori | ❌ | ✅ |
| Risorse | Limitato | Più generoso |
| Monitoraggio | ❌ | ✅ |
| Costi | Gratuito | $5 gratis/mese |
| Docker | ✅ | ✅ |
| Deploy auto | ✅ | ✅ |

## 📝 Note Importanti

1. **Sempre attivo**: Railway mantiene l'app sempre attiva, anche nel piano gratuito
2. **Cache**: La cache in-memory persiste (non si resetta ad ogni riavvio)
3. **Rate Limiting**: Il rate limiting che abbiamo implementato è perfetto per Railway
4. **Porta**: Railway imposta automaticamente `PORT`, il codice lo gestisce già

## 🔗 Link Utili

- Dashboard Railway: https://railway.app/dashboard
- Documentazione: https://docs.railway.app
- Status: https://status.railway.app

## 🚀 Quick Start

1. Vai su https://railway.app
2. Login con GitHub
3. **New Project** → **Deploy from GitHub repo**
4. Seleziona `mynameismaurizio/filmtv-x-stremio`
5. Aspetta il deploy (2-3 minuti)
6. Copia l'URL e usalo in Stremio!

**È davvero così semplice!** 🎉

