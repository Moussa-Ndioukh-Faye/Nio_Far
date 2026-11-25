import { useState } from "react";
import { Link } from "react-router-dom";
import { Mark } from "../components/Mark";
import { SERVER_URL } from "../socket";
import { getDeviceId } from "../data/catalog";

const LOCAL_KEYS = ["niofar_session", "niofar_name", "niofar_device", "niofar_favorites", "niofar_difficulty", "niofar_accent", "niofar_adult"];

/**
 * Politique de confidentialité — RGPD (UE 2016/679) et loi sénégalaise
 * n° 2008-12 sur la protection des données à caractère personnel (CDP).
 * Rédigée simplement : qui, quoi, pourquoi, combien de temps, quels droits.
 */
export function Privacy() {
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function eraseAll() {
    setStatus("busy");
    try {
      const res = await fetch(`${SERVER_URL}/api/me?deviceId=${encodeURIComponent(getDeviceId())}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      for (const k of LOCAL_KEYS) localStorage.removeItem(k);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pb-10 pt-8">
      <header className="mb-8 flex items-center justify-between">
        <Link to="/" className="flex min-h-11 items-center gap-3 text-sm text-sand hover:text-paper">
          <Mark size={36} />
          <span>← Retour à l'accueil</span>
        </Link>
      </header>

      <main className="card prose-sm flex flex-col gap-6 p-6 leading-relaxed text-sand sm:p-8">
        <h1 className="font-display text-3xl font-bold text-paper">Confidentialité</h1>
        <p>
          NIO FAR est un jeu pour couples. On collecte <strong className="text-paper">le strict minimum</strong> pour que la partie
          fonctionne. Pas de compte, pas de publicité, pas de revente, pas de traceur.
        </p>

        <Section title="Qui est responsable ?">
          <p>
            Moussa Ndioukh Faye, éditeur de NIO FAR (Dakar, Sénégal). Contact :{" "}
            <a className="text-saffron underline underline-offset-2" href="mailto:fayemoussandioukh@gmail.com">
              fayemoussandioukh@gmail.com
            </a>
          </p>
        </Section>

        <Section title="Quelles données, et pourquoi ?">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-paper">Ton prénom</strong> (celui que tu tapes) : pour l'afficher à ton/ta partenaire.
            </li>
            <li>
              <strong className="text-paper">Tes réponses, tes messages et vos scores</strong> : pour faire tourner la partie et vous
              montrer le résultat.
            </li>
            <li>
              <strong className="text-paper">Un identifiant d'appareil anonyme</strong> (tiré au hasard, sans lien avec ton identité) :
              pour retrouver l'historique de tes parties sur ce téléphone et reprendre une partie après une coupure.
            </li>
          </ul>
          <p>
            Base légale : l'exécution du service que tu demandes en lançant une partie. On ne demande ni e-mail, ni numéro, ni
            photo, ni localisation.
          </p>
        </Section>

        <Section title="Combien de temps ?">
          <p>
            Les parties sont <strong className="text-paper">supprimées automatiquement après 30 jours</strong>, avec les prénoms,
            réponses et messages qu'elles contiennent. Une partie en cours vit au plus 6 heures en mémoire.
          </p>
        </Section>

        <Section title="Où sont les données ?">
          <p>
            Le site est servi par Netlify et le serveur de jeu par Render (base PostgreSQL), qui peuvent héberger les données
            hors du Sénégal. Les échanges sont chiffrés (HTTPS / WSS).
          </p>
        </Section>

        <Section title="Sur ton téléphone">
          <p>
            L'app enregistre dans ton navigateur (stockage local, pas de cookie) ton prénom, tes favoris, ta couleur, le niveau
            choisi et la partie en cours. Rien de tout ça ne sert à te suivre.
          </p>
        </Section>

        <Section title="Contenu réservé aux adultes">
          <p>
            Le niveau <strong className="text-paper">Intense</strong> et la catégorie <strong className="text-paper">Flirt</strong> sont
            réservés aux personnes de 18 ans et plus : l'app te le demande avant de lancer ces parties.
          </p>
        </Section>

        <Section title="Tes droits">
          <p>
            Tu peux demander l'accès, la rectification ou l'effacement de tes données, ou t'opposer à leur traitement, en écrivant à
            l'adresse ci-dessus. Tu peux aussi saisir la{" "}
            <a className="text-saffron underline underline-offset-2" href="https://www.cdp.sn" target="_blank" rel="noreferrer">
              Commission de protection des données personnelles (CDP)
            </a>{" "}
            au Sénégal, ou l'autorité de ton pays.
          </p>
          <div className="glass mt-2 flex flex-col gap-3 rounded-2xl p-4">
            <p className="text-paper">Tout effacer maintenant</p>
            <p className="text-sm">
              Supprime du serveur tes fiches joueur, réponses et messages liés à ce téléphone, puis vide le stockage local.
            </p>
            <button onClick={eraseAll} disabled={status === "busy" || status === "done"} className="btn-clay self-start">
              {status === "busy" ? "Suppression…" : status === "done" ? "Données effacées ✓" : "Effacer mes données"}
            </button>
            <p role="status" className="text-sm">
              {status === "done" && "C'est fait : il ne reste rien de toi sur le serveur ni sur ce téléphone."}
              {status === "error" && <span className="text-bissap">Le serveur ne répond pas. Réessaie ou écris-nous.</span>}
            </p>
          </div>
        </Section>

        <p className="text-xs text-mute">Dernière mise à jour : novembre 2026.</p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-xl font-semibold text-paper">{title}</h2>
      {children}
    </section>
  );
}
