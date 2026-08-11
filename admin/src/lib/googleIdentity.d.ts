// Minimal ambient typing for the Google Identity Services script loaded in
// index.html (https://accounts.google.com/gsi/client) — just the surface
// SignInPage.tsx actually uses, not the full API.
interface Window {
  google?: {
    accounts: {
      id: {
        initialize(config: {
          client_id: string;
          callback: (response: { credential: string }) => void;
        }): void;
        renderButton(
          parent: HTMLElement,
          options: { theme?: string; size?: string; text?: string; shape?: string },
        ): void;
      };
    };
  };
}
