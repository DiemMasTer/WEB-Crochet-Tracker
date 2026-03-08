

Welcome to the WEB Crochet Tracker.

This is a simple tool that shouldn't raise safety concerns as it saves progress in YOUR browser

It was written with the aid of AI and a lot of planning and elbow grease.

Tested on Brave (Chromium Browser) and Firefox.

# licence 
You can do anything you want with this code, but you cannot use it/modify it for commercial purposes, you can't incorporate the code in any for profit project/product.


# features, overview 
- **track** your projects, **count** your stitches
- **write** the pattern or **paste** it
- **save** your data in your browser automatically, **export** it, **import** it
- two themes: "midnight" and "grey scale"
- **auto-expand** rows/rounds
- add **pattern sections**, such as "Head" OR "body" or whatever you want to name them
- stitches made in the same stitch
- add **notes** to your project and rows.
- add **colors** to stitches, or to sections.
- terms: 🇺🇸🇮🇹🇩🇪🇪🇸🇵🇹🇨🇳
- **easy editing**: edit the raw pattern or edit as you go, if you can't be bothered by learning color and notes syntax

# Frankenpattern🧟‍♀️ to get you started
This is a pattern that showcases most features. Paste it and play with it.


```
English US
Round 1: 6 sc in magic ring [6 sts] # here you have a note!
Round 2: inc 6 times [12] # English written multipliers
Round 3: <pu>blo (sc, inc) * 6</pu> [18] # color tags and BLO modifier
Rounds 4-5: [ (sc, inc) * 2, 2 sc ] * 3 [24] # Row Ranges and Nested Brackets
Rnd 6: sc in each st around [24] # auto-calc

Spanish
Vuelta 7: sct en toda la vuelta [24] #  Spanish BLO (sct) 
V 8: (2 pb, aum) 8 veces [32] # Tests Spanish stitches (pb/aum) and 'veces'
Hileras 9-10: 32 pb [32] # Tests Spanish Row prefix (Hilera) and number-first format
Vuelta 11: (pb, dis, pe, pc) * 8 [32] # Tests pb, dec, sl st, and ch

Italian
Giro 12: slb in tutto il giro [32] # Tests Italian BLO (slb) and boilerplate
Giri 13-14: (2 mb, dim) 8 volte [24] # Tests Italian Giri, mb/dim, and 'volte'
Giro 15: {3 mb, 1 ma} * 5, 4 mb [24] # Tests the {} Same-Stitch Cluster logic!

Portuguese
Volta 16: pb na volta toda [24] # Tests Portuguese boilerplate
Carr 17: (2 pb, aum, pbx) 6 vezes [30] # Tests Carreira, pbx (sl st), and 'vezes'
C 18: 30 pb [30] # Tests abbreviation 'C'

Chinese 
R19: 只钩内 30X [30] # Chinese BLO modifier, and X
第 20 圈: (3X, V) 6x [36 针] # Tests Suffix bracket multiplier "6x" and Chinese total "针"
第 21 圈: 6(4X, V) [42] # Tests Prefix bracket multiplier "6(...)"
行 22: 30X, W, M, A, TV, TW, 1X [40] # Tests Row prefix (行) and ALL special multi-inc/dec math
行 23: N, Q, G, Y [4] # Tests Crab, Cluster, Popcorn, and Picot symbols!

```

# language agnostic notation

These work regardless of the language the pattern is written in.

**Grouping & Sequences**
*    `()`, `[]`  for grouping
* *    It supports nested math (e.g., `[ (sc 1, inc) * 2 ] * 3`).
*   Commas  are used to separate different steps in a sequence (e.g., `sc 1, inc, sc 2`).
*   Stitches inside a stitch are placed inside `{} ` (e.g., `{5sc}` means "crochet 5sc in the same stitch")
   

**Multipliers & Math**
*   **Math symbols:** `*`, `x`, and `X` (followed by a number) are used to repeat a sequence or stitch (e.g., `sc * 6`, `[inc, sc] x 4`).
*    Numbers placed before or after a stitch automatically act as counts (e.g., `4 sc`, `sc 4`, `sc4` all mean 4 single crochets).

**Row/Round Definitions & Totals**
*  rows via numbers followed by a colon, dot, or dash (e.g., `1:`, `1.`, `1-`)
*  ranges are expanded into individual rows (e.g., `Row 1-5: sc around` becomes 5 separate rows).
*   Recognizes total stitch counts at the end of a line (e.g., `(12)`, `[24 sts]`).

**Formatting & Customization**
*   **Color Tags:** to apply colors to specific stitches or sections (e.g., `<r>sc 5</r>` makes those 5 stitches red). Tags supported include `<bla>`, `<w>`, `<y>`, `<lo>`, `<o>`, `<lr>`, `<r>`, `<lpin>`, `<pin>`, `<lpu>`, `<pu>`, `<lblu>`, `<blu>`, `<lgr>`, `<gr>`, `<lbro>`, `<bro>`, `<lgre>`, `<gre>`. You can also do this via the interface.

*   **Inline Notes/Comments:** Adding a hashtag `#` allows you to write notes that won't be parsed as stitches. (e.g., `sc 5 # stuff stuffing here`). You can also do this via the interface.



# language specific
## 🇺🇸 English (US Terms) you can adapt to UK, as SC and DC are both "worth" 1 stitch.
*   **Stitches:** 
    *   `sc` (Single Crochet)
    *   `inc` (Increase)
    *   `dec` (Decrease)
    *   `invdec` (Invisible Decrease)
    *   `sl st` or `slst` (Slip Stitch)
    *   `hdc` (Half Double Crochet)
    *   `dc` (Double Crochet)
    *   `pop` (Popcorn)
*   **Modifiers:** 
    *   `blo` / `bl` (Back Loop Only)
    *   `flo` / `fl` (Front Loop Only)
    *   `fp` (Front Post)
    *   `bp` (Back Post)
*   **Row/Round Prefixes:** `Rounds`, `Round`, `Rnds`, `Rnd`, `Rows`, `Row`, `Rd`, `R`
*   **Multiplier Words:** `times`, `repeat`, `rep` (e.g., "repeat 4 times", "rep 4x")
*   **Auto-calculated:** 
    *   `in each st around` / `in every st around`
    *   `in each stitch around`
    *   `in 1 st around`
    *   `all around` / `around`

---

## 🇪🇸 Spanish (es)
*   **Stitches:** 
    *   `pb` (Punto Bajo = sc)
    *   `aum` (Aumento = inc)
    *   `dis` (Disminución = dec)
    *   `pe` / `pd` (Punto Enano / Punto Deslizado = sl st)
    *   `mpa` (Medio Punto Alto = hdc)
    *   `pa` (Punto Alto = dc)
    *   `pc` / `cad` (Punto Cadena / Cadeneta = ch)
*   **Modifiers:** 
    *   `sct` (Solo hebra trasera = blo)
    *   `scd` (Solo hebra delantera = flo)
*   **Row/Round Prefixes:** `Vueltas`, `Vuelta`, `Hileras`, `Hilera`, `V`, `H`
*   **Multiplier Words:** `veces`, `repetir`
*   **Auto-calculated:** 
    *   `en cada pt` / `en cada punto` / `en cada p`
    *   `en toda la vuelta`
    *   `alrededor`
    *   `vuelta`

---

## 🇩🇪 German (de)
*   **Stitches:** 
    *   `fm` (Feste Masche = sc)
    *   `zun` (Zunahme = inc)
    *   `abn` (Abnahme = dec)
    *   `km` (Kettmasche = sl st)
    *   `hstb` (Halbes Stäbchen = hdc)
    *   `stb` (Stäbchen = dc)
    *   `lm` (Luftmasche = ch)
*   **Modifiers:** 
    *   `hmg` (Hinteres Maschenglied = blo)
    *   `vmg` / `vrmg` (Vorderes Maschenglied = flo)
*   **Row/Round Prefixes:** `Runden`, `Runde`, `Reihen`, `Reihe`, `Rd`
*   **Multiplier Words:** `mal`, `wiederhole`, `wiederholen`, `wdh`
*   **Auto-calculated:** 
    *   `in jede m` / `in jede masche`
    *   `rundherum`
    *   `in der gesamten runde`
    *   `runde`

---

## 🇮🇹 Italian (it)
*   **Stitches:** 
    *   `mb` (Maglia Bassa = sc)
    *   `aum` (Aumento = inc)
    *   `dim` (Diminuzione = dec)
    *   `mbss` (Maglia Bassissima = sl st)
    *   `mma` (Mezza Maglia Alta = hdc)
    *   `ma` (Maglia Alta = dc)
    *   `cat` (Catenella = ch)
*   **Modifiers:** 
    *   `slb` (Solo asola posteriore = blo)
    *   `sla` (Solo asola anteriore = flo)
*   **Row/Round Prefixes:** `Giri`, `Giro`, `Righe`, `Riga`, `G`
*   **Multiplier Words:** `volte`, `ripeti`, `ripetere`
*   **Auto-calculated:** 
    *   `in ogni m` / `in ogni maglia`
    *   `attorno`
    *   `in tutto il giro`
    *   `giro`

---

## 🇵🇹 Portuguese (pt)
*   **Stitches:** 
    *   `pb` (Ponto Baixo = sc)
    *   `aum` (Aumento = inc)
    *   `dim` (Diminuição = dec)
    *   `pbx` (Ponto Baixíssimo = sl st)
    *   `mpa` (Meio Ponto Alto = hdc)
    *   `pa` (Ponto Alto = dc)
    *   `corr` (Correntinha = ch)
*   **Modifiers:** *(Relies on universal/English defaults for modifiers like BLO/FLO)*
*   **Row/Round Prefixes:** `Voltas`, `Volta`, `Carreiras`, `Carreira`, `Carr`, `C`
*   **Multiplier Words:** `vezes`, `repete`, `repita`
*   **Auto-calculated:** 
    *   `em cada pt` / `em cada ponto`
    *   `na volta toda`
    *   `ao redor`
    *   `volta`

 ## Chinese 🇨🇳
*   **Stitches:** they are case insensitive
  
*   **`X`** = Single Crochet (sc)
*   **`V`** = Increase (2 sc in one stitch)
*   **`W`** = Double Increase (3 sc in one stitch)
*   **`A`** = Decrease (sc2tog)
*   **`M`** = Double Decrease (sc3tog)
*   **`T`** = Half Double Crochet (hdc)
*   **`F`** = Double Crochet (dc)
*   **`E`** = Treble Crochet (tr)
*   **`SL`** or **`SS`** = Slip Stitch (sl st)
*   **`CH`** = Chain (ch)

*  **Speciality stitches**:
*   **N** = reverse single crochet (crab stitch)
*   **NX** = bpsc (back post sc)
*   **WX** = fpsc (front post sc)
*   **NT** = bphdc (back post hdc)
*   **WT** = fphdc (front post hdc)
*   **NF** = bpdc (back post dc)
*   **WF** = fpdc (front post dc)
*   **Q** = cluster / bobble
*   **G** = popcorn
*   **Y** = picot
*   **TV** = hdc inc *(Math engine will output 2)*
*   **TW** = hdc inc3 *(Math engine will output 3)*
*   **FV** = dc inc *(Math engine will output 2)*
*   **FW** = dc inc3 *(Math engine will output 3)*
*   **TA** = hdc dec
*   **TM** = hdc dec3 
*   **FA** = dc dec
*   **FM** = dc dec3

*   **Modifiers:** 
*  `'只钩内': 'blo'` (Only hook inside)
*   `'后半针': 'blo'` (Back half stitch)
*   `'只钩外': 'flo'` (Only hook outside)
*   `'前半针': 'flo'` (Front half stitch)
*   **Row/Round Prefixes:** `R`,第 (Number/Prefix), 圈 (Round), and 行 (Row)





