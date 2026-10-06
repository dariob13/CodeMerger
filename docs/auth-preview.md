# Authentication UI preview

Design: https://www.figma.com/design/ZfdmNsLBz7PWNiVJxvumZH?node-id=31-9

The root app starts with a responsive shadcn/ui sign-in flow. It includes email/password sign-in, account creation, password visibility, recovery confirmation, Google/GitHub demo profiles, and a sidebar account menu with sign-out.

This is a frontend simulation, not authentication. Any valid email and nonempty password can enter the preview; signup additionally validates a name, an eight-character password, and matching confirmation. Passwords are discarded and never persisted. Recovery sends no email, and provider buttons do not contact Google or GitHub.

Only a display profile (name, email, provider) is stored under `codemerger.demo-profile.v1`. “Keep me signed in” uses localStorage; otherwise sessionStorage keeps the preview within the tab. Sign-out removes the profile without deleting projects or chats. Unavailable storage falls back to in-memory state.

Cross-device authentication and conversation syncing require a backend later. The preview does not isolate user data or protect existing APIs. Existing local workspace APIs continue to operate as before after entering the app. No auth endpoints, provider SDKs, or backend integrations were added.

Frontend entry: `app/page.tsx` → `AuthProvider` → `AuthGate` → `ChatApp`. Replace the demo provider with a real session source when backend work is authorized; keep server-side authorization separate from the UI gate.
