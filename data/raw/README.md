# Vendored raw word lists

Raw public-domain / permissively licensed lists, vendored so analysis and any
future build are offline and reproducible. These are the RAW lists only. No
derived or baked artifacts from other projects (no patch layers, no exclusion
lists, no calendars) are vendored here; Out of Sorts makes its own design
decisions on top of these.

## ENABLE (`enable1.txt`)

- Source: https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
- License: public domain.
- 172,823 words, lowercase ASCII, one per line.
- Copied from the eight-letters vendored copy on 2026-07-12 (originally
  vendored there 2026-06-18).

## SCOWL (`scowl/`)

- Classic SCOWL v1, version 2020.12.07. NOT ESDB (ESDB dropped the size 95
  band; this version has it).
- Source: https://downloads.sourceforge.net/project/wordlist/SCOWL/2020.12.07/scowl-2020.12.07.tar.gz
- License: permissive (Kevin Atkinson et al.). See the SCOWL README in the
  upstream tarball.
- Vendored bands: `english-words.N` and `american-words.N` at sizes
  10, 20, 35, 40, 50, 55, 60, 70, 80, 95.
- SCOWL sizes are cumulative: a "size N" dictionary is the union of every
  band with size <= N, across both the english (common to all variants) and
  american lists.
- Files are ISO-8859-1 encoded and include possessive forms (`abacus's`);
  consumers must clean (lowercase, keep only `^[a-z]+$`).
- Copied from the eight-letters vendored copy on 2026-07-12 (originally
  vendored there 2026-06-18).
