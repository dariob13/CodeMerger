"use client"

import * as React from "react"
import Image from "next/image"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useDemoAuth } from "@/components/auth-provider"

type Screen = "login" | "signup" | "reset" | "sent" | "Google" | "GitHub"
const control = "h-11 w-full rounded-[10px]"

export function AuthScreen({ initialScreen = "login", compact = false, onSuccess }: { initialScreen?: "login" | "signup"; compact?: boolean; onSuccess?: () => void }) {
  const { signIn } = useDemoAuth()
  const [screen, setScreen] = React.useState<Screen>(initialScreen)
  const [email, setEmail] = React.useState("")
  const [name, setName] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [visible, setVisible] = React.useState(false)
  const [remember, setRemember] = React.useState(false)
  const [error, setError] = React.useState("")
  const heading = React.useRef<HTMLHeadingElement>(null)
  const firstScreen = React.useRef(true)
  React.useEffect(() => {
    if (firstScreen.current) { firstScreen.current = false; return }
    heading.current?.focus()
  }, [screen])
  function navigate(next: Screen) { setScreen(next); setError(""); setPassword(""); setConfirm(""); setVisible(false) }
  const social = screen === "Google" || screen === "GitHub"
  const title = social ? `Continue with ${screen}` : ({ login: "Welcome back", signup: "Create your account", reset: "Forgot your password?", sent: "Recovery preview" } as const)[screen as "login" | "signup" | "reset" | "sent"]
  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    if (social) { signIn({ name: "Alex Morgan", email: "alex@example.test", provider: screen }, remember); onSuccess?.(); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter a valid email address."); return }
    if (screen === "reset") { navigate("sent"); return }
    if (screen === "signup" && !name.trim()) { setError("Enter your name."); return }
    if (!password.trim() || (screen === "signup" && password.length < 8)) { setError(screen === "signup" ? "Use at least 8 characters for your password." : "Enter your password to try the sign-in preview."); return }
    if (screen === "signup" && password !== confirm) { setError("Your passwords don’t match."); return }
    setPassword(""); setConfirm("")
    signIn({ name: screen === "signup" ? name.trim() : email.trim().split("@")[0], email: email.trim(), provider: "email" }, remember)
    onSuccess?.()
  }
  function field(id: string, label: string, value: string, change: (value: string) => void, type = "text", placeholder = "", autoComplete = "") {
    return <div className="grid gap-2"><Label htmlFor={id} className="text-[13px]">{label}</Label><div className="relative"><Input id={id} name={id} value={value} onChange={e => change(e.target.value)} type={type === "password" && visible ? "text" : type} placeholder={placeholder} autoComplete={autoComplete} maxLength={id === "name" ? 80 : 254} className={`${control} bg-card px-3.5 dark:bg-card ${type === "password" ? "pr-11" : ""}`} aria-describedby={error ? "auth-error" : undefined} />{type === "password" && <button type="button" className="absolute right-0 top-0 grid size-11 place-items-center rounded-lg text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}</button>}</div></div>
  }
  return <div className={compact ? "text-foreground" : "min-h-svh bg-background text-foreground"}>
    {!compact && <header className="px-6 pt-10 lg:px-12"><div className="flex h-9 items-center gap-2 px-2 text-[15px] tracking-[-0.3px]"><Image src="/auth/merge.svg" alt="" width={18} height={18} unoptimized /><span className="font-medium">code<span className="font-normal text-muted-foreground">merger</span><span className="font-normal text-subtle">.</span></span></div></header>}
    <div className={compact ? "" : "mx-auto grid max-w-[1440px] grid-cols-1 px-6 pb-12 pt-14 lg:grid-cols-2 lg:px-0 lg:pt-[69px]"}>
      {!compact && <section className="ml-[100px] hidden w-[440px] flex-col gap-6 pt-[140px] lg:flex" aria-label="Your workspace">
        <h2 className="text-[44px] leading-[1.21] font-semibold">One account.<br />Every conversation.</h2>
        <p className="text-base leading-[1.21] text-muted-foreground">Your agents, projects, and conversations —<br />ready whenever you are.</p>
        <div className="grid gap-4 rounded-2xl bg-card p-6"><h3 className="font-medium">Continue where you left off</h3><p className="text-sm leading-[1.21] text-muted-foreground">A single workspace for Claude, Codex,<br />and the work you do together.</p></div>
        <p className="text-xs leading-[1.21] text-muted-foreground">Cross-device sync is planned. This preview saves<br />your sign-in on this browser only.</p>
      </section>}
      <form noValidate onSubmit={submit} className="mx-auto flex w-full max-w-[400px] flex-col gap-5" aria-labelledby="auth-heading">
        {screen === "login" && <p className="text-[11px] font-medium text-muted-foreground">YOUR WORKSPACE</p>}
        <h1 id="auth-heading" ref={heading} tabIndex={-1} className="text-[32px] leading-[1.21] font-semibold outline-none">{title}</h1>
        <p className="text-sm leading-[1.21] text-muted-foreground">{social ? "Google and GitHub authentication aren’t connected yet. Use a demo profile to try the workspace." : screen === "login" ? "Sign in to continue to CodeMerger." : screen === "signup" ? "A home for your conversations and projects." : screen === "reset" ? "Enter your email to preview the recovery flow." : "This is where you’ll receive a reset link once email authentication is connected. No email was sent."}</p>
        {(screen === "login" || screen === "signup") && <>{(["Google", "GitHub"] as const).map(provider => <Button key={provider} type="button" variant="outline" className={`${control} bg-card dark:bg-card`} onClick={() => navigate(provider)}>Continue with {provider}</Button>)}{screen === "login" && <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or with email<span className="h-px flex-1 bg-border" /></div>}</>}
        {screen === "signup" && field("name", "Name", name, setName, "text", "Your name", "name")}
        {!social && screen !== "sent" && field("email", "Email", email, setEmail, "email", "you@example.com", "email")}
        {(screen === "login" || screen === "signup") && field("password", "Password", password, setPassword, "password", screen === "signup" ? "At least 8 characters" : "Enter your password", screen === "signup" ? "new-password" : "current-password")}
        {screen === "signup" && field("confirm", "Confirm password", confirm, setConfirm, "password", "Re-enter your password", "new-password")}
        {social && <div className="grid gap-2"><Label>Demo account</Label><div className="rounded-[10px] border bg-card px-3.5 py-3 text-sm text-muted-foreground">Alex Morgan · alex@example.test</div></div>}
        {(screen === "login" || screen === "signup" || social) && <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><label className="flex cursor-pointer items-center gap-2"><Checkbox checked={remember} onCheckedChange={checked => setRemember(checked === true)} />Keep me signed in</label>{screen === "login" && <button type="button" className="hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" onClick={() => navigate("reset")}>Forgot password?</button>}</div>}
        {error && <p id="auth-error" role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type={screen === "sent" ? "button" : "submit"} className={control} onClick={screen === "sent" ? () => navigate("login") : undefined}>{social ? "Continue in preview" : screen === "login" ? "Sign in" : screen === "signup" ? "Create account" : screen === "reset" ? "Preview reset link" : "Back to sign in"}</Button>
        {screen !== "sent" && <p className="text-[13px] text-muted-foreground">{screen === "login" ? "New here? " : screen === "signup" ? "Already have an account? " : ""}<button type="button" className="hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" onClick={() => navigate(screen === "login" ? "signup" : "login")}>{screen === "login" ? "Create an account" : screen === "signup" ? "Sign in" : "Back to sign in"}</button></p>}
        <p className="text-xs leading-[1.21] text-muted-foreground">Frontend preview. Sign-in is simulated;<br />cloud sync isn’t connected.</p>
      </form>
    </div>
  </div>
}
