import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { db } from "../lib/firebase";
import type { Property } from "../lib/entryModel";

// Same collection path and ordering as FirestoreEntryRepository on Android:
// users/{uid}/properties, oldest-created first.
export function useProperties() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProperties([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "users", user.uid, "properties"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(q, (snapshot) => {
      setProperties(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Property),
      );
      setLoading(false);
    });
  }, [user]);

  return { properties, loading };
}
