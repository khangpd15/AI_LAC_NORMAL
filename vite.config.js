import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function localTtsPlugin() {
  return {
    name: 'local-tts-server',
    configureServer(server) {
      server.middlewares.use('/api/tts', async (req, res) => {
        try {
          const urlObj = new URL(req.url, 'http://localhost');
          const text = urlObj.searchParams.get('text') || '';
          if (!text) {
            res.statusCode = 400;
            res.end('Missing text');
            return;
          }

          const upstreamUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=vi&client=tw-ob`;
          const upstreamRes = await fetch(upstreamUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
          });

          if (!upstreamRes.ok) {
            res.statusCode = upstreamRes.status;
            res.end('Upstream TTS error');
            return;
          }

          const arrayBuffer = await upstreamRes.arrayBuffer();
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.end(Buffer.from(arrayBuffer));
        } catch (err) {
          res.statusCode = 500;
          res.end(err.message);
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localTtsPlugin()],
})
