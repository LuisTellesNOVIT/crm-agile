import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

export default {
  ssr: true,
  // Preset oficial de Vercel — convierte cada loader/action en serverless function
  // y optimiza el bundling para el runtime de Vercel.
  presets: [vercelPreset()],
} satisfies Config;
