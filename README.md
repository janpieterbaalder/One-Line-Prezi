<div align="center">

<!-- ═══════════════════════════════════════════════════════════ -->
<!--                  ONE LINE PREZI  ×  Y2K                    -->
<!-- ═══════════════════════════════════════════════════════════ -->

![banner](https://readme-typing-svg.demolab.com?font=Silkscreen&weight=400&size=48&duration=3500&pause=800&color=FF5EB8&center=true&vCenter=true&width=820&height=80&lines=%E2%96%93+ONE+LINE+PREZI.exe;%E2%96%93+LOADING+GOOD+MOOD...;%E2%96%93+Y2K+PRESENTATIONS+%E2%9C%A7)

```
╔══════════════════════════════════════════════════════════╗
║   ▓▓▓  ONE LINE COLOR — PRESENTATIES  ▓▓▓                ║
║   ───────────────────────────────────────                ║
║   One line art presentaties met kleur.                   ║
║   Retro neon desktop app  ×  Baalderborg Groep           ║
╚══════════════════════════════════════════════════════════╝
```

![Version](https://img.shields.io/badge/VERSION-1.5.0-FF5EB8?style=for-the-badge&labelColor=2A1458)
![Platform](https://img.shields.io/badge/PLATFORM-WIN%2032-68E3D6?style=for-the-badge&labelColor=2A1458)
![Electron](https://img.shields.io/badge/ELECTRON-40.6.1-FFF38C?style=for-the-badge&labelColor=2A1458&logoColor=2A1458)
![Style](https://img.shields.io/badge/STYLE-Y2K%20PASTEL-C9B0F7?style=for-the-badge&labelColor=2A1458)

<br>

```
✧ ･ ｡ﾟ☆   ✧ ･ ｡ﾟ☆   ✧ ･ ｡ﾟ☆   ✧ ･ ｡ﾟ☆   ✧ ･ ｡ﾟ☆
```

</div>

---

## ▓ WAT.IS ▓

**One Line Prezi** is een desktop app voor het maken van unieke presentaties met **one line art** (tekeningen uit één doorlopende lijn). De lijn tekent zich op het scherm, vloeit naar de volgende dia, en brengt je verhaal tot leven.

> `[OK]` Sleep een SVG, kies kleuren, voeg tekst en media toe, en presenteer.

<br>

```
┌─────────────────────────────────────────────────────────┐
│  ♡  FEATURES.sys                              [_][□][×] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✧  Ingebouwde one-line-art bibliotheek                 │
│  ✧  One-line-font: a–z, A–Z, 0–9 en leestekens  (NIEUW) │
│  ✧  Ongedaan maken / opnieuw  (NIEUW)                   │
│  ✧  Automatisch bewaren + herstel na afsluiten  (NIEUW) │
│  ✧  SVG one-line art upload  (drag & drop)              │
│  ✧  Kleur per pad — onbeperkt saved palette             │
│  ✧  Tekstblokken, afbeeldingen, video's, YouTube        │
│  ✧  Vrij positioneerbaar & roteerbaar                   │
│  ✧  Ondertitel + titel per dia                          │
│  ✧  Pen tool voor eigen paden                           │
│  ✧  Live animatie bij presenteren                       │
│  ✧  Export als standalone HTML                          │
│  ✧  Opslaan / laden als JSON                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ▓ INSTALL.exe ▓

```bash
# Clone deze repo
git clone https://github.com/janpieterbaalder/One-Line-Prezi.git
cd One-Line-Prezi

# Installeer dependencies
npm install

# Start de app
npm start
```

### ▒ BUILD .exe ▒

```bash
npm run build
```
Het installatiebestand verschijnt in `./dist/`.

---

## ▓ BIBLIOTHEEK ▓

De one-line-art afbeeldingen zitten **standaard ingesloten** in de app én in de
online versie. Je kunt ze dus op elke computer kiezen via de knop **◫ Bibliotheek**
— geen losse bestanden nodig.

```
┌─────────────────────────────────────────────────────────┐
│  ◫  Eigen afbeeldingen toevoegen aan de bibliotheek       │
├─────────────────────────────────────────────────────────┤
│  1.  Zet je .svg-bestanden in  assets/svglibrary/         │
│  2.  Genereer de bibliotheek opnieuw:                     │
│                                                           │
│         npm run build:svglib                              │
│                                                           │
│      → schrijft assets/svglibrary.js + manifest.json      │
│  3.  Start de app — de nieuwe art staat in de bibliotheek │
└─────────────────────────────────────────────────────────┘
```

> De bestandsnaam wordt automatisch de weergavenaam (een afsluitend nummer zoals
> `-01` wordt weggelaten). Pas namen desgewenst aan in `assets/svglibrary/manifest.json`;
> die blijven bij een volgende `npm run build:svglib` behouden.

### ▒ ONE LINE FONT ▒

Het handgeschreven **one-line-font** ("Tekst als pad") zit eveneens ingesloten
(`assets/onelinefont.js`), zodat het ook in de desktop-app (`file://`) en op elke
computer werkt — zonder netwerk. Het font bevat kleine letters (`a–z`),
hoofdletters (`A–Z`), cijfers (`0–9`) en de leestekens `. , ! ? - : ; ' " ( ) & / + =`;
letters met een accent (é, ë, …) worden getekend als de letter zonder accent.

Elk teken is een SVG in `assets/onelinefont/` met de metadata in de bestandsnaam:

```
one line font_kleine a (lo=0,0; ro=160,0; s=8,60; f=160,60).svg
one line font_hoofdletter A (…).svg
one line font_cijfer 1 (…).svg
one line font_leesteken vraagteken (…).svg
```

`s` = startpunt en `f` = eindpunt van de lijn (y = 60 boven de basislijn, zodat
tekens op elkaar aansluiten), `ro` = breedte. Leestekens hebben een naam in de
bestandsnaam, omdat Windows `: ? / "` niet toestaat. Een pad zónder lijn
(`stroke: none`) is een onzichtbare verbinding: de pen gaat daar even omhoog,
zoals naar de punt van een `!`.

Tekens aanpassen of toevoegen en daarna opnieuw insluiten (of dubbelklik
`update-font.bat`):

```bash
npm run build:font
```

De hoofdletters, cijfers en leestekens zijn getekend met
`tools/generate-onelinefont.js` (puntdefinities → SVG). Daarmee kun je ze
opnieuw genereren, ook per teken: `npm run gen:font -- A ?`. Let op: dat
overschrijft de SVG van die tekens, ook als je ze in Illustrator hebt bijgewerkt.

---

## ▓ HOE.WERKT.HET ▓

<table>
<tr>
<td align="center" width="25%">

**`01`**
<br>
**UPLOAD**
<br>
Sleep een SVG met één of meerdere paden naar het canvas.

</td>
<td align="center" width="25%">

**`02`**
<br>
**KLEUR**
<br>
Achtergrond, lijnkleur per pad, ondertitel- en tekstkleuren.

</td>
<td align="center" width="25%">

**`03`**
<br>
**BOUW**
<br>
Titels, tekst, afbeeldingen, video's, YouTube — vrij positioneerbaar.

</td>
<td align="center" width="25%">

**`04`**
<br>
**PRESENTEER**
<br>
De lijn tekent, de media verschijnt, je publiek is verkocht.

</td>
</tr>
</table>

---

## ▓ KEYBOARD.sys ▓

**Presenteren**

| Toets | Actie |
|:---:|:---|
| `→` / `Spatie` / `PgDn` / `Klik` | Volgende dia |
| `←` / `PgUp` | Vorige dia |
| `Esc` | Stop presentatie |
| `F11` | Volledig scherm |

**Bewerken**

| Toets | Actie |
|:---:|:---|
| `Ctrl+Z` | Ongedaan maken |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Opnieuw |
| `Ctrl+S` | Opslaan |
| `Delete` / `Backspace` | Geselecteerd blok verwijderen |

> Wijzigingen worden ook automatisch lokaal bewaard. Sluit je de app zonder op
> te slaan, dan biedt hij bij de volgende start aan om ze te herstellen.

---

## ▓ TECH.STACK ▓

```
┌─ RUNTIME ──────────────────────┐    ┌─ BUILD ──────────────────┐
│  ▓ Electron 40.x               │    │  ▓ electron-builder       │
│  ▓ Node.js + commonjs          │    │  ▓ NSIS (Windows)         │
│  ▓ Vanilla HTML / CSS / JS     │    │  ▓ sharp + png-to-ico     │
└────────────────────────────────┘    └───────────────────────────┘
```

---

<div align="center">

```
═══════════════════════════════════════════════════════════════
      ✧ ･ ｡ ﾟ   MADE WITH ♡ BY BAALDERBORG GROEP   ﾟ ｡ ･ ✧
═══════════════════════════════════════════════════════════════
```

![Footer](https://img.shields.io/badge/%E2%99%A5%20FOLLOW%20YOUR%20HEART-FF5EB8?style=for-the-badge&labelColor=2A1458)
![Footer2](https://img.shields.io/badge/%E2%9C%A7%20LOADING%20GOOD%20MOOD-68E3D6?style=for-the-badge&labelColor=2A1458)

<sub>© Baalderborg Groep — UNLICENSED</sub>

</div>
