# Relatório de Performance — EcoColeta

**Data:** 9 de junho de 2026  
**Escopo:** páginas públicas do morador, mapa, notificações, EcoCheck (captcha).

---

## Resumo executivo

A aplicação é majoritariamente **HTML/CSS/JS vanilla + PHP**, sem bundler React no front principal. Os maiores custos vinham de:

1. Scripts bloqueantes no meio do `<body>` (header/nav/notificações).
2. Cadeia pesada na Home: Tailwind CDN + Leaflet + React UMD + `mapa.js` (~3.200 linhas).
3. Requisições duplicadas a `meu_perfil.php` em cada página.
4. Poll de notificações a cada 45s mesmo com aba em background.
5. Overpass API sem cache no cliente.
6. Re-renders excessivos no puzzle do EcoCheck durante drag.

As correções abaixo reduzem **tempo até conteúdo visível**, **bytes transferidos** e **trabalho na thread principal** sem alterar regras de negócio.

---

## Gargalos identificados

| Prioridade | Gargalo | Impacto |
|------------|---------|---------|
| Alta | Scripts síncronos após `<header>` | Bloqueia parsing e first paint |
| Alta | React UMD na Home só para widget de tempos | ~130 KB + parse desnecessário no load inicial |
| Alta | `meu_perfil.php` em header + notif + perfil | 2–3 round-trips duplicados por página |
| Alta | Tailwind CDN em `ecopontos.html` sem uso | ~300 KB+ de JS/CSS não utilizados |
| Média | Overpass API a cada visita ao mapa | Latência 1–5s + rate limit |
| Média | `resize`/`scroll` sem throttle no popup de notif | Layout thrashing |
| Média | Poll 45s com aba oculta | CPU/rede em background |
| Média | `mapa.js` `resize` → `invalidateSize` direto | Múltiplos reflows no Leaflet |
| Baixa | Logo com `loading="lazy"` no header | LCP atrasado |
| Baixa | PuzzleSlider: `setState` a cada `pointermove` | Jank no captcha |

---

## Mudanças implementadas

### 1. Cache de requisições (`EcoColetaFetch`)

**Arquivo:** `assets/js/ecocoleta-paths.js`

- Módulo `EcoColetaFetch` embutido no bootstrap de paths (zero request extra).
- Cache em memória com TTL configurável e deduplicação de requisições em voo.
- Chave `meu_perfil` com TTL de 90s.

**Integrações:**

| Arquivo | Comportamento |
|---------|---------------|
| `assets/js/header-nav.js` | Busca perfil via cache; dispara `ecocoleta:profile-loaded` |
| `assets/js/notif-popup.js` | Reutiliza cache; evita fetch duplicado para saldo |
| `assets/js/perfil.js` | Carrega perfil via cache; invalida após salvar edição |

**Ganho estimado:** −1 a −2 requisições HTTP por pageview em páginas autenticadas.

---

### 2. Scripts não bloqueantes na Home

**Arquivo:** `pages/tela-inicia.html`

- Removidos scripts do meio do documento (após header).
- Scripts de navegação movidos para o final do `<body>`.
- Leaflet, serviços de mapa e `mapa.js` com atributo `defer`.
- `preconnect` para unpkg e `dns-prefetch` para Overpass.

**Ganho estimado:** first paint mais cedo; HTML acima da dobra renderiza sem esperar JS.

---

### 3. Lazy loading do React (widget de tempos)

**Arquivos:** `mapa/transport-times-widget.js`, `assets/js/ecocoleta-lazy-scripts.js`

- React/ReactDOM **não** são mais carregados no HTML da Home.
- Carregamento sob demanda quando `#transport-times-widget` entra no viewport (`IntersectionObserver`, margem 400px).
- `TransportButton` envolvido em `React.memo` para evitar re-renders dos 4 modos de transporte.

**Ganho estimado:** ~130 KB e parse de React adiados até o usuário rolar até o mapa.

---

### 4. Code splitting do mapa em EcoPontos

**Arquivo:** `pages/ecopontos.html`

- Removido Tailwind CDN (não havia classes Tailwind na página).
- Leaflet + `ecopontos-catalog.js` + `mapa.js` carregados apenas quando `#map` fica visível.
- Utilitário `ecoLoadScripts` / `ecoWhenVisible` em `assets/js/ecocoleta-lazy-scripts.js`.

**Ganho estimado:** initial bundle da página EcoPontos reduzido em centenas de KB; mapa só paga custo quando necessário.

---

### 5. Cache Overpass (sessionStorage)

**Arquivo:** `mapa/mapa.js`

- Resultado de ecopontos OSM cacheado por **6 horas** em `sessionStorage` (`ecocoleta:osm-ecopontos:v1`).
- Fallback para API apenas em cache miss ou expiração.

**Ganho estimado:** revisitas ao mapa na mesma sessão quase instantâneas para marcadores OSM.

---

### 6. Debounce de resize no mapa

**Arquivo:** `mapa/mapa.js`

- Listener `window.resize` usa `debouncedInvalidateSize` (120ms) em vez de `invalidateSize` direto.
- `ResizeObserver` do container já usava `requestAnimationFrame` — mantido.

---

### 7. Otimização do popup de notificações

**Arquivo:** `assets/js/notif-popup.js`

- `repositionOpenOverlays` agendado via `requestAnimationFrame` (coalesce de scroll/resize).
- Poll pausado quando `document.hidden` (Page Visibility API).
- Ao voltar à aba: poll imediato + retomada do intervalo.

**Ganho estimado:** menos trabalho em background; menos layout recalculation ao rolar.

---

### 8. Otimização de imagens (LCP)

**Arquivos:** `pages/tela-inicia.html`, `pages/ecopontos.html`

- Logo do header: `fetchpriority="high"`, dimensões explícitas, removido `loading="lazy"`.
- Imagens do puzzle EcoCheck: `decoding="async"`.

---

### 9. EcoCheck — memoização e throttle de drag

**Arquivo:** `ecocheck/src/components/PuzzleSlider.tsx`

- Componente exportado com `React.memo`.
- Movimento do puzzle limitado a **1 atualização por frame** (`requestAnimationFrame`).
- Cleanup do rAF no unmount.

> **Nota:** é necessário rebuild do bundle EcoCheck (`npm run build` em `ecocheck/`) para refletir no `ecocheck-dist/`.

---

### 10. Debounce em carrossel educacional

**Arquivo:** `pages/educacao-ambiental.html`

- Handler de `resize` do carrossel de resíduos com debounce de 120ms.

---

## Arquivos novos

| Arquivo | Função |
|---------|--------|
| `assets/js/ecocoleta-lazy-scripts.js` | `ecoLoadScript`, `ecoLoadScripts`, `ecoWhenVisible` |
| `docs/PERFORMANCE-REPORT.md` | Este relatório |

---

## Versões de cache-bust atualizadas

| Recurso | Versão |
|---------|--------|
| `ecocoleta-paths.js` | v=3 |
| `header-nav.js` | v=13 |
| `notif-popup.js` / `.css` | v=10 |
| `mapa.js` | v=66 |
| `transport-times-widget.js` | v=8 |
| `ecocoleta-lazy-scripts.js` | v=1 |

---

## Páginas de autenticação (login, cadastro, recuperação)

Otimizações aplicadas em `auth/login.html`, `auth/cadastro.html`, `auth/recuperar.html`, `auth/verificacao.html`, `auth/verificar-cadastro.html`, `auth/nova-senha.html`, `auth/senha-criada.html` e `auth/resetar.html`.

| Mudança | Detalhe |
|---------|---------|
| EcoCheck lazy | Novo `assets/js/ecocheck-lazy-loader.js` — bundle + CSS do modal só carregam ao scroll/hover/clique no widget |
| Scripts no `<head>` removidos | `ecocoleta-paths`, bridge e `ecocheck.iife.js` saíram do head em login/cadastro |
| `notif-popup.css` removido | Visitantes não usam popup de notificações — CSS economizado em todas as telas auth |
| `notif-popup.js` removido | Removido de `verificacao.html` (script bloqueante no meio do body) |
| Logo LCP | `fetchpriority="high"` + dimensões explícitas; removido `loading="lazy"` |
| `ecocoleta-paths.js` no footer | Antes do script inline da página (não bloqueia first paint) |
| `password-toggle.js` com `defer` | `nova-senha.html` e `resetar.html` |
| `resetar.html` alinhado | Base href, estilos auth, `ecocoletaPhpUrl`, redirect para `senha-criada.html` |

**Ganho estimado em login/cadastro:** ~150–250 KB de JS (EcoCheck) adiados até interação com o captcha.

---

## Recomendações futuras (não implementadas)

1. **Bundling do mapa:** extrair `mapa.js` em módulos (`routing`, `osm`, `ui`) com import dinâmico.
2. **Substituir Tailwind CDN na Home** por CSS estático do widget de tempos (elimina CDN runtime).
3. **Service Worker** para cache de assets estáticos e API GET idempotentes.
4. **WebP/AVIF** para `logo.2.png` e ícones de materiais.
5. **HTTP cache headers** no Apache para `/assets/` e `/mapa/` com `max-age` longo + hash no filename.
6. **Rebuild automático** do EcoCheck no CI após mudanças em `src/`.

---

## Como validar

1. **DevTools → Network:** abrir Home logado; confirmar **uma** chamada a `meu_perfil.php` nos primeiros 90s.
2. **EcoPontos:** reload; Leaflet/mapa.js só aparecem após scroll até o mapa (ou com mapa visível no viewport).
3. **Home:** React não aparece no waterfall até rolar até a seção do mapa.
4. **Mapa (2ª visita na sessão):** sem POST para `overpass-api.de` se cache válido.
5. **Notificações:** com aba em background, intervalo de poll para; ao focar, atualiza badge.
6. **Performance tab:** gravar scroll com popup de notif aberto — menos long tasks de layout.

---

## Eventos customizados adicionados

| Evento | Emissor | Consumidor |
|--------|---------|------------|
| `ecocoleta:profile-loaded` | `header-nav.js`, `perfil.js` | `notif-popup.js` (saldo sem fetch extra) |
