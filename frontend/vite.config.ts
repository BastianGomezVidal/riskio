import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [react(), tailwindcss()],
  build: {
    // antd and the @rc-component primitives it is built on land in one 579 kB
    // chunk. They cannot be split: the rc components reference each other and
    // antd's context cyclically, and forcing them apart chunks makes the app
    // die at load with "Cannot access X before initialization". Raising the
    // limit is the honest option — the default 500 kB would otherwise warn on
    // every build for a cost that is a property of the UI library. It is set
    // just above that chunk, so app code and route chunks still warn.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // The entry chunk is dominated by dependencies that change far less
        // often than app code. Splitting them out means a deploy does not
        // invalidate ~800 kB of cached vendor, and the browser can fetch the
        // groups in parallel.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id))
            return "vendor-react";
          if (/[\\/]node_modules[\\/](antd|@ant-design|@rc-component|rc-[^\\/]+)[\\/]/.test(id))
            return "vendor-antd";
          if (/[\\/]node_modules[\\/](zod|@tanstack)[\\/]/.test(id)) return "vendor-data";
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
