import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente do .env correspondente ao modo atual
  // para que possam ser usadas dentro do próprio vite.config.js
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // ─── Plugins ──────────────────────────────────────────────────────────
    // @vitejs/plugin-react habilita Fast Refresh + JSX transform automático
    plugins: [react()],

    // ─── Resolução de módulos ──────────────────────────────────────────────
    resolve: {
      /**
       * Alias canônico do projeto.
       * Todo import dentro de `src/` usa `@/` como raiz absoluta.
       * Exemplo: `import { useAuth } from '@/core/auth/useAuth'`
       */
      alias: {
        '@': path.resolve(__dirname, './src'),
      },

      /**
       * Ordem de extensões tentadas quando o import não especifica extensão.
       * `.jsx` antes de `.js` garante que componentes React sejam encontrados
       * primeiro, evitando ambiguidade em pastas com arquivos homônimos.
       */
      extensions: ['.jsx', '.js', '.json'],
    },

    // ─── Servidor de desenvolvimento ──────────────────────────────────────
    server: {
      /**
       * Proxy de desenvolvimento — elimina CORS durante o desenvolvimento.
       *
       * Toda requisição que começa com `/api` é repassada ao backend
       * Spring Boot. O `rewrite` remove o prefixo `/api` para que o
       * backend receba a rota original (ex.: `/api/templates` → `/templates`).
       *
       * `changeOrigin: true` substitui o header `Host` pelo do target,
       * necessário quando o backend valida o cabeçalho de origem.
       */
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL ?? 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },

    // ─── Build de produção ────────────────────────────────────────────────
    build: {
      /** Diretório de saída do build final. */
      outDir: 'dist',

      /**
       * Sourcemaps em produção.
       * Recomendação: envie os arquivos `.map` apenas ao servidor de
       * monitoramento de erros (ex.: Sentry) e os exclua do deploy público
       * via configuração de CI/CD — nunca os sirva no CDN diretamente.
       */
      sourcemap: true,

      rollupOptions: {
        output: {
          /**
           * Divisão manual de chunks por camada de volatilidade.
           *
           * Estratégia: separar código que muda em velocidades distintas
           * maximiza o aproveitamento de cache HTTP do browser:
           *
           * - `vendor` (react, react-dom, react-router-dom): mudam apenas
           *   em upgrades de versão major — cache muito longo.
           * - `http` (axios): muda em patches de segurança — cache médio.
           * - `ui` (lucide-react): pacote de ícones volumoso, isolado para
           *   não contaminar o cache do vendor quando ícones são adicionados.
           *
           * O código da aplicação (src/) fica no chunk principal (index),
           * que invalida o cache a cada deploy — comportamento desejado.
           */
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['lucide-react'],
            http: ['axios'],
          },
        },
      },
    },
  }
})
