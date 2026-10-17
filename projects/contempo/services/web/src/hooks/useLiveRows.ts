import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

/**
 * A live list of the signed-in user's rows in one contempo table: loads it, then reloads on any
 * Realtime change to that table (RLS scopes both to the user). Replaces Firestore's onSnapshot.
 */
export function useLiveRows<T>(table: string, orderBy: string, ascending: boolean, map: (row: unknown) => T) {
  const { user } = useAuth();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      const { data, error } = await supabase.from(table).select("*").order(orderBy, { ascending });
      if (cancelled) return;
      if (!error && data) setRows(data.map(map));
      setLoading(false);
    };
    void load();
    const channel = supabase
      .channel(`contempo-${table}-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "contempo", table, filter: `user_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
    // map is a module-level function in every caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, table, orderBy, ascending]);

  return { rows, loading };
}
