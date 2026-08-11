import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
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
  signInWithGoogle: () => Promise<void>;
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

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const signOutUser = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signInWithGoogle, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
