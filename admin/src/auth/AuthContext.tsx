import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { auth } from "../lib/firebase";

interface AuthContextValue {
  user: User | null;
  // null while `user` is null or the admin check hasn't resolved yet —
  // distinct from `false` (checked, definitely not an admin) so the UI can
  // tell "still loading" from "access denied."
  isAdmin: boolean | null;
  loading: boolean;
  // Exchanges a Google Identity Services ID token for a Firebase session —
  // see SignInPage.tsx for where the token actually comes from.
  signInWithGoogleCredential: (idToken: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setIsAdmin(null);
        setLoading(false);
        return;
      }
      // Force a refresh: the admin custom claim is set out-of-band (see
      // backend/scripts/set-admin-claim.js) after the account already
      // exists, so a cached ID token from an earlier sign-in won't carry it
      // yet — without `true` here, a freshly-granted admin would see
      // "access denied" until their token happened to refresh on its own
      // (Firebase refreshes roughly hourly), not on this page load.
      nextUser
        .getIdTokenResult(true)
        .then((result) => {
          setIsAdmin(result.claims.admin === true);
          setLoading(false);
        })
        .catch(() => {
          setIsAdmin(false);
          setLoading(false);
        });
    });
  }, []);

  // Deliberately NOT firebase/auth's signInWithPopup: that helper opens
  // accounts.google.com in a popup and relays the result back through a
  // GAPI cross-window iframe (apis.google.com) when it decides direct
  // postMessage isn't reliable — confirmed live (in this exact deployment)
  // that this relay's own window.close() call gets blocked by the popup's
  // Cross-Origin-Opener-Policy, which we can't override since we don't
  // control apis.google.com's/accounts.google.com's response headers, only
  // our own. Google Identity Services (window.google.accounts.id, loaded in
  // index.html) issues a signed ID token directly with no popup-closing
  // handshake at all — signInWithCredential just exchanges that token for a
  // Firebase session, no popup/redirect machinery involved on our side.
  const signInWithGoogleCredential = async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
  };

  const signOutUser = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signInWithGoogleCredential, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
