// Auto-generated icon registry
// Import all SVG files as raw strings via Vite's ?raw query

const icons = import.meta.glob<string>("./*.svg", { eager: true, query: "?raw", import: "default" });

const iconMap: Record<string, string> = {};

for (const [path, content] of Object.entries(icons)) {
  // Extract filename without extension as the icon name
  const name = path.replace(/^\.\//, "").replace(/\.svg$/, "");
  iconMap[name] = content as string;
}

export function getIcon(name: string): string {
  const svg = iconMap[name];
  if (!svg) {
    console.warn(`[SvgIcon] Icon "${name}" not found in assets/icons/`);
    return "";
  }
  return svg;
}

export function listIcons(): string[] {
  return Object.keys(iconMap);
}
