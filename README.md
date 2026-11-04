# Kostra 3D – učení kostí česky

Webová aplikace s 3D modelem lidské kostry (203 samostatných kostí). Celé rozhraní i názvy kostí jsou česky.
Prohlížeč (otáčení, skrývání, barevné režimy, rozložení, vyhledávání), kartičky (Leitnerův systém) a testy
(Poznej kost, Najdi kost, opakování chyb). Bez backendu, postup se ukládá do `localStorage`.

Po nasazení běží na: **https://hynekmastalir.github.io/kostra-3d/**

## Nasazení na GitHub Pages

1. V repozitáři otevři Settings, Pages, a u „Source“ vyber **GitHub Actions** (jednorázově).
2. Pushni do větve `main`. Workflow `.github/workflows/deploy.yml` aplikaci sestaví a nasadí.
3. Jiný název repozitáře: změň výchozí `base` ve `vite.config.js` nebo sestav s `BASE_PATH=/muj-repozitar/ npm run build`.

## Vývoj

```
npm install
npm run dev        # vývojový server
npm run build      # produkční build do dist
```

## 3D model, licence a atribuce

Model pochází z **BodyParts3D** (Anatomography), © The Database Center for Life Science,
licence **Creative Commons Attribution-Share Alike 2.1 Japan** (CC BY-SA 2.1 JP).
Použité soubory (verze 3.0, STL) jsou z GitHub zrcadla Kevina Moermana
(<https://github.com/Kevin-Mattheus-Moerman/BodyParts3D>), originál: <https://lifesciencedb.jp/bp3d/>.

> BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan.

Citace: Mitsuhashi N. et al., *BodyParts3D: 3D structure database for anatomical concepts*, Nucleic Acids Res. 2009;37:D782-5.

Změny: vybráno 203 kostí, každá zjednodušena (decimace, 1,84 mil. → 0,47 mil. trojúhelníků), převedena na osy Y nahoru a do jednoho
souboru `public/models/kostra.glb` (8,1 MB), kde je každá kost samostatný mesh pojmenovaný FMA id. Odvozený model proto zůstává pod **CC BY-SA 2.1 JP**.

### Co v modelu chybí
- **Kostrč** (os coccygis) a **sluchové kůstky** (kladívko, kovadlinka, třmínek) v datech BodyParts3D samostatně nejsou.
- **Zuby** a **chrupavky** (žeberní) jsou v datech, ale do aplikace nejsou zařazeny.
- **Sezamské kůstky nohy** jsou v modelu jen jako jeden mesh na nohu (obsahuje 2 kůstky).
- Jazylka je zařazena do skupiny Lebka, křížová kost do Páteře.

### Přegenerování modelu
```
git clone --depth 1 https://github.com/Kevin-Mattheus-Moerman/BodyParts3D   # složka assets/BodyParts3D_data/stl
node tools/build-bones.mjs                      # bones.json (názvy, popisy) z tools/bone-sources.json
node tools/build-model.mjs <složka_stl> 0.25    # kostra.glb + barvy pro režim „rozlišený“
```

## Poznámka k terminologii

České a latinské názvy a popisy jsou v `tools/build-bones.mjs` a vznikly podle české anatomické terminologie
(Terminologia Anatomica) z paměti, bez ověření proti tištěnému zdroji. Před ostrým použitím při studiu je vhodné je zkontrolovat
(zejména názvy karpálních kostí, klínových kostí a bodů označených v popisech).
