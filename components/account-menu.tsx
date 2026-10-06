"use client"

import * as React from "react"
import Image from "next/image"
import { LogInIcon, LogOutIcon, UserPlusIcon } from "lucide-react"
import { useDemoAuth } from "@/components/auth-provider"
import { AuthScreen } from "@/components/auth-gate"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu"

export function AccountMenu() {
  const { profile, ready, signOut, storageWarning } = useDemoAuth()
  const [authScreen, setAuthScreen] = React.useState<"login" | "signup" | null>(null)
  const trigger = React.useRef<HTMLButtonElement>(null)
  return <div className="border-t p-3">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={trigger} variant="outline" size="icon" disabled={!ready} className="size-10 rounded-full bg-secondary" aria-label={profile ? "Open account menu" : "Sign up or log in"} title={profile ? profile.name : "Sign up or log in"}>
          {profile ? <span className="text-sm font-medium">{profile.name.trim().slice(0, 1).toUpperCase()}</span> : <Image src="/auth/account.svg" width={20} height={20} alt="" unoptimized />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        {profile ? <>
          <DropdownMenuLabel className="grid gap-1"><span className="truncate">{profile.name}</span><span className="truncate text-xs font-normal text-muted-foreground">{profile.email}</span></DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="grid gap-1 px-2 py-2 text-xs text-muted-foreground"><p>{profile.provider === "email" ? "Email" : profile.provider} · simulated sign-in</p><p>Saved in this browser. Cloud sync isn’t connected.</p>{storageWarning && <p role="status">{storageWarning}</p>}</div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut}><LogOutIcon />Sign out</DropdownMenuItem>
        </> : <>
          <DropdownMenuLabel>Your CodeMerger account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setAuthScreen("login")}><LogInIcon />Log in</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAuthScreen("signup")}><UserPlusIcon />Sign up</DropdownMenuItem>
        </>}
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={authScreen !== null} onOpenChange={open => !open && setAuthScreen(null)}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto px-6 pb-6 pt-10 sm:max-w-[464px] sm:px-8" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
        <DialogTitle className="sr-only">CodeMerger account</DialogTitle>
        <DialogDescription className="sr-only">Sign up or log in using the frontend authentication preview.</DialogDescription>
        {authScreen && <AuthScreen initialScreen={authScreen} compact onSuccess={() => setAuthScreen(null)} />}
      </DialogContent>
    </Dialog>
  </div>
}
