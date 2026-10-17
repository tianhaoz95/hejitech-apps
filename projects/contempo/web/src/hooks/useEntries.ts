import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { db } from "../lib/firebase";
import type { Entry } from "../lib/entryModel";

// Same collection path and ordering as FirestoreEntryRepository on Android:
// users/{uid}/entries, newest activityDate first.
export function useEntries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "users", user.uid, "entries"),
      orderBy("activityDate", "desc"),
    );
    return onSnapshot(q, (snapshot) => {
      setEntries(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry),
      );
      setLoading(false);
    });
  }, [user]);

  return { entries, loading };
}
