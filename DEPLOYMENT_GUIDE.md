# 🚀 Guida Completa per Deploy su Hugging Face

## ⚠️ IMPORTANTE: Cosa è stato cambiato per evitare ban

1. ✅ **Rimosso file system writes** - Non scrive più su disco (solo cache in-memory)
2. ✅ **Aggiunto rate limiting** - Max 3 richieste simultanee, 500ms delay tra richieste
3. ✅ **Timeout alle richieste** - 10 secondi max per richiesta
4. ✅ **Headers HTTP migliorati** - User-Agent realistico
5. ✅ **Error handling robusto** - Gestione errori migliore

## 📋 Step 1: Preparare il codice

### File da usare:
- ✅ `scraper-safe.js` (versione sicura, senza file system)
- ✅ `index.js` (già configurato per usare scraper-safe.js)
- ✅ `package.json` (rimosso express, non necessario)
- ✅ `Dockerfile` (già configurato)
- ✅ `README_HF.md` (con frontmatter corretto)

### File da NON usare:
- ❌ `scraper.js` (vecchia versione con file system writes)

## 📋 Step 2: Push su GitHub

1. Apri **GitHub Desktop**
2. Assicurati che questi file siano presenti:
   - `scraper-safe.js` (NUOVO)
   - `index.js` (modificato)
   - `package.json` (modificato)
   - `Dockerfile`
   - `README_HF.md`
3. Commit con messaggio: "Safe version: removed file system writes, added rate limiting"
4. Push su GitHub

## 📋 Step 3: Creare nuovo Space su Hugging Face

1. Vai su https://huggingface.co/new-space
2. Compila:
   - **Space name**: `filmtv-x-stremio` (o un nome diverso se quello è bannato)
   - **SDK**: **Docker**
   - **Visibility**: **Public** (obbligatorio per Stremio)
3. Clicca **"Create Space"**

## 📋 Step 4: Configurare lo Space

### ⭐ METODO 1: Deploy Automatico con GitHub Actions (COME RENDER.COM)

Questo metodo fa il deploy automatico ogni volta che pushi su GitHub, esattamente come Render.com!

#### 4.1: Configurare GitHub Secrets

1. Vai sul tuo repository GitHub: `https://github.com/mynameismaurizio/filmtv-x-stremio`
2. Vai su **Settings** → **Secrets and variables** → **Actions**
3. Clicca **"New repository secret"** e aggiungi questi 3 secrets:

   **Secret 1:**
   - Name: `HF_TOKEN`
   - Value: Il tuo token Hugging Face (ottienilo da https://huggingface.co/settings/tokens)
     - Clicca "New token"
     - Nome: "GitHub Actions Deploy"
     - Tipo: "Write" (per poter fare push)
     - Copia il token

   **Secret 2:**
   - Name: `HF_USERNAME`
   - Value: Il tuo username Hugging Face (es: `cacaspruz`)

   **Secret 3:**
   - Name: `HF_SPACE`
   - Value: Il nome del tuo Space (es: `filmtv-x-stremio`)

#### 4.2: Push del workflow

Il file `.github/workflows/deploy-to-hf.yml` è già creato. Basta fare push:

1. Apri **GitHub Desktop**
2. Dovresti vedere il file `.github/workflows/deploy-to-hf.yml` nelle modifiche
3. Commit: "Add GitHub Actions for auto-deploy to HF"
4. Push su GitHub

#### 4.3: Primo deploy manuale

Per la prima volta, devi creare lo Space e caricare i file base:

1. Crea lo Space su https://huggingface.co/new-space
2. Nome: `filmtv-x-stremio` (o quello che hai messo in `HF_SPACE`)
3. SDK: **Docker**
4. Visibility: **Public**

5. Nello Space, vai su **Files and versions**
6. Carica questi 2 file:
   - `Dockerfile`
   - `README_HF.md`

7. Clicca **"Commit changes"**

**Da ora in poi, ogni push su GitHub triggererà automaticamente il deploy!** 🚀

### ⭐ METODO 2: Dockerfile che clona da GitHub (Manuale)

Se preferisci non usare GitHub Actions, puoi usare questo metodo:

1. Nello Space, vai su **Files and versions**
2. Clicca **"Add file"** → **"Upload files"**
3. Carica SOLO questi 2 file:
   - `Dockerfile` (clonerà automaticamente da GitHub)
   - `README_HF.md` (per la pagina dello Space)
4. Clicca **"Commit changes"**

**Il Dockerfile clonerà automaticamente tutto il codice da GitHub durante il build!**

**Nota:** Con questo metodo devi fare "Restart Space" manualmente ogni volta che pushi su GitHub.

### Opzione Alternativa: Upload manuale di tutti i file

Se preferisci non usare GitHub:

1. Nello Space, vai su **Files and versions**
2. Clicca **"Add file"** → **"Upload files"**
3. Carica tutti questi file:
   - `Dockerfile.manual` (rinomina in `Dockerfile` dopo l'upload)
   - `README_HF.md`
   - `index.js`
   - `scraper-safe.js`
   - `package.json`
   - `package-lock.json`

**Nota:** Dopo l'upload, rinomina `Dockerfile.manual` in `Dockerfile` (questo Dockerfile NON clona da GitHub, usa i file caricati).

## 📋 Step 5: Deploy

### Se hai configurato GitHub Actions (METODO 1):
- ✅ Il deploy parte **automaticamente** quando pushi su GitHub
- Vai su **Actions** tab nel repository GitHub per vedere il workflow
- Vai su **Logs** nello Space Hugging Face per vedere il build

### Se hai usato il Dockerfile manuale (METODO 2):
1. Vai su **Settings** nello Space
2. Scrolla a **"Restart this Space"**
3. Clicca **"Restart this Space"**
4. Vai su **Logs** per vedere il build

## 📋 Step 6: Verificare il Deploy

1. Aspetta 3-5 minuti per il build
2. Vai su **Logs** e cerca:
   ```
   FilmTV.it addon running on http://0.0.0.0:7860
   ```
3. Vai su **App** tab
4. Testa il manifest:
   ```
   https://YOUR_USERNAME-filmtv-x-stremio.hf.space/manifest.json
   ```
   Dovresti vedere JSON con i cataloghi

## 📋 Step 7: Installare in Stremio

1. Apri **Stremio**
2. Vai su **Addons** (icona puzzle in alto a destra)
3. Clicca **"Community Addons"**
4. Incolla:
   ```
   https://YOUR_USERNAME-filmtv-x-stremio.hf.space/manifest.json
   ```
5. Clicca **"Install"**
6. **IMPORTANTE:** Quando installi l'addon, Stremio ti chiederà di configurare:
   - **Chiave API TMDB**: Inserisci la tua chiave TMDB (ottienila da https://www.themoviedb.org/settings/api)
   - **Cataloghi Personalizzati** (opzionale): Puoi aggiungere cataloghi personalizzati se vuoi
7. Clicca **"Save"** e poi **"Install"**

**Nota:** La chiave TMDB viene inserita dall'utente durante la configurazione in Stremio, non serve impostarla come secret su Hugging Face!

## 🔍 Troubleshooting

### Build fallisce
- Controlla i **Logs** per errori
- Verifica che `scraper-safe.js` sia presente
- Verifica che `package.json` non abbia `express` nelle dipendenze

### Addon non funziona
- Verifica di aver inserito la chiave TMDB durante la configurazione in Stremio
- Controlla i Logs per errori API
- Testa il manifest URL nel browser

### Nessun film mostrato
- Controlla i Logs per errori di scraping
- Verifica che la chiave TMDB sia valida
- Aspetta qualche minuto (il primo fetch può essere lento)

### Space bannato di nuovo
- Verifica che stai usando `scraper-safe.js` (non `scraper.js`)
- Controlla i Logs per troppe richieste
- Assicurati che il rate limiting funzioni (500ms delay)

## 📝 Checklist Finale

### Se usi GitHub Actions (METODO 1):
- [ ] Codice pushato su GitHub
- [ ] GitHub Secrets configurati (HF_TOKEN, HF_USERNAME, HF_SPACE)
- [ ] Workflow `.github/workflows/deploy-to-hf.yml` pushato
- [ ] Space creato su Hugging Face
- [ ] Dockerfile e README_HF.md caricati nello Space (prima volta)
- [ ] Push su GitHub triggera deploy automatico
- [ ] Build completato con successo
- [ ] Manifest URL accessibile nel browser
- [ ] Addon installato in Stremio
- [ ] Chiave TMDB inserita durante la configurazione
- [ ] Film visibili in Stremio

### Se usi Dockerfile manuale (METODO 2):
- [ ] Codice pushato su GitHub
- [ ] Space creato su Hugging Face
- [ ] Dockerfile e README_HF.md caricati nello Space
- [ ] Build completato con successo
- [ ] Manifest URL accessibile nel browser
- [ ] Addon installato in Stremio
- [ ] Chiave TMDB inserita durante la configurazione
- [ ] Film visibili in Stremio

## 🎯 URL Finale

Il tuo addon sarà disponibile a:
```
https://YOUR_USERNAME-filmtv-x-stremio.hf.space/manifest.json
```

Sostituisci `YOUR_USERNAME` con il tuo username Hugging Face.

