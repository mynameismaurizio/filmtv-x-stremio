# Guida ai Cataloghi Personalizzati

## Cataloghi Predefiniti

L'addon include già questi cataloghi popolari:
- **Migliori del 2025** - I migliori film del 2025
- **Migliori del 2024** - I migliori film del 2024
- **Migliori del 2023** - I migliori film del 2023
- **Migliori del 2022** - I migliori film del 2022
- **Migliori del 2021** - I migliori film del 2021
- **Migliori del 2020** - I migliori film del 2020

## Creare Cataloghi Personalizzati

Puoi creare cataloghi personalizzati usando i filtri di FilmTV.it nelle impostazioni dell'addon.

### Formato

Nel campo "Cataloghi Personalizzati", inserisci una o più righe in questo formato:

```
Nome del Catalogo|filtro1|filtro2;
Altro Catalogo|filtro1;
```

Ogni catalogo è separato da `;` (punto e virgola)

### Esempi di Filtri Disponibili

#### Filtri per Anno
- `anno-2019` - Film del 2019
- `anno-2018` - Film del 2018
- `anni-2010` - Film del decennio 2010-2019
- `anni-2000` - Film del decennio 2000-2009

#### Filtri per Genere
- `genere-azione` - Film d'azione
- `genere-commedia` - Commedie
- `genere-drammatico` - Film drammatici
- `genere-horror` - Film horror
- `genere-fantascienza` - Film di fantascienza
- `genere-thriller` - Thriller
- `genere-animazione` - Film d'animazione
- `genere-documentario` - Documentari

#### Filtri per Paese
- `paese-usa` - Film americani
- `paese-italia` - Film italiani
- `paese-francia` - Film francesi
- `paese-uk` - Film britannici
- `paese-giappone` - Film giapponesi

#### Altri Filtri
- `regista-[nome]` - Film di un regista specifico
- `attore-[nome]` - Film con un attore specifico

### Esempi Pratici

#### Esempio 1: Film d'azione del 2019
```
Azione 2019|anno-2019|genere-azione
```

#### Esempio 2: Commedie italiane
```
Commedie Italiane|genere-commedia|paese-italia
```

#### Esempio 3: Horror anni 2010
```
Horror Moderni|anni-2010|genere-horror
```

#### Esempio 4: Multipli cataloghi
```
Azione 2019|anno-2019|genere-azione;
Thriller 2020|anno-2020|genere-thriller;
Fantascienza Americana|genere-fantascienza|paese-usa
```

## Come Trovare i Filtri Corretti

1. Vai su https://www.filmtv.it/film/migliori/
2. Usa i menu a tendina per selezionare i filtri desiderati
3. Guarda l'URL risultante, ad esempio:
   - `https://www.filmtv.it/film/migliori/anno-2019/genere-azione/`
   - I filtri sono: `anno-2019` e `genere-azione`
4. Copia i filtri dall'URL (la parte dopo `/migliori/`)

## Note Importanti

- I filtri devono corrispondere esattamente all'URL di FilmTV.it
- Usa il trattino `-` invece degli spazi (es: `genere-fantascienza`)
- Non tutti i film potrebbero avere un match su TMDB
- I cataloghi personalizzati vengono salvati nella cache per 1 ora
- Puoi avere fino a 10 cataloghi personalizzati attivi contemporaneamente

## Risoluzione Problemi

**Il catalogo personalizzato non mostra film:**
- Verifica che i filtri siano scritti correttamente
- Prova a visitare l'URL su FilmTV.it per vedere se la pagina esiste
- Alcuni filtri potrebbero non avere film nella lista "migliori"

**Troppi cataloghi nella lista:**
- Rimuovi i cataloghi personalizzati che non usi più dalle impostazioni
- I cataloghi predefiniti (2020-2025) sono sempre visibili

## Supporto

Per segnalare problemi o richiedere nuove funzionalità:
- GitHub: [link al repository]
- Verifica sempre che la chiave TMDB API sia configurata correttamente
