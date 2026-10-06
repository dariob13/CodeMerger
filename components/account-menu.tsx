"use client"

import { ChevronsUpDownIcon, LogOutIcon, UserRoundIcon } from "lucide-react"
import { useDemoAuth } from "@/components/auth-provider"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"

export function AccountMenu() {
  const { profile, signOut, storageWarning } = useDemoAuth()
  if (!profile) return null
  return <div className="border-t p-2"><SidebarMenu><SidebarMenuItem><DropdownMenu><DropdownMenuTrigger asChild><SidebarMenuButton size="lg" aria-label="Open account menu"><div className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary"><UserRoundIcon className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{profile.name}</p><p className="truncate text-xs text-muted-foreground">Preview account</p></div><ChevronsUpDownIcon className="size-4" /></SidebarMenuButton></DropdownMenuTrigger><DropdownMenuContent side="top" align="start" className="w-64"><DropdownMenuLabel className="grid gap-1"><span className="truncate">{profile.name}</span><span className="truncate text-xs font-normal text-muted-foreground">{profile.email}</span></DropdownMenuLabel><DropdownMenuSeparator /><div className="grid gap-1 px-2 py-2 text-xs text-muted-foreground"><p>{profile.provider === "email" ? "Email" : profile.provider} · simulated sign-in</p><p>Saved in this browser. Cloud sync isn’t connected.</p>{storageWarning && <p role="status">{storageWarning}</p>}</div><DropdownMenuSeparator /><DropdownMenuItem onSelect={signOut}><LogOutIcon />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarMenuItem></SidebarMenu></div>
}
