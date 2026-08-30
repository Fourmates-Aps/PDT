/**
 * Handelsbetingelser — Profil Design Trading ApS.
 *
 * Ported verbatim from profildesigntrading.dk/handelsbetingelser. Legal text is
 * the one kind of content that must NOT be improved in transit: paraphrasing a
 * term changes what the company is bound by. It lives here as data rather than
 * in the dictionaries because it is a document, not interface copy.
 *
 * The Danish version is authoritative. There is deliberately no English
 * translation: producing one would create a second legal text that nobody has
 * reviewed, and a customer reading it could reasonably rely on it. The English
 * page shows this document with a note saying which version governs.
 *
 * ⚠ TODO(legal): four defects were carried over from the live site unchanged,
 * because correcting a published term is the client's decision, not ours:
 *
 *  1. §Reklamationsret names "JA Profil" twice — a different company. Almost
 *     certainly left over from a template.
 *  2. §Persondatapolitik says "Profil esign" — a typo for Profil Design.
 *  3. §Betaling states every amount on the site includes VAT. The site's own
 *     header, and this platform's footer, both say prices are shown EXCLUDING
 *     VAT. For a B2B shop the header is right and this line is wrong.
 *  4. §Persondatapolitik states customer data is NOT stored or transmitted
 *     encrypted, one paragraph after describing SSL encryption. Whichever is
 *     true, the two cannot both be, and the sentence as written is a GDPR
 *     problem in itself.
 */

export type TermsSection = {
  /** Anchor id, so a specific clause can be linked to. */
  id: string;
  heading: string;
  /** Paragraphs. A leading "- " marks a list item. */
  body: string[];
};

const ADDRESSES = [
  "- Bugattivej 9 – 7100 Vejle",
  "- Snaremosevej 23F – 7000 Fredericia",
  "- Montanavej 9, 7190 Billund",
  "- Bredgade 13a – 6900 Skjern",
];

export const TERMS_UPDATED = "2026-08-30";

export const TERMS: TermsSection[] = [
  {
    id: "generelle-oplysninger",
    heading: "Generelle oplysninger",
    body: [
      "Profil Design Trading ApS",
      "CVR-nr. 35657886",
      ...ADDRESSES,
      "Kontakt oplysninger: info@profiltrading.dk",
      "Telefonnummer: 22 56 79 80",
    ],
  },
  {
    id: "betaling",
    heading: "Betaling",
    body: [
      "Profil Design Trading modtager online betalinger med; Visa/Dankort, Mastercard og Mobilepay.",
      "Betaling vil først blive trukket på din konto, når den fysiske vare afsendes eller det virtuelle produkt er oprettet med mindre andet er aftalt eller fremgår af din ordre.",
      "Ved betaling med Visa Electron og Mastercard Debit, som er debitkort, vil betalingen blive reserveret på din konto i overensstemmelse med vilkårene for dit kort, indtil vi trækker eller afviser betalingen.",
      "Alle beløb på hjemmesiden er inklusiv moms.",
      "Hjemmesiden bruger følgende valutaer til prissætning: Denmark – Kroner (DKK)",
      "Profil Design benytter en sikker betalingsserver, der krypterer alle oplysninger med SSL protokol hvilket betyder din data er sikker og ikke kan læses af andre udefrakommende.",
      "Profil Design's egen hjemmeside bruger ligeledes kryptering med SSL protokol.",
    ],
  },
  {
    id: "fragt",
    heading: "Fragt",
    body: [
      "Leveringstiden for din ordre er 2-6 hverdage.",
      "Leverings område: Vi leverer til alle lande inden for EU og EØS.",
      "Profil Design afsender varer med følgende: GLS – GLS Erhverv, GLS Pakkeshop og GLS Privat.",
      "Fragten bliver beregnet ud fra vægt.",
      "Du vil kunne vælge i mellem at få pakken sendt „uden omdeling“ eller „med omdeling“.",
      "Du vil altid modtage et track and trace nr. så du kan følge din pakke, fra vores lager og hjem til dig.",
    ],
  },
  {
    id: "fortrydelsesret",
    heading: "Fortrydelsesret",
    body: [
      "Der gives 14 dages fuld fortrydelsesret på varer købt på hjemmesiden med mindre andet er aftalt eller fremgår af din ordre.",
      "Den 14 dages periode starter den dag hvor ordren er leveret.",
      "Eventuelle returneringsomkostninger afholder du selv.",
      "Ønske om fortrydelse skal meddeles os senest 14 dage efter leveringen og være os i hænde senest 14 dage efter vi er informeret om dit brug af fortrydelsesretten.",
      "Ønske om brug af fortrydelsesret skal sendes på mail info@profiltrading.dk",
      "Du hæfter for den forringelse af varens værdi, som skyldes anden håndtering, end hvad der er nødvendigt for at fastslå varens art, egenskaber og funktion. Dette betyder at du må prøve varen på samme måde som hvis du handlede i en fysisk butik.",
      "Hvis varen er prøvet udover, hvad der er beskrevet ovenfor, betragtes den som brugt og af forringet værdi. Dette betyder, at du ved fortrydelse af købet får en mindre del eller intet af købsbeløbet retur. Det er op til Profil Design Trading at vurdere varens stand.",
    ],
  },
  {
    id: "reklamationsret",
    heading: "Reklamationsret",
    body: [
      "Der gives 2 års reklamationsret på produkter i henhold til den danske købelov. Reklamationsretten gælder for alle fejl i software, materiale og fabrikation.",
      "Reklamation vedr. fejl og mangler skal meddeles til JA Profil i rimelig tid efter varens modtagelse. Her anses max. to måneder som rimelig tid, med mindre andet er aftalt. Vi refunderer rimelige fragtomkostninger.",
      "Reklamationen frafalder ved forkert eller ualmindelig betjening af produktet.",
      "JA Profil dækker returneringsomkostningerne i rimeligt omfang.",
      "Ved returnering kontaktes virksomheden:",
      "Profil Design Trading ApS",
      "CVR-nr. 35657886",
      ...ADDRESSES,
      "Kontakt oplysninger: info@profiltrading.dk",
      "Telefonnummer: 22 56 79 80",
      "Reklamationer modtages ikke hvis disse er sendt på efterkrav.",
    ],
  },
  {
    id: "persondatapolitik",
    heading: "Persondatapolitik",
    body: [
      "Vi videresælger ikke personlige oplysninger og videregiver ikke dine personlige oplysninger til andre, de er kun registreret i vores kundekartotek. Du kan til enhver tid få slettet dine oplysninger.",
      "For at du kan indgå aftale med Profil esign, har vi brug for følgende oplysninger:",
      "- Navn",
      "- Adresse",
      "- Telefonnummer",
      "- E-mail adresse",
      "Vi foretager registreringen af dine personoplysninger med det formål, at kunne levere varen til dig.",
      "Personoplysningerne registreres hos Profil Design og opbevares i op til fem år, hvorefter oplysningerne slettes.",
      "Når der indsamles personoplysninger via vores hjemmeside, sikrer vi, at det altid sker ved afgivelse af dit udtrykkelige samtykke, således at du er informeret om præcis, hvilke oplysninger, der indsamles og hvorfor.",
      "Direktøren og de ansatte for Profil Design har adgang til de oplysninger, der registreres om dig.",
      "Den dataansvarlige i Profil Design er: Allan Berthelsen",
      "Vi opbevarer og transmitterer ikke kundeoplysninger krypteret.",
      "Som registreret hos Profil Design har du altid ret til at gøre indsigelse mod registreringen. Du har også ret til indsigt i, hvilke oplysninger, der er registreret om dig. Disse rettigheder har du efter Persondataloven og henvendelse i forbindelse hermed rettes til info@profiltrading.dk",
    ],
  },
  {
    id: "klageadgang",
    heading: "Klageadgang",
    body: [
      "Ved klage skal vores e-mail adresse angives: info@profiltrading.dk samt hjemmesiden du har købt varen på.",
      "En klage over en vare eller tjenesteydelse kan indgives til Center for Klageløsning, Nævnenes Hus, Toldboden 2, 8800 Viborg.",
      "Du kan klage til Center for Klageløsning via Klageportalen for Nævnenes Hus.",
      "Har du bopæl i et andet EU-land end Danmark, kan du klage til EU-Kommissionens online klageportal her — http://ec.europa.eu/odr",
    ],
  },
  {
    id: "standardfortrydelsesformular",
    heading: "Standardfortrydelsesformular",
    body: [
      "(denne formular udfyldes og returneres kun, hvis fortrydelsesretten gøres gældende)",
      "– Til Profil Design Trading ApS, Bugattivej 9, 7100 Vejle, info@profiltrading.dk:",
      "– Jeg/vi (*) meddeler herved, at jeg/vi (*) ønsker at gøre fortrydelsesretten gældende i forbindelse med min/vores (*) købsaftale om følgende varer (*)/levering af følgende tjenesteydelser (*)",
      "– Bestilt den (*)/modtaget den (*)",
      "– Forbrugerens navn (Forbrugernes navne)",
      "– Forbrugerens adresse (Forbrugernes adresse)",
      "– Forbrugerens underskrift (Forbrugernes underskrifter) (kun hvis formularens indhold meddeles på papir)",
      "– Dato",
      "(*) Det ufornødne overstreges.",
    ],
  },
];
