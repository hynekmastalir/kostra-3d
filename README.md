# Kostra 3D – učení kostí česky

Webová aplikace s 3D modelem lidské kostry (203 samostatných kostí). Celé rozhraní i názvy kostí jsou česky.
Prohlížeč (otáčení, skrývání, barevné režimy, rozložení, vyhledávání), kartičky (Leitnerův systém) a testy
(Poznej kost, Najdi kost, opakování chyb). Bez backendu, postup se ukládá do `localStorage`.

Po nasazení běží na: **https://hynekmastalir.github.io/kostra-3d/**

## Nasazení na GitHub Pages

1. V repozitáři otevři Settings, Pages, a u „Source“ vyber **GitHub Actions** (jednorázově).
2. Pushni do větve `main`. Workflow `.github/workflows/deploy.yml` aplikaci sestaví a nasadí.
3. Jiný název repozitáře: změň výchozí `base` ve `vite.config.js` nebo sestav s `BASE_PATH=/muj-repozitar/ npm run build`.

## Tance

Záložka **Tance** rozpohybuje kostru: zamávání, skok, backflip a šafl. Model se skládá z pevných kostí, proto jsou kosti v `src/dance.js` rozdělené do segmentů
(pánev, trup, hlava, paže a nohy po třech článcích) a otáčejí se kolem kloubů, které se spočítají z tvaru kostí. Pohyb je dopředná kinematika s vlastními choreografiemi,
chodidla se drží země a při skoku a saltu se výška pánve řídí obloukem. Rychlost jde měnit posuvníkem. Tlačítko **Rozsypat** uvolní kosti jednu po druhé: každá je tuhé těleso s gravitací, odrazem a třením (viz `scatter()` v `src/dance.js`), kosti spadnou na zem a zůstanou ležet v hromadě. **Složit** je přivolá zpátky přesně na původní místa. Každý tanec je delší sestava z navazujících frází (zamávání má 4, backflip 6, breaking 6 a trvá téměř 19 sekund), které se plynule prolínají. Choreografie jsou v `src/choreo.js`. Kostra se opírá o zem nejnižším bodem celého těla, takže umí 6-step na rukou, stojku na rukou, windmill na zádech i headspin na hlavě, a otáčí se kolem zvoleného bodu (střed, chodidlo, záda). Aktuální fáze se zobrazuje nad scénou. Základní pohyby jsou zamávání, skok, backflip a šafl. Street dance styly jsou **hip-hop** (bounce a groove), **popping** (prudké „hity“ a robot), **locking** (ukazování, zámky, pády na kolena), **breaking** (toprock, Indian step) a **krump** (dupání, údery rukou, zášklby hrudníku). U každého stylu se po výběru zobrazí krátký popis původu a znaků. Další tanec přidáš do objektu `DANCES` (funkce `pose(t)` vrací úhly kloubů ve stupních).

### Hudba a Orange Justice

Ke každému tanci hraje vlastní originální skladba (`src/music.js`), kterou prohlížeč vytvoří přímo ze syntezátoru (WebAudio): hip-hop jako boom-bap, popping jako elektro-funk, locking jako funk, breaking jako breakbeat, krump jako temný trap, šafl jako house a další. Nejde o původní nahrávky známých písní (jsou chráněné autorským právem), ale o vlastní smyčky se stejným tempem a výrazem. Tanec se řídí tempem hudby (choreografie jsou psané v dobách, ne v sekundách), takže pohyby padnou na doby. Hudbu lze vypnout a ztlumit v panelu Tance. **Orange Justice** je moje stylizace populárního tanečního emote ze hry Fortnite (128 BPM). Každý styl má vlastní barvu scény a popis „Poznáš ho podle“.

## Instalace do telefonu (PWA)

Aplikace se dá nainstalovat jako běžná a po první návštěvě běží i bez internetu (model kostry se uloží do telefonu).

- **Android (Chrome):** otevři stránku a klepni na tlačítko **Instalovat** v záhlaví, nebo v menu prohlížeče na „Nainstalovat aplikaci“ či „Přidat na plochu“.
- **iPhone (Safari):** klepni na **Sdílet** a vyber **Přidat na plochu**.
- **Počítač (Chrome, Edge):** ikona instalace v adresním řádku.

Nová verze se stáhne sama při dalším spuštění s připojením. Postup uložení do telefonu je řešen service workerem (`vite-plugin-pwa`, nastavení ve `vite.config.js`).

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

## Zábava v záložce Tance

Vedle tanců jsou v záložce Tance další části:

- **Bitva:** dva kostlivci vedle sebe, každý jiný tanec, po 8 dobách se střídají. Po osmi kolech lze hlasovat, výhry se ukládají v prohlížeči.
- **Rytmus:** noty padají v rytmu hudby (dráhy kopák, snare, ozdoba; klávesy A, S, D nebo klepnutí), počítá se skóre, combo a hodnocení, rekordy se ukládají.
- **Vlastní:** skládání choreografie z kroků hotových tanců na vybranou hudbu, ukládání sestav.
- **Fyzika:** tažení končetin, hlavy a trupu, klepnutím šťouchnutí, zvednutí za pánev a pád (z velké výšky se kostra rozsype).
- **Studio:** 21 převleků (klobouky a čepice, koruna, svatozář, králičí uši, brýle, sluchátka, afro, motýlek, šála, řetěz, batoh, plášť, křídla) a 10 scén (disko, ulice, noc, pláž, vesmír, pódium, zima, hrad, moře) a nahrávání videa (webm nebo mp4 podle prohlížeče) ke stažení nebo sdílení.
