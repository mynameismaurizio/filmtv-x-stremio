# 🚀 Deploy su Render.com (Alternativa a Hugging Face)

Render.com è molto più adatto per questo tipo di applicazione. Offre:
- ✅ Deploy automatico da GitHub
- ✅ Log chiari e dettagliati
- ✅ Più risorse disponibili
- ✅ Supporto Docker
- ✅ Gratuito con limiti ragionevoli
- ✅ Feedback chiaro su errori

## 📋 Step 1: Preparare il codice

Assicurati che questi file siano nel repository:
- ✅ `index.js`
- ✅ `scraper-safe.js`
- ✅ `package.json`
- ✅ `package-lock.json`
- ✅ `Dockerfile` (già configurato)

## 📋 Step 2: Creare account Render

1. Vai su https://render.com
2. Clicca **"Get Started for Free"**
3. Registrati con GitHub (consigliato per deploy automatico)

## 📋 Step 3: Creare nuovo Web Service

1. Nel dashboard Render, clicca **"New +"**
2. Seleziona **"Web Service"**
3. Connetti il tuo repository GitHub:
   - Se non è connesso, clicca **"Connect GitHub"**
   - Autorizza Render ad accedere ai tuoi repository
   - Seleziona `mynameismaurizio/filmtv-x-stremio`

## 📋 Step 4: Configurare il Service

Compila i campi:

- **Name**: `filmtv-x-stremio` (o quello che preferisci)
- **Region**: Scegli la più vicina (es: `Frankfurt` per l'Europa)
- **Branch**: `main`
- **Root Directory**: (lascia vuoto)
- **Runtime**: `Docker`
- **Dockerfile Path**: `Dockerfile` (o lascia vuoto se è nella root)
- **Docker Context**: (lascia vuoto)

### Environment Variables

Non serve impostare `TMDB_API_KEY` qui - l'utente lo inserisce in Stremio!

### Plan

- **Free**: Gratuito (con limiti)
  - 750 ore/mese
  - Si spegne dopo 15 minuti di inattività
  - Si riaccende automaticamente alla prima richiesta

## 📋 Step 5: Deploy

1. Clicca **"Create Web Service"**
2. Render inizierà automaticamente il build
3. Guarda i **Logs** per vedere il progresso
4. Il build richiede 3-5 minuti

## 📋 Step 6: Ottenere l'URL

Una volta deployato, Render ti darà un URL tipo:
```
https://filmtv-x-stremio.onrender.com
```

Il manifest sarà:
```
https://filmtv-x-stremio.onrender.com/manifest.json
```

## 📋 Step 7: Installare in Stremio

1. Apri **Stremio**
2. Vai su **Addons** → **Community Addons**
3. Incolla: `https://filmtv-x-stremio.onrender.com/manifest.json`
4. Clicca **"Install"**
5. Inserisci la tua chiave TMDB quando richiesto

## 🔄 Deploy Automatico

Render fa deploy automatico ogni volta che pushi su GitHub sul branch `main`!

## ⚙️ Configurazioni Avanzate

### Health Check (Opzionale)

Render può verificare che l'app funzioni:
- **Health Check Path**: `/manifest.json`

### Auto-Deploy

- ✅ **Auto-Deploy**: Attivo di default
- Render fa rebuild automatico ad ogni push su `main`

## 🔍 Troubleshooting

### Build fallisce
- Controlla i **Logs** in Render (molto più chiari di HF!)
- Verifica che il Dockerfile sia corretto
- Assicurati che `package.json` sia presente

### App si spegne
- Su piano gratuito, si spegne dopo 15 minuti di inattività
- Si riaccende automaticamente alla prima richiesta (può richiedere 30-60 secondi)
- Per evitare questo, puoi usare un servizio come UptimeRobot per pingare ogni 5 minuti

### Timeout
- Render ha timeout di 30 secondi per le richieste
- Con il rate limiting che abbiamo implementato, dovrebbe essere OK

## 💰 Costi

**Piano Gratuito:**
- 750 ore/mese (circa 31 giorni)
- Si spegne dopo 15 minuti di inattività
- Si riaccende automaticamente
- Perfetto per progetti personali

**Piano Starter ($7/mese):**
- Sempre attivo
- Nessun spegnimento
- Più risorse

## 🎯 Vantaggi rispetto a Hugging Face

| Feature | Hugging Face | Render.com |
|---------|--------------|------------|
| Deploy automatico | ✅ | ✅ |
| Log chiari | ❌ | ✅ |
| Feedback errori | ❌ | ✅ |
| Risorse | Limitato | Più generoso |
| Timeout | 30s | 30s |
| Spegnimento | No | Sì (gratuito) |
| Docker | ✅ | ✅ |

## 📝 Note Importanti

1. **Primo avvio lento**: Su piano gratuito, il primo avvio dopo spegnimento può richiedere 30-60 secondi
2. **Cache**: La cache in-memory si resetta ad ogni riavvio
3. **Rate Limiting**: Il rate limiting che abbiamo implementato è perfetto per Render

## 🔗 Link Utili

- Dashboard Render: https://dashboard.render.com
- Documentazione: https://render.com/docs
- Status: https://status.render.com

