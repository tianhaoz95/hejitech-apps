// The hosted plugin page: the same plugin as the packed .ehpk, served by this site so it can be
// loaded onto real glasses with `evenhub qr --url https://g2digest.hejitech.workers.dev/glasses/`.
import { bootPlugin } from "@g2digest/plugin";

void bootPlugin({ apiBase: location.origin, root: document.getElementById("app")! });
