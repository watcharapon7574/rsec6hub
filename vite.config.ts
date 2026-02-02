import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['lucide-react']
  },
  build: {
    // สร้าง hash ให้ไฟล์ทุกครั้งที่ build ใหม่
    rollupOptions: {
      output: {
        // เพิ่ม hash ให้กับไฟล์ชื่อเพื่อบังคับให้โหลดไฟล์ใหม่
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`,
        manualChunks: {
          'lucide': ['lucide-react']
        }
      }
    }
  }
}));
