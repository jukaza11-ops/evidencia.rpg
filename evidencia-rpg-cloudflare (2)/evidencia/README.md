# evidencia.rpg — publicação na Cloudflare

Site 100% estático (React + TypeScript + canvas). Nada é enviado a servidores: as fotos são processadas no navegador.

## Publicar (Workers com assets estáticos)
```bash
npm install
npx wrangler login      # uma vez
npm run deploy          # build + publica em https://evidencia-rpg.<sua-conta>.workers.dev
```

## Publicar via Cloudflare Pages (painel / Git)
- Framework preset: nenhum · Build command: `npm run build` · Output directory: `dist`

## Testar localmente
```bash
npm run build && npm run preview   # http://localhost:8787
```

## Notas
- `public/_headers` define segurança (CSP) e cache; a CSP libera apenas Google Fonts como origem externa.
- Domínio próprio: painel Cloudflare → Workers & Pages → evidencia-rpg → Settings → Domains.
- As fontes manuscritas vêm do Google Fonts (precisa de internet no visitante); sem elas o site usa fontes de reserva.
