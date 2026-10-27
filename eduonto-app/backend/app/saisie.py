"""Contrôle de saisie aligné sur les contraintes de l'ontologie EduOnto."""
import re
from datetime import datetime
from urllib.parse import urlparse

from fastapi import HTTPException

_NOM = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’ .\-]{0,59}$")
_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
_CODE = re.compile(r"^[A-Za-z][A-Za-z0-9]{1,11}$")
_ISCO = re.compile(r"^\d{4}$")
_HASH = re.compile(r"^[A-Fa-f0-9]{8,128}$")
_TEL = re.compile(r"^\+?[0-9][0-9 .\-]{6,20}$")
_LETTRE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ0-9]")

ENUMS = {
    "niveau": {"Débutant", "Intermédiaire", "Avancé"},
    "session": {"Principale", "Rattrapage"},
    "langue": {"FR", "EN", "AR"},
    "modalite": {"Présentiel", "Distanciel", "Hybride"},
    "niveauMaitriseAttendu": {"Notions", "Application", "Maîtrise", "Expertise"},
    "niveauEtudesRequis": {"Licence", "Master", "Ingénieur", "Doctorat"},
    "periodeMesure": {"Hebdomadaire", "Mensuelle", "Semestrielle"},
}

ENTIERS = {
    "anneeEtude": (1, 5),
    "nbCredits": (1, 10),
    "volumeHoraire": (1, None),
    "semestre": (1, 10),
    "dureeAnnees": (1, 8),
    "nbCreditsTotal": (1, None),
    "dureeMinutes": (0, None),
    "dureeSemestres": (1, None),
    "anneesExperience": (0, None),
    "dureeEpreuve": (1, None),
}

# (min inclusif, max inclusif, min exclusif)
DECIMAUX = {
    "note": (0, 20, None),
    "coefficient": (None, None, 0),
    "tauxPrecision": (0, 1, None),
    "valeur": (0, 1, None),
    "seuilAlerte": (0, 1, None),
    "salaireMoyenDebutant": (0, None, None),
}

DATES = {
    "dateEvaluation", "dateInscription", "datePublication", "dateMesure",
    "dateEmission", "dateExpiration", "dateDeploiement",
}

BOOLEENS = {"estBoursier", "estAccreditee", "estLibreAcces", "estExplicable", "estVerifie", "estEnTension"}
NOMS = {"nom", "prenom"}
TEXTES = {
    "intitule", "intituleFormation", "intituleMetier", "titre", "libelleCompetence",
    "libelleDomaine", "nomParcours", "modeleIA", "specialite", "objectifParcours",
}
CODES = {"codeCours", "codeFormation", "codeCompetence", "codeEvaluation", "codeParcours", "codeDomaine"}
COURTS = {"auteur", "fournisseur", "emetteur", "referentiel", "sourceDonnees"}
URLS = {"url", "urlVerification"}


def refuser(message: str):
    raise HTTPException(400, message)


def _texte(valeur) -> str:
    if isinstance(valeur, bool):
        return "true" if valeur else "false"
    if isinstance(valeur, float) and valeur.is_integer():
        return str(int(valeur))
    return str(valeur).strip()


def _entier(valeur, minimum, maximum, libelle="Cette valeur"):
    texte = _texte(valeur).replace(",", ".")
    if not re.fullmatch(r"-?\d+", texte):
        refuser(f"{libelle} doit être un nombre entier.")
    n = int(texte)
    if minimum is not None and n < minimum:
        refuser(f"{libelle} doit être au moins {minimum}.")
    if maximum is not None and n > maximum:
        refuser(f"{libelle} doit être au plus {maximum}.")


def _decimal(valeur, minimum, maximum, min_exclusif, libelle="Cette valeur"):
    texte = _texte(valeur).replace(",", ".")
    if not re.fullmatch(r"-?\d+(\.\d+)?", texte):
        refuser(f"{libelle} doit être un nombre.")
    n = float(texte)
    if min_exclusif is not None and n <= min_exclusif:
        refuser(f"{libelle} doit être strictement supérieur à {min_exclusif}.")
    if minimum is not None and n < minimum:
        refuser(f"{libelle} doit être au moins {minimum}.")
    if maximum is not None and n > maximum:
        refuser(f"{libelle} doit être au plus {maximum}.")


def _texte_libre(valeur, minimum=2, maximum=160, libelle="Ce champ"):
    texte = _texte(valeur)
    if len(texte) < minimum:
        refuser(f"{libelle} doit contenir au moins {minimum} caractères.")
    if len(texte) > maximum:
        refuser(f"{libelle} ne doit pas dépasser {maximum} caractères.")
    if not _LETTRE.search(texte):
        refuser(f"{libelle} doit contenir au moins une lettre ou un chiffre.")


def verifier_attribut(prop: str, valeur) -> None:
    """Refuse une valeur incompatible avec la propriété. Une valeur vide est ignorée."""
    if valeur is None:
        return
    if isinstance(valeur, bool) and prop in BOOLEENS:
        return
    texte = _texte(valeur)
    if texte == "":
        return

    if prop in NOMS:
        if not _NOM.fullmatch(texte):
            refuser("Le nom ou le prénom ne doit contenir que des lettres, espaces, apostrophes ou tirets.")
        return
    if prop == "email":
        if not _EMAIL.fullmatch(texte):
            refuser("Adresse e-mail invalide (ex. prenom.nom@esprit.tn).")
        return
    if prop in URLS:
        u = urlparse(texte)
        if u.scheme not in ("http", "https") or not u.netloc:
            refuser("URL invalide : elle doit commencer par http:// ou https://.")
        return
    if prop == "telephone":
        chiffres = re.sub(r"\D", "", texte)
        if not _TEL.fullmatch(texte) or not 8 <= len(chiffres) <= 15:
            refuser("Numéro de téléphone invalide (8 à 15 chiffres).")
        return
    if prop in CODES:
        if not _CODE.fullmatch(texte):
            refuser("Code invalide : 2 à 12 caractères, lettres et chiffres, en commençant par une lettre.")
        return
    if prop == "codeISCO":
        if not _ISCO.fullmatch(texte):
            refuser("Le code ISCO doit comporter exactement 4 chiffres (ex. 2523).")
        return
    if prop == "hashBlockchain":
        if not _HASH.fullmatch(texte):
            refuser("Le hash doit être hexadécimal (8 à 128 caractères).")
        return
    if prop in COURTS:
        _texte_libre(texte, 2, 80)
        return
    if prop in TEXTES:
        _texte_libre(texte)
        return
    if prop in ENUMS:
        if texte not in ENUMS[prop]:
            refuser(f"Valeur inconnue pour {prop} : choisir parmi {', '.join(sorted(ENUMS[prop]))}.")
        return
    if prop in ENTIERS:
        _entier(valeur, *ENTIERS[prop])
        return
    if prop in DECIMAUX:
        _decimal(valeur, *DECIMAUX[prop])
        return
    if prop in DATES:
        try:
            datetime.fromisoformat(texte)
        except ValueError:
            refuser("La date doit être au format AAAA-MM-JJ.")
        return
    if prop in BOOLEENS:
        if texte.lower() not in {"true", "false", "oui", "non", "vrai", "faux", "1", "0"}:
            refuser("Valeur booléenne attendue : oui, non, true ou false.")
        return
    if len(texte) > 500:
        refuser("Texte trop long (500 caractères maximum).")
    if any(ord(c) < 32 and c not in "\t" for c in texte):
        refuser("Caractères de contrôle interdits.")
