import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";
import cesium from "vite-plugin-cesium";
import { windyDevApi } from "./server/devApi";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [cesium(), windyDevApi(env.WINDY_API_KEY)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      open: true,
      host: true,
    },
  };
});
