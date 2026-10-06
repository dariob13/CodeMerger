import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata = {
  title: 'Code Merger — Your agents. One place.',
  description: 'One chat for Claude Code, Codex, OpenCode, and Gemini CLI. Switch agents mid-conversation with Code Merger, a local web app for your existing coding CLIs.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Code Merger — Your agents. One place.',
    description: 'Switch perspectives. Keep your context. Stay in flow.',
    type: 'website',
  },
};

export const viewport = { themeColor: '#121212', colorScheme: 'dark' };

export default function RootLayout({ children }) {
  return <html lang="en" className="dark"><body><TooltipProvider delayDuration={180}>{children}<Toaster theme="dark" position="bottom-center" /></TooltipProvider></body></html>;
}
