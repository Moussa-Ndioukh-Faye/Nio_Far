interface Props {
  name: string;
  isConnected: boolean;
}

export function PresenceBadge({ name, isConnected }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1.5">
      <span>{isConnected ? "🟢" : "🔴"}</span>
      <span className="text-sm font-medium">{name}</span>
    </div>
  );
}
