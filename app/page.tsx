import { ChatApp } from "@/components/chat-app"
import { AuthProvider } from "@/components/auth-provider"

export default function Page() {
  return <AuthProvider><ChatApp /></AuthProvider>
}
