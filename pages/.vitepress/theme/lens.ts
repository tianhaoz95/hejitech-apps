// The home page's lens: what each app does (visitors) or how it's built (engineers). Shared by the
// hero dock and the app cards, remembered per browser.
import { onMounted, ref } from "vue";

export type Lens = "user" | "builder";

const KEY = "heji-lens";
const lens = ref<Lens>("user");

function setLens(next: Lens) {
  lens.value = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {}
}

export function useLens() {
  // Server-rendered as "user"; the saved lens is applied after hydration so the HTML matches.
  onMounted(() => {
    try {
      if (localStorage.getItem(KEY) === "builder") lens.value = "builder";
    } catch {}
  });
  return { lens, setLens };
}
