// « Un clic, une couleur » : l'accent de toute l'app tient dans 3 variables.
export interface Accent {
  id: string;
  label: string;
  acc: string; // "r g b"
  deep: string;
  second: string;
  /** dégradé des boutons pleins : texte blanc >= 4,5:1 (WCAG AA) sur les 2 couleurs */
  btn: [string, string];
}

export const ACCENTS: Accent[] = [
  { id: "rose", label: "Rose", acc: "253 43 120", deep: "224 17 95", second: "254 77 79", btn: ["219 26 99", "217 54 60"] },
  { id: "corail", label: "Corail", acc: "255 92 87", deep: "226 60 58", second: "255 152 98", btn: ["214 58 53", "194 84 31"] },
  { id: "violet", label: "Violet", acc: "168 85 247", deep: "137 54 222", second: "236 72 153", btn: ["142 63 214", "194 31 119"] },
  { id: "bissap", label: "Bissap", acc: "214 32 96", deep: "170 18 70", second: "142 45 226", btn: ["184 18 79", "122 53 200"] },
];

const KEY = "niofar_accent";

export function applyAccent(id: string) {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0];
  const root = document.documentElement.style;
  root.setProperty("--acc", a.acc);
  root.setProperty("--acc-deep", a.deep);
  root.setProperty("--acc-2", a.second);
  root.setProperty("--btn-1", a.btn[0]);
  root.setProperty("--btn-2", a.btn[1]);
  try {
    localStorage.setItem(KEY, a.id);
  } catch {
    /* stockage indisponible */
  }
  return a.id;
}

export function savedAccent(): string {
  try {
    return localStorage.getItem(KEY) ?? ACCENTS[0].id;
  } catch {
    return ACCENTS[0].id;
  }
}
