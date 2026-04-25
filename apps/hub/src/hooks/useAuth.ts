import { useState, useEffect } from "react"
import { onAuthStateChanged, type User } from "firebase/auth"
import { doc, onSnapshot } from "firebase/firestore"
import { auth, db } from "../core/firebase"
import type { Subscription } from "@icecap/types"

export function useAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoadingAuth(false)
      if (!u) setSubscription(null)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    const ref = doc(db, "subscriptions", user.uid)
    console.log(`[Hub] Auth UID: ${user.uid}, Project ID: ${db.app.options.projectId}`)
    return onSnapshot(ref, (snap) => {
      console.log(`[Hub] Subscription snapshot received:`, snap.exists() ? snap.data() : "No document")
      setSubscription(snap.exists() ? (snap.data() as Subscription) : null)
    })
  }, [user])

  const isSubscribed =
    subscription?.status === "active" || subscription?.status === "trialling"

  const isPastDue =
    subscription?.status === "past_due" || subscription?.status === "unpaid"

  return { user, subscription, loadingAuth, isSubscribed, isPastDue }
}
