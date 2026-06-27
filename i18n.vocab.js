/* JamMate — i18n catalog for the controlled vocabulary in data.js (instruments,
 * skill levels, Italian-named genres, instrument families). DISPLAY-ONLY.
 *
 * ⚠️ The canonical values in data.js (INSTRUMENTS, LEVELS, GENRES, KEYS,
 * INSTRUMENT_FAMILY, …) are PERSISTED in profiles, COMPARED in code and MATCHED
 * by the backend. They are NEVER changed here. This file only maps a canonical
 * value to a localized LABEL; the value / data-attr / selected comparison always
 * stays on the canonical Italian string. app.js `vocabLabel(v)` resolves the label
 * and falls back to the canonical value when no key exists.
 *
 * SLUG / NAMESPACE SCHEME (must match app.js vocabLabel() byte-for-byte):
 *   slug(v) = lowercase → NFD → drop combining marks → [^a-z0-9]+ → "_" → trim "_"
 *   - Instruments:        "vocab." + slug(value)          e.g. "vocab.chitarra"
 *   - Instrument families: "vocab.fam_" + slug(family)    e.g. "vocab.fam_voce"
 *   - Skill levels:       "vocab.level_" + slug(value)    e.g. "vocab.level_principiante"
 *   - Genres:             "vocab.genre_" + slug(value)    e.g. "vocab.genre_classica"
 * Prefixes (fam_/level_/genre_) keep the four categories collision-free even when
 * slugs would otherwise coincide (e.g. family "Voce" vs instrument "Voce").
 *
 * Values already international / identical across languages have NO key and fall
 * back to the canonical value: Rock, Pop, Jazz, Blues, Metal, Funk, Indie, Reggae,
 * Soul, Sax, Synth, Ukulele, Banjo, "DJ / Producer", Theremin, Kalimba, Sitar,
 * Bouzouki, Mandola, Bandoneon, Melodica, Rhodes, Wurlitzer, Clavinet, Djembe,
 * Timbales, Handpan, Vibrafono*, Marimba, Tabla, Beatbox, Rapping, etc.
 * (it = canonical Italian text everywhere a key exists.)
 *
 * KEYS (Do/Re/Mi…): intentionally NOT localized — see app.js note; the tuner and
 * repertoire rely on the canonical solfège strings and KEY_PC parsing.
 *
 * Loaded after i18n.js (defines JM.i18n.extend) and before app.js.
 */
(function () {
  "use strict";
  var JM = window.JM;
  if (!(JM && JM.i18n && JM.i18n.extend)) return;

  JM.i18n.extend({
    en: {
      // — Instrument families —
      "vocab.fam_voce": "Voice", "vocab.fam_chitarre_corde": "Guitars & strings",
      "vocab.fam_bassi": "Basses", "vocab.fam_tastiere": "Keyboards",
      "vocab.fam_percussioni": "Percussion", "vocab.fam_archi": "Strings",
      "vocab.fam_legni_sax": "Woodwinds & sax", "vocab.fam_ottoni": "Brass",
      "vocab.fam_etnici_altri": "World & other", "vocab.fam_elettronica_produzione": "Electronic / production",
      // — Voice —
      "vocab.voce": "Voice", "vocab.voce_soprano": "Voice (soprano)", "vocab.voce_contralto": "Voice (alto)",
      "vocab.voce_tenore": "Voice (tenor)", "vocab.voce_baritono": "Voice (baritone)", "vocab.voce_basso": "Voice (bass)",
      "vocab.cori_backing_vocal": "Choir / Backing vocal",
      // — Guitars & strings —
      "vocab.chitarra": "Guitar", "vocab.chitarra_acustica": "Acoustic guitar", "vocab.chitarra_classica": "Classical guitar",
      "vocab.chitarra_elettrica": "Electric guitar", "vocab.chitarra_12_corde": "12-string guitar",
      "vocab.chitarra_baritono": "Baritone guitar", "vocab.chitarra_resofonica_dobro": "Resonator guitar (Dobro)",
      "vocab.lap_steel": "Lap steel", "vocab.pedal_steel": "Pedal steel", "vocab.mandolino": "Mandolin",
      "vocab.arpa": "Harp",
      // — Basses —
      "vocab.basso": "Bass", "vocab.basso_elettrico": "Electric bass", "vocab.basso_5_corde": "5-string bass",
      "vocab.basso_6_corde": "6-string bass", "vocab.basso_fretless": "Fretless bass", "vocab.basso_acustico": "Acoustic bass",
      "vocab.contrabbasso": "Double bass", "vocab.synth_bass": "Synth bass",
      // — Keyboards —
      "vocab.pianoforte": "Piano", "vocab.pianoforte_digitale": "Digital piano", "vocab.tastiere": "Keyboards",
      "vocab.synth_modulare": "Modular synth", "vocab.organo_hammond": "Hammond organ", "vocab.organo": "Organ",
      "vocab.fisarmonica": "Accordion",
      // — Percussion —
      "vocab.batteria": "Drums", "vocab.batteria_elettronica": "Electronic drums", "vocab.percussioni": "Percussion",
      "vocab.bonghi": "Bongos", "vocab.tamburello": "Tambourine", "vocab.vibrafono": "Vibraphone",
      "vocab.xilofono": "Xylophone", "vocab.glockenspiel": "Glockenspiel", "vocab.campane_tubolari": "Tubular bells",
      "vocab.timpani": "Timpani",
      // — Strings (orchestral) —
      "vocab.violino": "Violin", "vocab.viola": "Viola", "vocab.violoncello": "Cello",
      // — Woodwinds & sax —
      "vocab.flauto_traverso": "Flute", "vocab.ottavino": "Piccolo", "vocab.flauto_dolce": "Recorder",
      "vocab.clarinetto_si": "Clarinet (B♭)", "vocab.clarinetto_basso": "Bass clarinet", "vocab.oboe": "Oboe",
      "vocab.corno_inglese": "English horn", "vocab.fagotto": "Bassoon", "vocab.armonica": "Harmonica",
      "vocab.sax_soprano_si": "Soprano sax (B♭)", "vocab.sax_contralto_mi": "Alto sax (E♭)",
      "vocab.sax_tenore_si": "Tenor sax (B♭)", "vocab.sax_baritono_mi": "Baritone sax (E♭)",
      // — Brass —
      "vocab.tromba": "Trumpet", "vocab.tromba_in_do": "Trumpet in C", "vocab.cornetta": "Cornet",
      "vocab.flicorno": "Flugelhorn", "vocab.trombone": "Trombone", "vocab.trombone_basso": "Bass trombone",
      "vocab.corno_francese_fa": "French horn (F)", "vocab.tuba": "Tuba", "vocab.sousafono": "Sousaphone",
      // — World & other —
      "vocab.cornamusa": "Bagpipes", "vocab.zampogna": "Zampogna",
      // — Electronic / production —
      "vocab.producer_beatmaker": "Producer / Beatmaker", "vocab.sampler_looper": "Sampler / Looper",
      "vocab.tastiera_midi": "MIDI keyboard", "vocab.controller_live_electronics": "Controller / Live electronics",
      // — Skill levels —
      "vocab.level_principiante": "Beginner", "vocab.level_principiante_intermedio": "Beginner – Intermediate",
      "vocab.level_intermedio": "Intermediate", "vocab.level_intermedio_avanzato": "Intermediate – Advanced",
      "vocab.level_avanzato": "Advanced", "vocab.level_professionista": "Professional",
      // — Genres (Italian-named only) —
      "vocab.genre_cantautorato": "Singer-songwriter", "vocab.genre_elettronica": "Electronic",
      "vocab.genre_classica": "Classical", "vocab.genre_folk": "Folk"
    },
    it: {
      // it = canonical Italian text (identity), kept explicit so it survives the
      // English-fallback chain unchanged.
      "vocab.fam_voce": "Voce", "vocab.fam_chitarre_corde": "Chitarre & corde",
      "vocab.fam_bassi": "Bassi", "vocab.fam_tastiere": "Tastiere",
      "vocab.fam_percussioni": "Percussioni", "vocab.fam_archi": "Archi",
      "vocab.fam_legni_sax": "Legni & Sax", "vocab.fam_ottoni": "Ottoni",
      "vocab.fam_etnici_altri": "Etnici & altri", "vocab.fam_elettronica_produzione": "Elettronica / produzione",
      "vocab.voce": "Voce", "vocab.voce_soprano": "Voce (soprano)", "vocab.voce_contralto": "Voce (contralto)",
      "vocab.voce_tenore": "Voce (tenore)", "vocab.voce_baritono": "Voce (baritono)", "vocab.voce_basso": "Voce (basso)",
      "vocab.cori_backing_vocal": "Cori / Backing vocal",
      "vocab.chitarra": "Chitarra", "vocab.chitarra_acustica": "Chitarra acustica", "vocab.chitarra_classica": "Chitarra classica",
      "vocab.chitarra_elettrica": "Chitarra elettrica", "vocab.chitarra_12_corde": "Chitarra 12 corde",
      "vocab.chitarra_baritono": "Chitarra baritono", "vocab.chitarra_resofonica_dobro": "Chitarra resofonica (Dobro)",
      "vocab.lap_steel": "Lap steel", "vocab.pedal_steel": "Pedal steel", "vocab.mandolino": "Mandolino",
      "vocab.arpa": "Arpa",
      "vocab.basso": "Basso", "vocab.basso_elettrico": "Basso elettrico", "vocab.basso_5_corde": "Basso 5 corde",
      "vocab.basso_6_corde": "Basso 6 corde", "vocab.basso_fretless": "Basso fretless", "vocab.basso_acustico": "Basso acustico",
      "vocab.contrabbasso": "Contrabbasso", "vocab.synth_bass": "Synth bass",
      "vocab.pianoforte": "Pianoforte", "vocab.pianoforte_digitale": "Pianoforte digitale", "vocab.tastiere": "Tastiere",
      "vocab.synth_modulare": "Synth modulare", "vocab.organo_hammond": "Organo Hammond", "vocab.organo": "Organo",
      "vocab.fisarmonica": "Fisarmonica",
      "vocab.batteria": "Batteria", "vocab.batteria_elettronica": "Batteria elettronica", "vocab.percussioni": "Percussioni",
      "vocab.bonghi": "Bonghi", "vocab.tamburello": "Tamburello", "vocab.vibrafono": "Vibrafono",
      "vocab.xilofono": "Xilofono", "vocab.glockenspiel": "Glockenspiel", "vocab.campane_tubolari": "Campane tubolari",
      "vocab.timpani": "Timpani",
      "vocab.violino": "Violino", "vocab.viola": "Viola", "vocab.violoncello": "Violoncello",
      "vocab.flauto_traverso": "Flauto traverso", "vocab.ottavino": "Ottavino", "vocab.flauto_dolce": "Flauto dolce",
      "vocab.clarinetto_si": "Clarinetto (Si♭)", "vocab.clarinetto_basso": "Clarinetto basso", "vocab.oboe": "Oboe",
      "vocab.corno_inglese": "Corno inglese", "vocab.fagotto": "Fagotto", "vocab.armonica": "Armonica",
      "vocab.sax_soprano_si": "Sax soprano (Si♭)", "vocab.sax_contralto_mi": "Sax contralto (Mi♭)",
      "vocab.sax_tenore_si": "Sax tenore (Si♭)", "vocab.sax_baritono_mi": "Sax baritono (Mi♭)",
      "vocab.tromba": "Tromba", "vocab.tromba_in_do": "Tromba in Do", "vocab.cornetta": "Cornetta",
      "vocab.flicorno": "Flicorno", "vocab.trombone": "Trombone", "vocab.trombone_basso": "Trombone basso",
      "vocab.corno_francese_fa": "Corno francese (Fa)", "vocab.tuba": "Tuba", "vocab.sousafono": "Sousafono",
      "vocab.cornamusa": "Cornamusa", "vocab.zampogna": "Zampogna",
      "vocab.producer_beatmaker": "Producer / Beatmaker", "vocab.sampler_looper": "Sampler / Looper",
      "vocab.tastiera_midi": "Tastiera MIDI", "vocab.controller_live_electronics": "Controller / Live electronics",
      "vocab.level_principiante": "Principiante", "vocab.level_principiante_intermedio": "Principiante - Intermedio",
      "vocab.level_intermedio": "Intermedio", "vocab.level_intermedio_avanzato": "Intermedio - Avanzato",
      "vocab.level_avanzato": "Avanzato", "vocab.level_professionista": "Professionista",
      "vocab.genre_cantautorato": "Cantautorato", "vocab.genre_elettronica": "Elettronica",
      "vocab.genre_classica": "Classica", "vocab.genre_folk": "Folk"
    },
    de: {
      "vocab.fam_voce": "Gesang", "vocab.fam_chitarre_corde": "Gitarren & Saiten",
      "vocab.fam_bassi": "Bässe", "vocab.fam_tastiere": "Tasten",
      "vocab.fam_percussioni": "Perkussion", "vocab.fam_archi": "Streicher",
      "vocab.fam_legni_sax": "Holzbläser & Sax", "vocab.fam_ottoni": "Blechbläser",
      "vocab.fam_etnici_altri": "Welt & Sonstige", "vocab.fam_elettronica_produzione": "Elektronik / Produktion",
      "vocab.voce": "Gesang", "vocab.voce_soprano": "Gesang (Sopran)", "vocab.voce_contralto": "Gesang (Alt)",
      "vocab.voce_tenore": "Gesang (Tenor)", "vocab.voce_baritono": "Gesang (Bariton)", "vocab.voce_basso": "Gesang (Bass)",
      "vocab.cori_backing_vocal": "Chor / Backing Vocal",
      "vocab.chitarra": "Gitarre", "vocab.chitarra_acustica": "Akustikgitarre", "vocab.chitarra_classica": "Konzertgitarre",
      "vocab.chitarra_elettrica": "E-Gitarre", "vocab.chitarra_12_corde": "12-saitige Gitarre",
      "vocab.chitarra_baritono": "Baritongitarre", "vocab.chitarra_resofonica_dobro": "Resonatorgitarre (Dobro)",
      "vocab.lap_steel": "Lap Steel", "vocab.pedal_steel": "Pedal Steel", "vocab.mandolino": "Mandoline",
      "vocab.arpa": "Harfe",
      "vocab.basso": "Bass", "vocab.basso_elettrico": "E-Bass", "vocab.basso_5_corde": "5-saitiger Bass",
      "vocab.basso_6_corde": "6-saitiger Bass", "vocab.basso_fretless": "Bundloser Bass", "vocab.basso_acustico": "Akustikbass",
      "vocab.contrabbasso": "Kontrabass", "vocab.synth_bass": "Synth-Bass",
      "vocab.pianoforte": "Klavier", "vocab.pianoforte_digitale": "Digitalpiano", "vocab.tastiere": "Keyboards",
      "vocab.synth_modulare": "Modularsynth", "vocab.organo_hammond": "Hammondorgel", "vocab.organo": "Orgel",
      "vocab.fisarmonica": "Akkordeon",
      "vocab.batteria": "Schlagzeug", "vocab.batteria_elettronica": "E-Drums", "vocab.percussioni": "Perkussion",
      "vocab.bonghi": "Bongos", "vocab.tamburello": "Tamburin", "vocab.vibrafono": "Vibraphon",
      "vocab.xilofono": "Xylophon", "vocab.glockenspiel": "Glockenspiel", "vocab.campane_tubolari": "Röhrenglocken",
      "vocab.timpani": "Pauken",
      "vocab.violino": "Violine", "vocab.viola": "Viola", "vocab.violoncello": "Cello",
      "vocab.flauto_traverso": "Querflöte", "vocab.ottavino": "Piccoloflöte", "vocab.flauto_dolce": "Blockflöte",
      "vocab.clarinetto_si": "Klarinette (B)", "vocab.clarinetto_basso": "Bassklarinette", "vocab.oboe": "Oboe",
      "vocab.corno_inglese": "Englischhorn", "vocab.fagotto": "Fagott", "vocab.armonica": "Mundharmonika",
      "vocab.sax_soprano_si": "Sopransax (B)", "vocab.sax_contralto_mi": "Altsax (Es)",
      "vocab.sax_tenore_si": "Tenorsax (B)", "vocab.sax_baritono_mi": "Baritonsax (Es)",
      "vocab.tromba": "Trompete", "vocab.tromba_in_do": "Trompete in C", "vocab.cornetta": "Kornett",
      "vocab.flicorno": "Flügelhorn", "vocab.trombone": "Posaune", "vocab.trombone_basso": "Bassposaune",
      "vocab.corno_francese_fa": "Waldhorn (F)", "vocab.tuba": "Tuba", "vocab.sousafono": "Sousaphon",
      "vocab.cornamusa": "Dudelsack", "vocab.zampogna": "Zampogna",
      "vocab.producer_beatmaker": "Producer / Beatmaker", "vocab.sampler_looper": "Sampler / Looper",
      "vocab.tastiera_midi": "MIDI-Keyboard", "vocab.controller_live_electronics": "Controller / Live-Elektronik",
      "vocab.level_principiante": "Anfänger:in", "vocab.level_principiante_intermedio": "Anfänger:in – Mittelstufe",
      "vocab.level_intermedio": "Mittelstufe", "vocab.level_intermedio_avanzato": "Mittelstufe – Fortgeschritten",
      "vocab.level_avanzato": "Fortgeschritten", "vocab.level_professionista": "Profi",
      "vocab.genre_cantautorato": "Liedermacher", "vocab.genre_elettronica": "Electronic",
      "vocab.genre_classica": "Klassik", "vocab.genre_folk": "Folk"
    },
    es: {
      "vocab.fam_voce": "Voz", "vocab.fam_chitarre_corde": "Guitarras y cuerdas",
      "vocab.fam_bassi": "Bajos", "vocab.fam_tastiere": "Teclados",
      "vocab.fam_percussioni": "Percusión", "vocab.fam_archi": "Cuerda frotada",
      "vocab.fam_legni_sax": "Viento-madera y sax", "vocab.fam_ottoni": "Metales",
      "vocab.fam_etnici_altri": "Étnicos y otros", "vocab.fam_elettronica_produzione": "Electrónica / producción",
      "vocab.voce": "Voz", "vocab.voce_soprano": "Voz (soprano)", "vocab.voce_contralto": "Voz (contralto)",
      "vocab.voce_tenore": "Voz (tenor)", "vocab.voce_baritono": "Voz (barítono)", "vocab.voce_basso": "Voz (bajo)",
      "vocab.cori_backing_vocal": "Coros / Backing vocal",
      "vocab.chitarra": "Guitarra", "vocab.chitarra_acustica": "Guitarra acústica", "vocab.chitarra_classica": "Guitarra clásica",
      "vocab.chitarra_elettrica": "Guitarra eléctrica", "vocab.chitarra_12_corde": "Guitarra de 12 cuerdas",
      "vocab.chitarra_baritono": "Guitarra barítono", "vocab.chitarra_resofonica_dobro": "Guitarra resonadora (Dobro)",
      "vocab.lap_steel": "Lap steel", "vocab.pedal_steel": "Pedal steel", "vocab.mandolino": "Mandolina",
      "vocab.arpa": "Arpa",
      "vocab.basso": "Bajo", "vocab.basso_elettrico": "Bajo eléctrico", "vocab.basso_5_corde": "Bajo de 5 cuerdas",
      "vocab.basso_6_corde": "Bajo de 6 cuerdas", "vocab.basso_fretless": "Bajo sin trastes", "vocab.basso_acustico": "Bajo acústico",
      "vocab.contrabbasso": "Contrabajo", "vocab.synth_bass": "Bajo sintetizado",
      "vocab.pianoforte": "Piano", "vocab.pianoforte_digitale": "Piano digital", "vocab.tastiere": "Teclados",
      "vocab.synth_modulare": "Sintetizador modular", "vocab.organo_hammond": "Órgano Hammond", "vocab.organo": "Órgano",
      "vocab.fisarmonica": "Acordeón",
      "vocab.batteria": "Batería", "vocab.batteria_elettronica": "Batería electrónica", "vocab.percussioni": "Percusión",
      "vocab.bonghi": "Bongós", "vocab.tamburello": "Pandereta", "vocab.vibrafono": "Vibráfono",
      "vocab.xilofono": "Xilófono", "vocab.glockenspiel": "Glockenspiel", "vocab.campane_tubolari": "Campanas tubulares",
      "vocab.timpani": "Timbales sinfónicos",
      "vocab.violino": "Violín", "vocab.viola": "Viola", "vocab.violoncello": "Violonchelo",
      "vocab.flauto_traverso": "Flauta travesera", "vocab.ottavino": "Flautín", "vocab.flauto_dolce": "Flauta dulce",
      "vocab.clarinetto_si": "Clarinete (Si♭)", "vocab.clarinetto_basso": "Clarinete bajo", "vocab.oboe": "Oboe",
      "vocab.corno_inglese": "Corno inglés", "vocab.fagotto": "Fagot", "vocab.armonica": "Armónica",
      "vocab.sax_soprano_si": "Sax soprano (Si♭)", "vocab.sax_contralto_mi": "Sax alto (Mi♭)",
      "vocab.sax_tenore_si": "Sax tenor (Si♭)", "vocab.sax_baritono_mi": "Sax barítono (Mi♭)",
      "vocab.tromba": "Trompeta", "vocab.tromba_in_do": "Trompeta en Do", "vocab.cornetta": "Corneta",
      "vocab.flicorno": "Fliscorno", "vocab.trombone": "Trombón", "vocab.trombone_basso": "Trombón bajo",
      "vocab.corno_francese_fa": "Trompa (Fa)", "vocab.tuba": "Tuba", "vocab.sousafono": "Sousafón",
      "vocab.cornamusa": "Gaita", "vocab.zampogna": "Zampoña italiana",
      "vocab.producer_beatmaker": "Productor / Beatmaker", "vocab.sampler_looper": "Sampler / Looper",
      "vocab.tastiera_midi": "Teclado MIDI", "vocab.controller_live_electronics": "Controlador / Electrónica en vivo",
      "vocab.level_principiante": "Principiante", "vocab.level_principiante_intermedio": "Principiante – Intermedio",
      "vocab.level_intermedio": "Intermedio", "vocab.level_intermedio_avanzato": "Intermedio – Avanzado",
      "vocab.level_avanzato": "Avanzado", "vocab.level_professionista": "Profesional",
      "vocab.genre_cantautorato": "Cantautor", "vocab.genre_elettronica": "Electrónica",
      "vocab.genre_classica": "Clásica", "vocab.genre_folk": "Folk"
    },
    fr: {
      "vocab.fam_voce": "Voix", "vocab.fam_chitarre_corde": "Guitares & cordes",
      "vocab.fam_bassi": "Basses", "vocab.fam_tastiere": "Claviers",
      "vocab.fam_percussioni": "Percussions", "vocab.fam_archi": "Cordes frottées",
      "vocab.fam_legni_sax": "Bois & sax", "vocab.fam_ottoni": "Cuivres",
      "vocab.fam_etnici_altri": "Ethniques & autres", "vocab.fam_elettronica_produzione": "Électronique / production",
      "vocab.voce": "Voix", "vocab.voce_soprano": "Voix (soprano)", "vocab.voce_contralto": "Voix (alto)",
      "vocab.voce_tenore": "Voix (ténor)", "vocab.voce_baritono": "Voix (baryton)", "vocab.voce_basso": "Voix (basse)",
      "vocab.cori_backing_vocal": "Chœurs / Backing vocal",
      "vocab.chitarra": "Guitare", "vocab.chitarra_acustica": "Guitare acoustique", "vocab.chitarra_classica": "Guitare classique",
      "vocab.chitarra_elettrica": "Guitare électrique", "vocab.chitarra_12_corde": "Guitare 12 cordes",
      "vocab.chitarra_baritono": "Guitare baryton", "vocab.chitarra_resofonica_dobro": "Guitare à résonateur (Dobro)",
      "vocab.lap_steel": "Lap steel", "vocab.pedal_steel": "Pedal steel", "vocab.mandolino": "Mandoline",
      "vocab.arpa": "Harpe",
      "vocab.basso": "Basse", "vocab.basso_elettrico": "Basse électrique", "vocab.basso_5_corde": "Basse 5 cordes",
      "vocab.basso_6_corde": "Basse 6 cordes", "vocab.basso_fretless": "Basse fretless", "vocab.basso_acustico": "Basse acoustique",
      "vocab.contrabbasso": "Contrebasse", "vocab.synth_bass": "Basse synthé",
      "vocab.pianoforte": "Piano", "vocab.pianoforte_digitale": "Piano numérique", "vocab.tastiere": "Claviers",
      "vocab.synth_modulare": "Synthé modulaire", "vocab.organo_hammond": "Orgue Hammond", "vocab.organo": "Orgue",
      "vocab.fisarmonica": "Accordéon",
      "vocab.batteria": "Batterie", "vocab.batteria_elettronica": "Batterie électronique", "vocab.percussioni": "Percussions",
      "vocab.bonghi": "Bongos", "vocab.tamburello": "Tambourin", "vocab.vibrafono": "Vibraphone",
      "vocab.xilofono": "Xylophone", "vocab.glockenspiel": "Glockenspiel", "vocab.campane_tubolari": "Cloches tubulaires",
      "vocab.timpani": "Timbales",
      "vocab.violino": "Violon", "vocab.viola": "Alto", "vocab.violoncello": "Violoncelle",
      "vocab.flauto_traverso": "Flûte traversière", "vocab.ottavino": "Piccolo", "vocab.flauto_dolce": "Flûte à bec",
      "vocab.clarinetto_si": "Clarinette (si♭)", "vocab.clarinetto_basso": "Clarinette basse", "vocab.oboe": "Hautbois",
      "vocab.corno_inglese": "Cor anglais", "vocab.fagotto": "Basson", "vocab.armonica": "Harmonica",
      "vocab.sax_soprano_si": "Sax soprano (si♭)", "vocab.sax_contralto_mi": "Sax alto (mi♭)",
      "vocab.sax_tenore_si": "Sax ténor (si♭)", "vocab.sax_baritono_mi": "Sax baryton (mi♭)",
      "vocab.tromba": "Trompette", "vocab.tromba_in_do": "Trompette en ut", "vocab.cornetta": "Cornet",
      "vocab.flicorno": "Bugle", "vocab.trombone": "Trombone", "vocab.trombone_basso": "Trombone basse",
      "vocab.corno_francese_fa": "Cor d'harmonie (fa)", "vocab.tuba": "Tuba", "vocab.sousafono": "Soubassophone",
      "vocab.cornamusa": "Cornemuse", "vocab.zampogna": "Zampogna",
      "vocab.producer_beatmaker": "Producteur / Beatmaker", "vocab.sampler_looper": "Sampler / Looper",
      "vocab.tastiera_midi": "Clavier MIDI", "vocab.controller_live_electronics": "Contrôleur / Électronique live",
      "vocab.level_principiante": "Débutant", "vocab.level_principiante_intermedio": "Débutant – Intermédiaire",
      "vocab.level_intermedio": "Intermédiaire", "vocab.level_intermedio_avanzato": "Intermédiaire – Avancé",
      "vocab.level_avanzato": "Avancé", "vocab.level_professionista": "Professionnel",
      "vocab.genre_cantautorato": "Auteur-compositeur", "vocab.genre_elettronica": "Électronique",
      "vocab.genre_classica": "Classique", "vocab.genre_folk": "Folk"
    },
    pt: {
      "vocab.fam_voce": "Voz", "vocab.fam_chitarre_corde": "Guitarras e cordas",
      "vocab.fam_bassi": "Baixos", "vocab.fam_tastiere": "Teclados",
      "vocab.fam_percussioni": "Percussão", "vocab.fam_archi": "Cordas",
      "vocab.fam_legni_sax": "Madeiras e sax", "vocab.fam_ottoni": "Metais",
      "vocab.fam_etnici_altri": "Étnicos e outros", "vocab.fam_elettronica_produzione": "Eletrônica / produção",
      "vocab.voce": "Voz", "vocab.voce_soprano": "Voz (soprano)", "vocab.voce_contralto": "Voz (contralto)",
      "vocab.voce_tenore": "Voz (tenor)", "vocab.voce_baritono": "Voz (barítono)", "vocab.voce_basso": "Voz (baixo)",
      "vocab.cori_backing_vocal": "Coros / Backing vocal",
      "vocab.chitarra": "Violão", "vocab.chitarra_acustica": "Violão acústico", "vocab.chitarra_classica": "Violão clássico",
      "vocab.chitarra_elettrica": "Guitarra elétrica", "vocab.chitarra_12_corde": "Violão de 12 cordas",
      "vocab.chitarra_baritono": "Guitarra barítono", "vocab.chitarra_resofonica_dobro": "Guitarra ressonadora (Dobro)",
      "vocab.lap_steel": "Lap steel", "vocab.pedal_steel": "Pedal steel", "vocab.mandolino": "Bandolim",
      "vocab.arpa": "Harpa",
      "vocab.basso": "Baixo", "vocab.basso_elettrico": "Baixo elétrico", "vocab.basso_5_corde": "Baixo de 5 cordas",
      "vocab.basso_6_corde": "Baixo de 6 cordas", "vocab.basso_fretless": "Baixo fretless", "vocab.basso_acustico": "Baixo acústico",
      "vocab.contrabbasso": "Contrabaixo acústico", "vocab.synth_bass": "Synth bass",
      "vocab.pianoforte": "Piano", "vocab.pianoforte_digitale": "Piano digital", "vocab.tastiere": "Teclados",
      "vocab.synth_modulare": "Sintetizador modular", "vocab.organo_hammond": "Órgão Hammond", "vocab.organo": "Órgão",
      "vocab.fisarmonica": "Acordeão",
      "vocab.batteria": "Bateria", "vocab.batteria_elettronica": "Bateria eletrônica", "vocab.percussioni": "Percussão",
      "vocab.bonghi": "Bongôs", "vocab.tamburello": "Pandeireta", "vocab.vibrafono": "Vibrafone",
      "vocab.xilofono": "Xilofone", "vocab.glockenspiel": "Glockenspiel", "vocab.campane_tubolari": "Sinos tubulares",
      "vocab.timpani": "Tímpanos",
      "vocab.violino": "Violino", "vocab.viola": "Viola de orquestra", "vocab.violoncello": "Violoncelo",
      "vocab.flauto_traverso": "Flauta transversal", "vocab.ottavino": "Flautim", "vocab.flauto_dolce": "Flauta doce",
      "vocab.clarinetto_si": "Clarinete (Si♭)", "vocab.clarinetto_basso": "Clarinete baixo", "vocab.oboe": "Oboé",
      "vocab.corno_inglese": "Corne inglês", "vocab.fagotto": "Fagote", "vocab.armonica": "Gaita",
      "vocab.sax_soprano_si": "Sax soprano (Si♭)", "vocab.sax_contralto_mi": "Sax alto (Mi♭)",
      "vocab.sax_tenore_si": "Sax tenor (Si♭)", "vocab.sax_baritono_mi": "Sax barítono (Mi♭)",
      "vocab.tromba": "Trompete", "vocab.tromba_in_do": "Trompete em Dó", "vocab.cornetta": "Corneta",
      "vocab.flicorno": "Flugelhorn", "vocab.trombone": "Trombone", "vocab.trombone_basso": "Trombone baixo",
      "vocab.corno_francese_fa": "Trompa (Fá)", "vocab.tuba": "Tuba", "vocab.sousafono": "Sousafone",
      "vocab.cornamusa": "Gaita de foles", "vocab.zampogna": "Zampogna",
      "vocab.producer_beatmaker": "Produtor / Beatmaker", "vocab.sampler_looper": "Sampler / Looper",
      "vocab.tastiera_midi": "Teclado MIDI", "vocab.controller_live_electronics": "Controlador / Eletrônica ao vivo",
      "vocab.level_principiante": "Iniciante", "vocab.level_principiante_intermedio": "Iniciante – Intermediário",
      "vocab.level_intermedio": "Intermediário", "vocab.level_intermedio_avanzato": "Intermediário – Avançado",
      "vocab.level_avanzato": "Avançado", "vocab.level_professionista": "Profissional",
      "vocab.genre_cantautorato": "Cantautor", "vocab.genre_elettronica": "Eletrônica",
      "vocab.genre_classica": "Clássica", "vocab.genre_folk": "Folk"
    }
  });
})();
