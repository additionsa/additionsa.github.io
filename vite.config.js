import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Using a relative base ("./") means the build works when hosted at
// https://<user>.github.io/  AND at https://<user>.github.io/<repo>/
// without any extra configuration.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
