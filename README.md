# Notino Glossary

Firemni slovnik pojmu s podporou vice kontextu a jazyku. Kazdy termin ma vlastni YAML soubor, ktery lze spravovat pres CODEOWNERS.

## Struktura

```
terms/                  # kazdy termin = 1 YAML soubor (pojmenovany podle EN varianty)
  transfer-form.yml     # Prevodka
  warehouse.yml         # Sklad
  ...
scripts/build.js        # terms/*.yml -> src/terms.json (build-time)
src/App.jsx             # React aplikace
CODEOWNERS              # vlastnici jednotlivych termin souboru
```

## Lokalni vyvoj

```bash
npm install
npm run dev        # spusti dev server na localhost:5173
```

## Pridani / uprava pojmu

### Pres web rozhrani
1. Klikni "New term" nebo ikonu editace
2. Vyplni formular — automaticky se vytvori PR
3. U noveho terminu se autor prida do CODEOWNERS

### Primo v repu
1. Pridej/uprav YAML v `terms/`
2. Commitni a pushni do `main`
3. GitHub Actions automaticky prebuduje a nasadi na Pages

### YAML format

```yaml
term_cs: Prevodka
term_en: Transfer form
term_ro: Formular de transfer
term_it: Modulo di trasferimento
term_ua: ...
term_pl: Dokument transferowy

definitions:
  - context: finance
    meaning: "Ucetni doklad pro ..."
    en_gui: Transfer document
    en_code: TransferDocument
  - context: logistics
    meaning: "Doklad pro fyzicky presun zbozi ..."
    en_gui: Transfer form
    en_code: TransferForm
```

## CODEOWNERS

Kazdy termin soubor muze mit vlastniho CODEOWNERS:

```
/terms/ @notino/glossary-admins        # default
/terms/transfer-form.yml @jiri-polasek # vlastnik terminu
```

Pri pridani noveho terminu pres web se autor automaticky doplni do CODEOWNERS.

## Deploy

1. V repu: Settings -> Pages -> Source: **GitHub Actions**
2. Uprav `base` ve `vite.config.js` pokud se nazev repa lisi od `notino-glossary`
