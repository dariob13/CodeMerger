import { cn } from "@/lib/utils"

export function workspaceFileIcon(path: string) {
  return /\.(tsx|jsx)$/i.test(path) ? "1-imgIconFile" : /\.(ts|js|mjs|cjs)$/i.test(path) ? "1-imgIconFile1" : /\.json$/i.test(path) ? "1-imgIconFile3" : /\.md$/i.test(path) ? "1-imgIconFile2" : "2-imgIconFile"
}

// Figma's exported SVGs retain their native dimensions and colours.
export function WorkspaceIcon({ name, className }: { name: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- local vectors must retain Figma's geometry
  return <img alt="" aria-hidden src={`/workspace/${name}.svg`} className={cn("shrink-0", className)} />
}
