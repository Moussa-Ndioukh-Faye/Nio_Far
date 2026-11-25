import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  code: string;
  link: string;
}

export function InviteShare({ code, link }: Props) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const message = `Rejoins-moi sur NIO FAR 💞\nOn joue ensemble ? Code : ${code}\n👉 ${link}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy(what: "link" | "code") {
    try {
      await navigator.clipboard.writeText(what === "link" ? link : code);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* presse-papiers indisponible (http non sécurisé) */
    }
  }

  return (
    <div className="card relative flex flex-col gap-4 overflow-hidden p-6">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-saffron/10 blur-2xl" />
      <p className="eyebrow text-center">Carte d'invitation</p>
      <button
        onClick={() => copy("code")}
        className="group mx-auto rounded-2xl border border-dashed border-saffron/50 px-5 py-3 transition hover:bg-saffron/5"
      >
        <span className="font-display text-4xl font-bold tracking-[0.14em] text-saffron">{code}</span>
        <span aria-live="polite" className="mt-1 block text-xs uppercase tracking-widest text-mute group-hover:text-sand">
          {copied === "code" ? "Code copié ✓" : "Toucher pour copier"}
        </span>
      </button>
      <p className="text-center text-sm text-sand">Envoie le lien à ton/ta partenaire : il/elle arrive directement dans la partie.</p>
      <div className="flex flex-col gap-2.5">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="btn px-4 text-paper shadow-[0_12px_30px_-14px_rgba(37,211,102,0.6)] transition hover:brightness-110"
          style={{ background: "linear-gradient(180deg, #2f8f52, #1f7a42)" }}
        >
          Inviter sur WhatsApp
        </a>
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => copy("link")} className="btn-ghost px-3 text-sm">
            <motion.span key={copied === "link" ? "ok" : "copy"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              {copied === "link" ? "Lien copié ✓" : "Copier le lien"}
            </motion.span>
          </button>
          {canShare ? (
            <button
              onClick={() => navigator.share({ title: "NIO FAR", text: message, url: link }).catch(() => {})}
              className="btn-ghost px-3 text-sm"
            >
              Partager…
            </button>
          ) : (
            <button onClick={() => copy("code")} className="btn-ghost px-3 text-sm">
              Copier le code
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
