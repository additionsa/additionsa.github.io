import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Using a relative base ("./") means the built files load correctly
// regardless of the repository name, whether it's served from
// https://<user>.github.io/<repo>/ or a custom domain at the root.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
