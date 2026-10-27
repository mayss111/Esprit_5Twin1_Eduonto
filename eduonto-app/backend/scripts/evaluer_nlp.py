"""Évaluation du module NLP sur un jeu de questions annotées (tests/questions_test.json).

Lancement (depuis le dossier backend) :
    python scripts/evaluer_nlp.py                              # mots-clés seuls, + fautes de frappe si rapidfuzz
    EDUONTO_EMB=1 EDUONTO_HF=1 python scripts/evaluer_nlp.py   # + embeddings + zero-shot (si installés)

Pour chaque configuration disponible (mots-clés seuls / + rapidfuzz / + sentence-transformers / + zero-shot),
le script mesure l'exactitude de l'intention et des paramètres, puis écrit le détail de la configuration
la plus complète (par intention, par catégorie, matrice des erreurs) dans tests/rapport_nlp.md.
"""
import argparse
import json
import sys
import time
from collections import Counter
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app import store                       # noqa: E402
from app.nlp.translator import Translator   # noqa: E402

ALIAS = {"evaluations_note_superieure": "evaluations_note"}   # ancien nom de l'intention (code initial)


def configurations(t):
    """Configurations disponibles, de la plus simple à la plus complète : (nom, attributs du traducteur)."""
    fuzzy, emb, zs = getattr(t, "fuzzy", None), getattr(t, "embedder", None), getattr(t, "zero_shot", None)
    confs = [("mots-clés seuls", {"fuzzy": None, "embedder": None, "zero_shot": None})]
    if fuzzy:
        confs.append(("+ fautes de frappe (rapidfuzz)", {"fuzzy": fuzzy, "embedder": None, "zero_shot": None}))
    if emb:
        confs.append(("+ embeddings (sentence-transformers)", {"fuzzy": fuzzy, "embedder": emb, "zero_shot": None}))
    if zs:
        confs.append(("+ zero-shot (Hugging Face)", {"fuzzy": fuzzy, "embedder": emb, "zero_shot": zs}))
    return confs


def traduire(t, cas):
    try:
        return t.translate(cas["question"], cas.get("contexte"))
    except TypeError:                                   # ancien traducteur : pas de contexte
        return t.translate(cas["question"])


def egal(obtenu, attendu):
    if isinstance(attendu, (int, float)) and isinstance(obtenu, (int, float)):
        return float(obtenu) == float(attendu)
    return obtenu == attendu


def evaluer(t, jeu):
    lignes = []
    for cas in jeu:
        debut = time.perf_counter()
        r = traduire(t, cas)
        duree = (time.perf_counter() - debut) * 1000
        obtenu = ALIAS.get(r.get("intention"), r.get("intention"))
        params = r.get("parametres") or {}
        ok = obtenu == cas["intention"]
        lignes.append({"cas": cas, "obtenu": obtenu, "parametres": params, "methode": r.get("methode"),
                       "ok": ok, "complet": ok and all(egal(params.get(k), v) for k, v in cas["parametres"].items()),
                       "ms": duree})
    return lignes


def pct(n, total):
    return f"{100 * n / total:.1f} %" if total else "—"


def rapport(resultats, jeu, avant=None, absentes=()):
    total = len(jeu)
    md = ["# Évaluation du module NLP (question → intention → SPARQL)", "",
          f"Jeu de test : `tests/questions_test.json` — **{total} questions** rédigées différemment des exemples "
          "(membres 1 à 4 + commun), dont fautes de frappe, comparaisons, valeurs d'énumération et suites de conversation.",
          "", "- **Intention** : la bonne intention est choisie.",
          "- **Intention + paramètres** : l'intention ET tous les paramètres attendus (entité, nombre, opérateur, valeur) sont corrects.",
          "", "## Comparaison des configurations", "",
          "| Configuration | Intention | Intention + paramètres | Temps moyen |", "|---|---|---|---|"]
    if avant:
        for nom, v in avant.items():
            md.append(f"| Avant améliorations — {nom} | {v['intention']} | {v['complet']} | {v['ms']} |")
    for nom, lignes in resultats.items():
        md.append(f"| {nom} | {pct(sum(l['ok'] for l in lignes), total)} | "
                  f"{pct(sum(l['complet'] for l in lignes), total)} | {sum(l['ms'] for l in lignes) / total:.0f} ms |")
    if absentes:
        md += ["", "Configurations non mesurées (module non installé ou non activé) : " + ", ".join(absentes) + "."]

    nom, lignes = list(resultats.items())[-1]
    md += ["", f"## Détail de la configuration la plus complète : {nom}", "", "### Par catégorie de question", "",
           "| Catégorie | Questions | Intention | Intention + paramètres |", "|---|---|---|---|"]
    for cat in sorted({l["cas"].get("categorie", "—") for l in lignes}):
        sel = [l for l in lignes if l["cas"].get("categorie", "—") == cat]
        md.append(f"| {cat} | {len(sel)} | {pct(sum(l['ok'] for l in sel), len(sel))} | "
                  f"{pct(sum(l['complet'] for l in sel), len(sel))} |")

    md += ["", "### Par intention", "", "| Intention attendue | Questions | Intention | Intention + paramètres |",
           "|---|---|---|---|"]
    for intention in sorted({l["cas"]["intention"] for l in lignes}):
        sel = [l for l in lignes if l["cas"]["intention"] == intention]
        md.append(f"| `{intention}` | {len(sel)} | {pct(sum(l['ok'] for l in sel), len(sel))} | "
                  f"{pct(sum(l['complet'] for l in sel), len(sel))} |")

    erreurs = [l for l in lignes if not l["complet"]]
    md += ["", "### Matrice des erreurs (attendue → obtenue)", ""]
    if not erreurs:
        md.append("Aucune erreur.")
    else:
        paires = Counter((l["cas"]["intention"], l["obtenu"] or "non comprise") for l in erreurs if not l["ok"])
        lignes_m = sorted({a for a, _ in paires})
        colonnes = sorted({o for _, o in paires})
        if paires:
            md.append("| attendue \\ obtenue | " + " | ".join(f"`{c}`" for c in colonnes) + " |")
            md.append("|---" * (len(colonnes) + 1) + "|")
            for a in lignes_m:
                md.append(f"| `{a}` | " + " | ".join(str(paires.get((a, c), "")) for c in colonnes) + " |")
        md += ["", "| Question | Attendu | Obtenu | Méthode |", "|---|---|---|---|"]
        for l in erreurs:
            att = f"{l['cas']['intention']} {json.dumps(l['cas']['parametres'], ensure_ascii=False)}"
            obt = f"{l['obtenu']} {json.dumps(l['parametres'], ensure_ascii=False)}"
            md.append(f"| {l['cas']['question']} | {att} | {obt} | {l['methode'] or '—'} |")
    return "\n".join(md) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--jeu", default=str(BACKEND / "tests" / "questions_test.json"))
    parser.add_argument("--rapport", default=str(BACKEND / "tests" / "rapport_nlp.md"))
    parser.add_argument("--sortie-json", help="écrit aussi un résumé JSON (pour comparer avant / après)")
    parser.add_argument("--avant", help="résumé JSON d'une évaluation précédente, ajouté au tableau comparatif")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    jeu = json.loads(Path(args.jeu).read_text(encoding="utf-8"))
    store.load()
    t = Translator()
    origine = {k: getattr(t, k, None) for k in ("fuzzy", "embedder", "zero_shot")}
    resultats = {}
    for nom, reglages in configurations(t):
        for k, v in reglages.items():
            setattr(t, k, v)
        resultats[nom] = evaluer(t, jeu)
    for k, v in origine.items():
        setattr(t, k, v)

    avant = json.loads(Path(args.avant).read_text(encoding="utf-8")) if args.avant else None
    absentes = [n for n, k in (("embeddings (EDUONTO_EMB=1)", "embedder"), ("zero-shot (EDUONTO_HF=1)", "zero_shot"))
                if origine[k] is None]
    texte = rapport(resultats, jeu, avant, absentes)
    Path(args.rapport).write_text(texte, encoding="utf-8")
    print(texte)
    print(f"Rapport écrit dans {args.rapport}")
    if args.sortie_json:
        total = len(jeu)
        resume = {nom: {"intention": pct(sum(l["ok"] for l in ls), total),
                        "complet": pct(sum(l["complet"] for l in ls), total),
                        "ms": f"{sum(l['ms'] for l in ls) / total:.0f} ms"} for nom, ls in resultats.items()}
        Path(args.sortie_json).write_text(json.dumps(resume, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
