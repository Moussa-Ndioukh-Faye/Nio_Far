interface Props {
  code: string;
  link: string;
}

export function InviteShare({ code, link }: Props) {
  const message = `Rejoins-moi sur NIO FAR\nOn va jouer ensemble ! 🎮 Code : ${code}\n👉 ${link}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div className="card flex flex-col gap-4 p-5">
      <p className="eyebrow text-center">Carte d'invitation</p>
      <p className="text-center font-display text-4xl font-bold tracking-[0.12em] text-saffron">{code}</p>
      <p className="text-center text-sm text-mute">Partage ce code avec ton/ta partenaire — il/elle rejoint avec le lien ci-dessous.</p>
      <div className="flex flex-col gap-2.5">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="btn px-4 text-paper transition hover:brightness-110"
          style={{ background: "linear-gradient(180deg, #2f8f52, #1f7a42)" }}
        >
          Inviter sur WhatsApp
        </a>
        <button
          onClick={() => navigator.clipboard.writeText(link)}
          className="btn-ghost px-4"
        >
          Copier le lien
        </button>
      </div>
    </div>
  );
}