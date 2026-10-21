import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The monorepo hoists react-router to the root node_modules, next to another workspace's React 18,
  // so without this the bundle gets two Reacts and every page crashes on its first hook ("reading
  // 'useRef'"). Always resolve this app's own React 19.
  resolve: { dedupe: ["react", "react-dom"] },
});
