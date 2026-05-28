import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
    // Force a single React copy so client components and any peer-dep React
    // consumers (e.g. lucide-react) share the same instance. Without this,
    // SSR + Vite can wind up with two React copies and `useContext` returns
    // null inside the dep, breaking forwardRef components.
    dedupe: ["react", "react-dom"],
  },
});
