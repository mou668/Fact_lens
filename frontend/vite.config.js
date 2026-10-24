import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Reads VITE_API_URL from the root .env locally; in Docker it comes from env_file.
export default defineConfig({ plugins: [react()], envDir: ".." });
