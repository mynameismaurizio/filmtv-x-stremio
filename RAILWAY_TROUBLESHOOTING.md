# 🔧 Railway Troubleshooting - "Not Found" Error

Se vedi "Not Found - The train has not arrived at the station", segui questi passaggi:

## ✅ Step 1: Verifica che il servizio sia esposto pubblicamente

1. Vai sul dashboard Railway: https://railway.app/dashboard
2. Clicca sul tuo progetto `filmtv-x-stremio`
3. Clicca sul servizio (dovrebbe essere chiamato come il progetto)
4. Vai su **Settings** (icona ingranaggio)
5. Scrolla a **"Networking"**
6. **IMPORTANTE:** Verifica che ci sia un dominio generato
   - Dovresti vedere un URL tipo: `https://filmtv-x-stremio-production.up.railway.app`
   - Se NON c'è, clicca **"Generate Domain"**
   - Questo è CRUCIALE - senza dominio pubblico, Railway non può esporre il servizio!

## ✅ Step 2: Verifica che il servizio sia attivo

1. Nel dashboard Railway, vai sul tuo servizio
2. Verifica che lo stato sia **"Active"** (non "Stopped" o "Building")
3. Se è "Stopped", clicca **"Deploy"** o **"Restart"**

## ✅ Step 3: Controlla i log

1. Nel dashboard Railway, vai su **"Logs"**
2. Cerca errori o messaggi di avvio
3. Dovresti vedere:
   ```
   FilmTV.it addon running on http://0.0.0.0:8080
   ```
4. Se vedi errori, copiali e condividili

## ✅ Step 4: Verifica la porta

Railway imposta automaticamente `PORT`. Verifica nei log che l'app usi la porta corretta:
- Nei log dovresti vedere: `running on http://0.0.0.0:8080` (o altra porta)
- Railway assegna la porta automaticamente

## ✅ Step 5: Testa l'endpoint di health

Dopo aver verificato che il dominio esiste, testa:
```
https://TUO-DOMINIO.railway.app/health
```

Se `/health` funziona ma `/manifest.json` no, il problema è nel codice.
Se anche `/health` non funziona, il problema è nella configurazione di Railway.

## ✅ Step 6: Verifica il Dockerfile

Il Dockerfile deve:
- ✅ Esporre una porta (anche se Railway la ignora, è buona pratica)
- ✅ Usare `CMD ["npm", "start"]` per avviare l'app
- ✅ Non avere errori di sintassi

## ✅ Step 7: Rebuild completo

Se nulla funziona:
1. Nel dashboard Railway, vai su **Settings**
2. Scrolla a **"Danger Zone"**
3. Clicca **"Redeploy"** o **"Restart"**
4. Aspetta che il build completi (2-3 minuti)

## 🔍 Problemi Comuni

### Problema: "Not Found" anche se l'app si avvia
**Causa:** Il servizio non è esposto pubblicamente
**Soluzione:** Genera un dominio in Settings → Networking

### Problema: L'app si avvia ma poi crasha
**Causa:** Errore nel codice
**Soluzione:** Controlla i log per errori

### Problema: Porta sbagliata
**Causa:** L'app non usa `process.env.PORT`
**Soluzione:** Verifica che il codice usi `process.env.PORT || 7860`

### Problema: Servizio non attivo
**Causa:** Il servizio si è fermato
**Soluzione:** Riavvia il servizio dal dashboard

## 📝 Checklist Finale

- [ ] Dominio pubblico generato in Settings → Networking
- [ ] Servizio in stato "Active"
- [ ] Log mostrano che l'app è in ascolto su 0.0.0.0
- [ ] Nessun errore nei log
- [ ] `/health` endpoint risponde
- [ ] `/manifest.json` endpoint risponde

## 🆘 Se Nulla Funziona

1. **Crea un nuovo servizio:**
   - Nel progetto Railway, clicca **"New"** → **"Service"**
   - Seleziona **"GitHub Repo"**
   - Scegli il repository
   - Railway creerà un nuovo servizio (a volte risolve problemi di configurazione)

2. **Contatta il supporto Railway:**
   - Vai su https://railway.app/discord
   - Chiedi aiuto nel canale #help

3. **Prova un altro servizio:**
   - Render.com (si spegne dopo 15 minuti)
   - Fly.io (sempre attivo, gratuito)

