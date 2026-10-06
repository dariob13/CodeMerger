# Authentication UI preview

Design: https://www.figma.com/design/ZfdmNsLBz7PWNiVJxvumZH?node-id=31-9

The workspace opens without requiring sign-in. A circular account button at the bottom left opens a shadcn/ui dropdown with Log in and Sign up. These open dismissible, responsive dialogs with email/password sign-in, account creation, password visibility, recovery confirmation, and Google/GitHub demo profiles. After sign-in the circle shows the user's initial and opens their account menu with sign-out. These interactions keep the workspace mounted.

Account integration design: https://www.figma.com/design/ZfdmNsLBz7PWNiVJxvumZH?node-id=33-1156

This is a frontend simulation, not authentication. Any valid email and nonempty password can enter the preview; signup additionally validates a name, an eight-character password, and matching confirmation. Passwords are discarded and never persisted. Recovery sends no email, and provider buttons do not contact Google or GitHub.

Only a display profile (name, email, provider) is stored under `codemerger.demo-profile.v1`. “Keep me signed in” uses localStorage; otherwise sessionStorage keeps the preview within the tab. Sign-out removes the profile without deleting projects or chats. Unavailable storage falls back to in-memory state.

Cross-device authentication and conversation syncing require a backend later. The preview does not isolate user data or protect existing APIs. Existing local workspace APIs continue to operate as before after entering the app. No auth endpoints, provider SDKs, or backend integrations were added.

Frontend entry: `app/page.tsx` → `AuthProvider` → `ChatApp`. The sidebar's `AccountMenu` opens `AuthScreen` in a shadcn Dialog. Replace the demo provider with a real session source when backend work is authorized; keep server-side authorization separate from these UI controls.
