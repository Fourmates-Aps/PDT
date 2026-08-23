/**
 * Danish copy — the primary locale.
 *
 * COPY STATUS: first draft. Every factual claim here is traceable to material in
 * `prototype/` (CVR, showrooms, delivery window, carrier, finance system, brands carried).
 * Per docs/brand-guidelines.md §5 there are deliberately NO customer names, testimonials,
 * counts or percentages on this page — none are evidenced yet. Needs PDT sign-off before launch.
 */
export const da = {
  meta: {
    title: "Profil Design Trading — firmatøj med jeres logo",
    description:
      "Arbejdstøj, profiltøj og firmagaver med jeres logo. Jeres medarbejdere bestiller selv inden for budgettet — I får overblik, korrekt logo og én faktura.",
    langName: "Dansk",
    switchTo: "In English",
    switchToAria: "Skift sprog til engelsk",
  },
  nav: {
    solution: "Løsning",
    how: "Sådan virker det",
    range: "Sortiment",
    esg: "Bæredygtighed",
    contact: "Kontakt",
    cta: "Få et tilbud",
    openMenu: "Åbn menu",
    skipToContent: "Spring til indhold",
  },
  hero: {
    eyebrow: "Be your brand",
    title: "Firmatøj med jeres logo — uden mailtråden.",
    lead: "Arbejdstøj, profiltøj og firmagaver samlet ét sted. Jeres medarbejdere bestiller selv inden for det budget I sætter, og I får overblik, korrekt logo hver gang og én faktura.",
    ctaPrimary: "Få et tilbud",
    ctaSecondary: "Se hvordan det virker",
    figureLabel: "Bryst venstre · broderi · 80 × 35 mm · PMS 186 C",
    figureCaption: "Logospecifikation følger med hver eneste ordre.",
  },
  trust: {
    items: [
      { label: "CVR", value: "35657886" },
      { label: "Showrooms", value: "Vejle · Billund · Fredericia · Skjern" },
      { label: "Levering", value: "2–4 hverdage" },
      { label: "Priser", value: "Ekskl. moms" },
    ],
  },
  problem: {
    eyebrow: "Udfordringen",
    title: "Firmatøj bliver hurtigt til administration.",
    lead: "Jo flere medarbejdere, jo mere tid går der med at holde styr på hvem der har fået hvad — og hvad det kostede.",
    items: [
      {
        title: "Bestillinger på mail og telefon",
        body: "Ordrer ligger spredt i indbakker. Ingen har det fulde billede af hvad der er bestilt, af hvem, til hvilken pris.",
      },
      {
        title: "Regneark i stedet for budget",
        body: "Uden loft pr. medarbejder og uden godkendelse opdages forbruget først, når fakturaen kommer.",
      },
      {
        title: "Logoet sidder forskelligt",
        body: "Placering og metode aftales fra ordre til ordre. Fejlen opdages, når tøjet er trykt.",
      },
      {
        title: "Bilag skal tastes",
        body: "Hver leverance bogføres manuelt. Afstemningen tager tid, og noget mangler altid.",
      },
    ],
  },
  features: {
    eyebrow: "Platformen",
    title: "Alt det administrative — sat i system.",
    lead: "Én platform til bestilling, logo, produktion og fakturering. I bestemmer rammerne; medarbejderne klarer resten selv.",
    items: [
      {
        title: "Jeres egen medarbejder-shop",
        body: "Hver medarbejder logger ind og ser kun det sortiment I har godkendt, til jeres aftalte priser. Tildel point eller et kronebeløb pr. år.",
      },
      {
        title: "Budget og godkendelse",
        body: "Sæt et loft pr. ordre. Køb derover sendes automatisk til nærmeste leder og indkøb, før de går i produktion.",
      },
      {
        title: "Design manual for logoet",
        body: "Placering, metode, størrelse i millimeter og PMS-farver ligger fast pr. kunde. Trykkeren gætter ikke.",
      },
      {
        title: "Korrektur før produktion",
        body: "Se logoet placeret på varen og godkend en visuel korrektur, før noget bliver trykt eller broderet.",
      },
      {
        title: "Produktion og forsendelse",
        body: "Følg ordren fra tryk og broderi over pakning til afsendelse med GLS og track & trace.",
      },
      {
        title: "Fakturering i e-conomic",
        body: "Firmakøb samles pr. kunde og sendes som samlefaktura til e-conomic. Personlige køb holdes helt uden for firmakontoen.",
      },
    ],
  },
  how: {
    eyebrow: "Sådan virker det",
    title: "Tre trin fra aftale til pakke.",
    steps: [
      {
        n: "01",
        title: "Vi sætter shoppen op",
        body: "Vi opretter jeres virksomhed, sammensætter sortimentet med jer og lægger logoet ind som fast specifikation. I godkender priser og budgetrammer.",
      },
      {
        n: "02",
        title: "Medarbejderne bestiller selv",
        body: "De logger ind, vælger størrelse og bestiller inden for deres ramme. Alt derover går til godkendelse hos jer.",
      },
      {
        n: "03",
        title: "Vi producerer og sender",
        body: "Logoet påføres efter jeres design manual, ordren pakkes og sendes med GLS. Fakturaen lander i e-conomic.",
      },
    ],
  },
  suppliers: {
    eyebrow: "Sortiment",
    title: "Mærkerne vi leverer.",
    lead: "Vi leverer arbejdstøj, profiltøj og firmagaver fra blandt andre disse mærker. Sortimentet sammensættes efter jeres behov, jeres branche og jeres budget.",
    brands: [
      "Mascot",
      "Fristads Kansas",
      "Snickers",
      "Engel",
      "ID Identity",
      "Cottover",
      "Clique",
      "TEE JAYS",
      "You",
      "Stormtech",
      "Premier",
      "Samsonite",
    ],
    footnote:
      "Mærkeudvalget kan variere efter kategori og leveringstid. Vi rådgiver om, hvad der passer til opgaven.",
  },
  esg: {
    eyebrow: "CO₂ & ESG",
    title: "Tal I kan bruge i jeres ESG-rapportering.",
    body: "Hvor leverandøren oplyser det, viser vi CO₂ pr. vare og lægger tallene sammen for hele ordren. I kan trække en årlig oversigt over firmatøjets aftryk.",
    disclaimer:
      "Tallene er vejledende og bygger på leverandørernes egne data. Dækningen varierer fra mærke til mærke, og enkelte leverandører oplyser den ikke — de varer vises uden tal frem for med et gæt.",
    points: [
      "CO₂ pr. vare, hvor data findes",
      "Samlet aftryk pr. ordre",
      "Årlig oversigt til rapportering",
    ],
  },
  lead: {
    eyebrow: "Kontakt",
    title: "Få et tilbud på jeres firmatøj.",
    body: "Fortæl kort hvad I har brug for, så vender vi tilbage inden for én arbejdsdag med et forslag.",
    fields: {
      company: "Virksomhed",
      name: "Kontaktperson",
      email: "E-mail",
      phone: "Telefon",
      phoneOptional: "valgfri",
      employees: "Antal medarbejdere",
      message: "Hvad har I brug for?",
    },
    messagePlaceholder:
      "Fx: 25 montører skal have arbejdstøj med logo på bryst og ryg.",
    submit: "Send forespørgsel",
    sending: "Sender…",
    successTitle: "Tak — vi har modtaget din forespørgsel.",
    successBody: "Vi vender tilbage inden for én arbejdsdag.",
    errorTitle: "Forespørgslen blev ikke sendt.",
    errorGeneric: "Noget gik galt undervejs. Prøv igen, eller ring til os.",
    errors: {
      company: "Skriv virksomhedens navn.",
      name: "Skriv hvem vi skal kontakte.",
      email: "Skriv en e-mail vi kan svare på.",
      employees: "Angiv et antal medarbejdere.",
    },
    privacy:
      "Vi bruger kun oplysningerne til at besvare din forespørgsel. Vi videregiver dem ikke.",
  },
  footer: {
    tagline: "Arbejdstøj, profiltøj og firmagaver med jeres logo.",
    showroomsTitle: "Showrooms",
    showrooms: ["Vejle", "Billund", "Fredericia", "Skjern"],
    contactTitle: "Kontakt",
    phoneLabel: "Telefon",
    phone: "22 56 79 80",
    company: "Profil Design Trading ApS",
    cvr: "CVR 35657886",
    rights: "Alle rettigheder forbeholdes.",
    pricesNote: "Alle priser er ekskl. moms.",
  },
  auth: {
    login: {
      title: "Log ind",
      lead: "Log ind på jeres firmashop.",
      email: "E-mail",
      password: "Adgangskode",
      submit: "Log ind",
      submitting: "Logger ind…",
      // Deliberately does not say whether the e-mail exists — that would let
      // anyone test which addresses are registered.
      invalid: "E-mail eller adgangskode passer ikke.",
      generic: "Der opstod en fejl. Prøv igen.",
      needAccount:
        "Har du ikke et login? Din virksomheds administrator opretter dig.",
      backToSite: "← Tilbage til forsiden",
    },
    dashboard: {
      title: "Oversigt",
      signedInAs: "Logget ind som",
      role: "Rolle",
      organisation: "Virksomhed",
      noRole: "Ingen rolle tildelt endnu",
      noOrg: "Ikke tilknyttet en virksomhed endnu",
      pendingSetup:
        "Din bruger er oprettet, men mangler at blive knyttet til en virksomhed og en rolle. Kontakt din administrator.",
      signOut: "Log ud",
    },
    roles: {
      employee: "Medarbejder",
      customer_admin: "Kunde-admin",
      key_account_manager: "Key Account Manager",
      warehouse: "Lager",
      admin: "Administrator",
    },
  },
};

export type Dictionary = typeof da;
