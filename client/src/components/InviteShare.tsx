interface Props {
  code: string;
  link: string;
}

export function InviteShare({ code, link }: Props) {
  const message = `Rejoins-moi sur NIO FAR ❤️\nOn va jouer ensemble !\n🎮 Code : ${code}\n👉 ${link}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div className="flex flex-col gap-3">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-xl bg-green-600 px-4 py-3 text-center font-semibold text-white hover:bg-green-500"
      >
        Inviter sur WhatsApp ❤️
      </a>
      <button
        onClick={() => navigator.clipboard.writeText(link)}
        className="rounded-xl border border-neutral-700 px-4 py-3 text-center font-medium text-neutral-200 hover:bg-neutral-800"
      >
        Copier le lien
      </button>
    </div>
  );
}
