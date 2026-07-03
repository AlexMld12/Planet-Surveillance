# Planet Surveillance

Aplicație web care afișează un glob 3D interactiv pe care utilizatorul descoperă camere live din întreaga lume. Prin selectarea unei regiuni de pe glob, aplicația identifică zona geografică și afișează camerele disponibile din apropiere, folosind rețeaua Windy.

Aplicația rulează integral în browser (nu necesită instalare de către utilizator) și folosește o funcție serverless pentru a media cererile către serviciul de camere, astfel încât cheia de acces să nu fie expusă în cod.

Aplicația live: https://planet-surveillance.vercel.app/

Cod sursă (GitHub): https://github.com/AlexMld12/Planet-Surveillance

Aplicația permite:

- navigarea liberă pe un glob 3D (rotire, zoom, înclinare)
- afișarea granițelor țărilor și, la apropiere, a granițelor administrative interne
- afișarea numelor de țări și orașe în funcție de nivelul de zoom
- căutarea unei locații și deplasarea automată a camerei către ea
- selectarea unei regiuni prin click și afișarea a până la patru camere live
- vizualizarea camerelor în ferestre care pot fi mutate, redimensionate și extinse pe tot ecranul
- adaptarea automată a interfeței și a performanței pentru dispozitive mobile

## Stack

| Zona | Tehnologii |
| --- | --- |
| Randare 3D | CesiumJS (WebGL) |
| Limbaj | TypeScript (strict mode) |
| Build / dev server | Vite |
| Analiză geospațială | Algoritm propriu (ray-casting point-in-polygon, haversine) |
| Date geografice | GeoJSON, Natural Earth |
| Sursă camere | Windy Webcams API v3 |
| Geocoding | Cesium ion IonGeocoderService |
| Backend | Funcție serverless (Vercel) |
| Găzduire | Vercel |

## Structura

```text
planet-surveillance/
  api/
    webcams.ts              # functia serverless (proxy catre Windy)
  server/
    windy.ts                # nucleu partajat pentru dev
    devApi.ts               # middleware Vite pentru /api/webcams in dev
  scripts/
    build-state-polygons.mjs # tool one-time pentru simplificare poligoane
  public/
    data/                   # GeoJSON (granite tari, judete, orase)
    textures/               # texturi (nori)
  src/
    globe/                  # viewer Cesium, granite, etichete, nori, click, geo
    ui/                     # popup-uri camere, modal info, search bar, preloader
    state/                  # store partajat cameraSet
    api/                    # client fetch catre /api/webcams
    types/                  # tipuri raspuns Windy
    device.ts               # detectie mobil (calitate adaptiva)
    main.ts                 # punctul de intrare
    style.css               # stiluri globale
  index.html
  package.json
  tsconfig.json             # TypeScript pentru client
  tsconfig.node.json        # TypeScript pentru server/api/scripts
  vite.config.ts
  .env.example
```

## Repository

Codul sursă complet este disponibil pe GitHub:

https://github.com/AlexMld12/Planet-Surveillance

## Cerințe

- Node.js (versiunea 20 sau mai nouă)
- npm
- o cheie de acces pentru Windy Webcams API (gratuită, de la https://api.windy.com/keys)
- un token Cesium ion (gratuit, de la https://ion.cesium.com/tokens)

## Instalare și lansare (dezvoltare)

Clonarea repository-ului și instalarea dependențelor:

```bash
git clone https://github.com/AlexMld12/Planet-Surveillance.git
cd Planet-Surveillance
npm install
```

Crearea fișierului de mediu pornind de la exemplu:

```bash
copy .env.example .env
```

(pe Linux/macOS: `cp .env.example .env`)

În fișierul `.env` se completează cele două chei:

```env
WINDY_API_KEY=cheia_ta_windy
VITE_CESIUM_ION_TOKEN=token_ul_tau_cesium_ion
```

Pornirea serverului de dezvoltare:

```bash
npm run dev
```

Aplicația va fi disponibilă la adresa afișată în terminal (implicit http://localhost:5173). Vite afișează și un URL de rețea (`http://192.168.x.x:5173`) pentru testare pe telefon (același WiFi).

## Compilare (build de producție)

Pentru generarea versiunii optimizate, gata de publicare:

```bash
npm run build
```

Fișierele rezultate sunt scrise în directorul `dist/`. Pentru previzualizarea locală a build-ului:

```bash
npm run preview
```

Verificare tipuri (client + server) fără build:

```bash
npm run typecheck
```

## Despre cheile de acces și funcția serverless

Aplicația folosește două chei cu roluri diferite:

- **`WINDY_API_KEY`** — server-side, fără prefix `VITE_`. Nu este inclusă în codul livrat către browser. Comunicarea cu API-ul Windy se face prin funcția serverless din `api/webcams.ts`, care rulează pe server, adaugă cheia din variabila de mediu și mediază cererile.
- **`VITE_CESIUM_ION_TOKEN`** — client-side, cu prefix `VITE_`. Este necesar în browser pentru terrain 3D și imagery satelitară de la Cesium ion. Se recomandă restricționarea token-ului la domeniul aplicației, din setările Cesium ion.

Configurare:
- **local**: în fișierul `.env`;
- **în producție (Vercel)**: ca variabile de mediu ale proiectului, în setările platformei (Settings → Environment Variables).

Fără `WINDY_API_KEY`, globul și navigarea funcționează, dar căutarea camerelor nu returnează rezultate. Fără `VITE_CESIUM_ION_TOKEN`, terrain-ul și imageria satelitară nu se încarcă.

## Publicare

Aplicația este configurată pentru publicare pe Vercel. La conectarea repository-ului, Vercel detectează automat proiectul Vite, rulează `npm run build` și găzduiește atât fișierele statice, cât și funcția serverless din directorul `api/`. Ambele variabile de mediu (`WINDY_API_KEY` și `VITE_CESIUM_ION_TOKEN`) trebuie adăugate în setările proiectului pe Vercel.

## Note

- Datele geografice provin din setul public Natural Earth și au fost simplificate pentru a reduce volumul transferat. Poligoanele administrative interne au fost simplificate cu algoritmul Douglas-Peucker (toleranță 0.03°) printr-un script one-time (`scripts/build-state-polygons.mjs`).
- Granițele administrative interne se încarcă doar la apropierea de o regiune, pentru a păstra performanța.
- Globul se redesenează doar la mișcarea camerei (render on-demand), reducând consumul de resurse când aplicația este inactivă.
- Pe dispozitive mobile aplicația comută automat la seturi de date mai mici (`countries-110m` în loc de `50m`, orașe filtrate după populație) și dezactivează MSAA + granițele de județe.
- Adresele imaginilor returnate de Windy au o durată de viață limitată, motiv pentru care camerele sunt cerute din nou la fiecare selecție.
