import { readFileSync } from 'node:fs';
const tag = '<meta name="google-site-verification" content="cH3Eg4pHFePUGoHd71y-CJonRnn2V17QBAK3JmqnNqc" />';
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const m = /<head>\s*([^\n]*)/.exec(html);
if (!m || m[1].trim() !== tag) { console.error('ERRO: a meta google-site-verification precisa ser a primeira linha dentro de <head>.'); process.exit(1); }
console.log('OK: meta google-site-verification presente logo abaixo de <head>.');
