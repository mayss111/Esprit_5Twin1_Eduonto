// Contrôle de saisie, calé sur les contraintes de l'ontologie (EduOnto.owl)
// et sur check_id() du back-end : ^[A-Za-z_][A-Za-z0-9_]*$

const ID = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NOM = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’ .\-]{0,59}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE = /^[A-Za-z][A-Za-z0-9]{1,11}$/;
const ISCO = /^\d{4}$/;
const HASH = /^[A-Fa-f0-9]{8,128}$/;

const ENUMS = {
  niveau: ["Débutant", "Intermédiaire", "Avancé"],
  session: ["Principale", "Rattrapage"],
  langue: ["FR", "EN", "AR"],
  modalite: ["Présentiel", "Distanciel", "Hybride"],
  niveauMaitriseAttendu: ["Notions", "Application", "Maîtrise", "Expertise"],
  niveauEtudesRequis: ["Licence", "Master", "Ingénieur", "Doctorat"],
  periodeMesure: ["Hebdomadaire", "Mensuelle", "Semestrielle"],
};

const ENTIERS = {
  anneeEtude: [1, 5],
  nbCredits: [1, 10],
  volumeHoraire: [1, null],
  semestre: [1, 10],
  dureeAnnees: [1, 8],
  nbCreditsTotal: [1, null],
  dureeMinutes: [0, null],
  dureeSemestres: [1, null],
  anneesExperience: [0, null],
  dureeEpreuve: [1, null],
};

const DECIMAUX = {
  note: { min: 0, max: 20 },
  coefficient: { minExclusif: 0 },
  tauxPrecision: { min: 0, max: 1 },
  valeur: { min: 0, max: 1 },
  seuilAlerte: { min: 0, max: 1 },
  salaireMoyenDebutant: { min: 0 },
};

const DATES = new Set([
  "dateEvaluation", "dateInscription", "datePublication", "dateMesure",
  "dateEmission", "dateExpiration", "dateDeploiement",
]);

const BOOLEENS = new Set([
  "estBoursier", "estAccreditee", "estLibreAcces", "estExplicable", "estVerifie", "estEnTension",
]);

const NOMS = new Set(["nom", "prenom"]);
const TEXTES = new Set([
  "intitule", "intituleFormation", "intituleMetier", "titre", "libelleCompetence",
  "libelleDomaine", "nomParcours", "modeleIA", "specialite", "objectifParcours",
]);

export function invalide(erreurs) {
  return Object.values(erreurs).some(Boolean);
}

function brut(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function identifiant(v, { obligatoire = true } = {}) {
  const t = brut(v);
  if (!t) return obligatoire ? "L'identifiant est obligatoire." : "";
  if (!ID.test(t)) {
    return "Lettres, chiffres et _ uniquement, sans espace ni accent, et sans commencer par un chiffre.";
  }
  return "";
}

export function nomPersonne(v, libelle) {
  const t = brut(v);
  if (!t) return `Le ${libelle} est obligatoire.`;
  if (!NOM.test(t)) {
    return `Le ${libelle} ne doit contenir que des lettres, espaces, apostrophes ou tirets.`;
  }
  return "";
}

export function emailOptionnel(v) {
  const t = brut(v);
  if (!t) return "";
  if (!EMAIL.test(t)) return "Adresse e-mail invalide (ex. prenom.nom@esprit.tn).";
  return "";
}

export function urlOptionnelle(v) {
  const t = brut(v);
  if (!t) return "";
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:" || !u.hostname) {
      return "L'URL doit commencer par http:// ou https://.";
    }
  } catch {
    return "URL invalide (ex. https://exemple.tn/cours).";
  }
  return "";
}

export function entier(v, { min, max, obligatoire = true, libelle = "Cette valeur" } = {}) {
  const t = brut(v);
  if (!t) return obligatoire ? `${libelle} est obligatoire.` : "";
  if (!/^-?\d+$/.test(t)) return `${libelle} doit être un nombre entier.`;
  const n = Number(t);
  if (min !== undefined && min !== null && n < min) return `${libelle} doit être au moins ${min}.`;
  if (max !== undefined && max !== null && n > max) return `${libelle} doit être au plus ${max}.`;
  return "";
}

export function decimal(v, { min, max, minExclusif, obligatoire = true, libelle = "Cette valeur" } = {}) {
  const t = brut(v).replace(",", ".");
  if (!t) return obligatoire ? `${libelle} est obligatoire.` : "";
  if (!/^-?\d+(\.\d+)?$/.test(t)) return `${libelle} doit être un nombre.`;
  const n = Number(t);
  if (minExclusif !== undefined && minExclusif !== null && n <= minExclusif) {
    return `${libelle} doit être strictement supérieur à ${minExclusif}.`;
  }
  if (min !== undefined && min !== null && n < min) return `${libelle} doit être au moins ${min}.`;
  if (max !== undefined && max !== null && n > max) return `${libelle} doit être au plus ${max}.`;
  return "";
}

export function codeCours(v) {
  const t = brut(v);
  if (!t) return "";
  if (!CODE.test(t)) return "Code : 2 à 12 caractères, lettres et chiffres, en commençant par une lettre (ex. WEB302).";
  return "";
}

export function codeIsco(v) {
  const t = brut(v);
  if (!t) return "";
  if (!ISCO.test(t)) return "Le code ISCO doit comporter exactement 4 chiffres (ex. 2523).";
  return "";
}

export function telephone(v) {
  const t = brut(v);
  if (!t) return "";
  const chiffres = t.replace(/\D/g, "");
  if (!/^\+?[0-9][0-9 .\-]{6,20}$/.test(t) || chiffres.length < 8 || chiffres.length > 15) {
    return "Numéro de téléphone invalide (8 à 15 chiffres).";
  }
  return "";
}

export function choix(v, liste, libelle, { obligatoire = true } = {}) {
  const t = brut(v);
  if (!t) return obligatoire ? `${libelle} est obligatoire.` : "";
  if (!liste.includes(t)) return `${libelle} : choisir parmi ${liste.join(", ")}.`;
  return "";
}

export function texteLibre(v, { obligatoire = true, min = 2, max = 160, libelle = "Ce champ" } = {}) {
  const t = brut(v);
  if (!t) return obligatoire ? `${libelle} est obligatoire.` : "";
  if (t.length < min) return `${libelle} doit contenir au moins ${min} caractères.`;
  if (t.length > max) return `${libelle} ne doit pas dépasser ${max} caractères.`;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ0-9]/.test(t)) return `${libelle} doit contenir au moins une lettre ou un chiffre.`;
  return "";
}

export function dateIso(v, { obligatoire = false, libelle = "La date" } = {}) {
  const t = brut(v);
  if (!t) return obligatoire ? `${libelle} est obligatoire.` : "";
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(t) || Number.isNaN(Date.parse(t))) {
    return `${libelle} doit être au format AAAA-MM-JJ.`;
  }
  return "";
}

export function booleen(v) {
  const t = brut(v).toLowerCase();
  if (!t) return "";
  if (!["true", "false", "oui", "non", "vrai", "faux", "1", "0"].includes(t)) {
    return "Valeur attendue : oui, non, true ou false.";
  }
  return "";
}

export function relations(v) {
  const t = brut(v);
  if (!t) return "";
  const mauvais = t.split(",").map((s) => s.trim()).filter(Boolean).filter((id) => !ID.test(id));
  if (mauvais.length) {
    return `Identifiant invalide : ${mauvais.join(", ")}. Lettres, chiffres et _, sans espace.`;
  }
  return "";
}

export function controlerAttribut(nom, valeur) {
  const t = brut(valeur);
  if (!t) return "";
  if (NOMS.has(nom)) return nomPersonne(valeur, nom === "prenom" ? "prénom" : "nom");
  if (nom === "email") return emailOptionnel(valeur);
  if (nom === "url" || nom === "urlVerification") return urlOptionnelle(valeur);
  if (nom === "telephone") return telephone(valeur);
  if (nom === "codeCours" || nom === "codeFormation" || nom === "codeCompetence"
      || nom === "codeEvaluation" || nom === "codeParcours" || nom === "codeDomaine") {
    return codeCours(valeur);
  }
  if (nom === "codeISCO") return codeIsco(valeur);
  if (nom === "hashBlockchain") return HASH.test(t) ? "" : "Le hash doit être hexadécimal (8 à 128 caractères).";
  if (nom === "auteur" || nom === "fournisseur" || nom === "emetteur" || nom === "referentiel" || nom === "sourceDonnees") {
    return texteLibre(valeur, { obligatoire: false, min: 2, max: 80, libelle: "Ce champ" });
  }
  if (TEXTES.has(nom)) return texteLibre(valeur, { libelle: "Ce champ" });
  if (ENUMS[nom]) return choix(valeur, ENUMS[nom], "Valeur", { obligatoire: false });
  if (ENTIERS[nom]) {
    const [min, max] = ENTIERS[nom];
    return entier(valeur, { min, max, obligatoire: false, libelle: "Cette valeur" });
  }
  if (DECIMAUX[nom]) return decimal(valeur, { ...DECIMAUX[nom], obligatoire: false, libelle: "Cette valeur" });
  if (DATES.has(nom)) return dateIso(valeur);
  if (BOOLEENS.has(nom)) return booleen(valeur);
  if (t.length > 500) return "Texte trop long (500 caractères maximum).";
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(t)) return "Caractères de contrôle interdits.";
  return "";
}

const CONTROLES_NOMBRE = {
  annee: (v) => entier(v, { min: 1, max: 5, obligatoire: false, libelle: "L'année" }),
  min: (v) => entier(v, { min: 0, obligatoire: false, libelle: "Le minimum" }),
  max: (v) => entier(v, { min: 0, obligatoire: false, libelle: "Le maximum" }),
  seuil: (v) => decimal(v, { min: 0, max: 1, obligatoire: false, libelle: "Le seuil" }),
  noteMin: (v) => decimal(v, { min: 0, max: 20, obligatoire: false, libelle: "La note minimale" }),
};

const PARAMS_LIBRES = new Set(["specialite", "q", "recherche", "langue"]);

export function controlerRequete(url, valeurs) {
  const erreurs = {};
  const chemin = [...url.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  for (const k of chemin) {
    const t = brut(valeurs[k]);
    if (!t) {
      erreurs[k] = "Ce paramètre est obligatoire.";
      continue;
    }
    if (k === "niveau") erreurs[k] = choix(t, ENUMS.niveau, "Le niveau");
    else if (k === "session") erreurs[k] = choix(t, ENUMS.session, "La session");
    else if (!PARAMS_LIBRES.has(k)) erreurs[k] = identifiant(t);
  }
  for (const [k, fn] of Object.entries(CONTROLES_NOMBRE)) {
    if (valeurs[k] === undefined || valeurs[k] === "") continue;
    const e = fn(valeurs[k]);
    if (e) erreurs[k] = e;
  }
  if (valeurs.formation) erreurs.formation = identifiant(valeurs.formation, { obligatoire: false });
  return erreurs;
}
