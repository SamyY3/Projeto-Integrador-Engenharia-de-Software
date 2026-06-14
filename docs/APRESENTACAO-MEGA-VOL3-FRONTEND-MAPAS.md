# Volume 3 — Frontend, EcoCheck React, Mapa e Painéis Admin

---

# SEÇÃO 1 — FILOSOFIA DO FRONTEND

**O que dizer:**

> “O frontend EcoColeta é **multi-página** (MPA), não Single Page Application. Cada funcionalidade tem seu HTML — isso simplifica SEO institucional, cache e manutenção em ambiente acadêmico. A interatividade vem de JavaScript modular carregado no final do `<body>`, com `defer` e lazy loading onde aplicável.”

**Padrões transversais:**
1. `assets/js/ecocoleta-paths.js` — primeiro script; define `ECOCOLETA_BASE`
2. `assets/js/header-nav.js` — injeta menu e estado logado
3. `assets/js/footer.js` — rodapé dinâmico
4. CSS: `style.css` + CSS específico da página

---

# SEÇÃO 2 — `assets/js/` (CADA ARQUIVO)

## 2.1 Infraestrutura e caminhos

### `ecocoleta-paths.js`
| Export / global | Função |
|---------------|--------|
| `ECOCOLETA_BASE` | Detecta `/Ecocoleta` ou raiz |
| `ecocoletaUrl(path)` | Prefixa base em URLs |
| `ecocoletaApi(path)` | Mapeia `login.php` → `auth/login.php`, etc. |
| `EcoColetaFetch` | Wrapper fetch com cache GET + deduplicação |

**O que dizer:** “Este arquivo resolve o problema clássico de projeto em subpasta do XAMPP — sem ele, fetch quebraria ao mover de `/Ecocoleta` para outro path.”

### `ecocoleta-lazy-scripts.js`
- `ecocoletaLoadScript(src)` — Promise, evita duplo carregamento
- Usado para mapa e widgets pesados

### `ecocheck-lazy-loader.js`
- Carrega `ecocheck-dist/ecocheck.css` + `ecocheck.iife.js` + `ecocheck-bridge.js` sob demanda
- Melhora LCP em `login.html` e `cadastro.html`

---

## 2.2 EcoCheck (ponte PHP ↔ React)

### `ecocheck-bridge.js`
| Responsabilidade | Detalhe |
|------------------|---------|
| Intercepta submit | Login, cadastro, admin login |
| Abre widget | `window.EcoCheck.mount()` |
| Evento `ecocheck:verified` | Recebe token, injeta hidden input `ecocheck_token` |
| Retry | Recarrega challenge em erro |

### `anti-bot.js` (legado)
- Versão simplificada pré-EcoCheck; mantido por compatibilidade

---

## 2.3 Navegação e layout

### `header-nav.js`
- Monta links: Home, Agendar, Prêmios, Ranking, Perfil
- Se logado: avatar, notificações, logout
- `data-requires-auth` — redireciona login se necessário
- Escuta `ecocoleta:profile-loaded` para evitar fetch duplicado

### `header-scroll.js`
- Adiciona classe `scrolled` ao header após scroll

### `footer.js`
- Ano dinâmico, links institucionais

### `user-popup.js`
- Dropdown do usuário logado no header

---

## 2.4 Fluxos de negócio morador

### `agendar-coleta.js` (~600+ linhas)
| Bloco | Comportamento |
|-------|---------------|
| Calendário | Renderiza mês; desabilita datas passadas |
| Slots | 5 faixas horárias (slot_ordem 0–4) |
| Materiais | Checkboxes plástico, papel, metal… |
| EcoPonto | Fetch `ecopontos-agendamento.php`; exibe distância |
| Submit | POST `agendamento_coleta.php` acao=agendar |
| Erros | `sem_endereco` → redirect edicaoperfil |

### `balanca-ecoponto.js`
- Lista agendamentos pendentes do usuário
- Input peso kg (vírgula ou ponto)
- Chama `atualizar_balanca` ou simula localmente
- Exibe mensagem “aguardando validação ecoponto”

### `pontuacao-coleta.js`
- Debounce input peso
- GET/POST `api/pontuacao-coleta.php`
- Atualiza UI: breakdown agendamento + peso + material + conclusão

### `premios.js`
| Função JS | API |
|-----------|-----|
| `carregarBeneficios()` | Lista estática embutida ou fetch |
| `verificarResgates()` | `acao=verificar_resgates` |
| `resgatarPremio(id)` | `acao=resgatar` |
| `aplicarCupomNovo()` | ECOSAVE20 para contas novas |

### `perfil.js`
- `meu_perfil.php` — dados principais
- Gráfico atividade (entregas por mês)
- Link edição, agendamento, logout

### `edicaoperfil.js`
- Validação client-side espelhando servidor
- Submit `FormData` multipart para `atualizar-perfil.php`
- Máscara CEP, busca geocode opcional

### `perfil-avatar.js`
- Crop preview antes do upload
- Integração com input `foto`

### `ranking.js`
- Tabs semana / mês
- Fetch `ranking-ruas.php`
- Destaque rua do usuário logado

### `notif-popup.js`
- Polling `notificacoes.php?acao=contar_nao_lidas`
- Lista dropdown; marcar lida

---

## 2.5 Mapa e ecopontos (assets)

### `home.js`
- Inicializa mapa na home se `#mapa-home` existir
- Botão “usar minha localização”

### `ecopontos.js` + `ecopontos-catalog.js`
- Catálogo estático sincronizado com `includes/ecopontos-catalog-data.php`
- Markers Leaflet com popup horário/materiais

### `transport-times-widget.js`
- React `createElement` sem JSX build
- Ícones modos: a pé, carro, bike, ônibus
- Chama OSRM para ETAs

### `ecocoleta-export.js`
- Export relatório: `window.print()` ou CSV download

### `password-toggle.js`
- Olho mostrar/ocultar senha nos forms auth

---

# SEÇÃO 3 — EcoCheck React (`ecocheck/src/`)

## 3.1 Estrutura do pacote

```
ecocheck/
├── package.json          # react, react-dom, vite, typescript
├── vite.config.ts        # build IIFE library
├── src/
│   ├── main.tsx          # mountEcoCheck(), export API global
│   ├── index.css         # estilos modal
│   ├── types.ts          # ChallengeState, ModalStatus
│   ├── components/
│   │   ├── AntiBotModal.tsx
│   │   └── PuzzleSlider.tsx
│   └── services/
│       ├── VerificationService.ts
│       └── HumanBehaviorValidator.ts
```

## 3.2 Componentes e classes (fale como “módulo React”)

### `AntiBotModal` (componente funcional)
**Props:** `open`, `onClose`, `onVerified`, `verificationService`

**Estados internos (`useState`):**
- `status`: idle | loading | playing | success | error
- `challenge`: dados do servidor
- `honeypot`: campo armadilha anti-bot

**O que dizer:**

> “O modal implementa uma **máquina de estados finitos**. Ao abrir, chama `fetchChallenge()`. Em `playing`, renderiza o `PuzzleSlider`. Em sucesso, chama `onVerified(token)` que o bridge JS usa no formulário PHP.”

### `PuzzleSlider` / `PuzzleSliderInner`
- `memo()` + `requestAnimationFrame` para drag suave
- Coleta `samples[]` com x e timestamp durante arraste
- Calcula `straightRatio`, `velocityStd` enviados ao verify
- Acessibilidade: `aria-valuenow`, teclado opcional

### `VerificationService` (classe)
| Método | HTTP |
|--------|------|
| `fetchChallenge()` | GET `?action=challenge` |
| `verify(payload)` | POST `?action=verify` JSON body |
| `checkStatus()` | GET `?action=status` |

### `HumanBehaviorValidator` (classe)
- `validate(samples, durationMs)` — heurísticas anti-script
- Detecta movimento em linha reta perfeita
- Valida variância de velocidade

### `main.tsx` — `mountEcoCheck()`
- Expõe `window.EcoCheck = { mount, unmount }`
- Build Vite como **IIFE** para não precisar React no site principal

**Comando build:** `cd ecocheck && npm install && npm run build` → `ecocheck-dist/`

---

# SEÇÃO 4 — Módulo `mapa/` (DETALHADO)

| Arquivo | Linhas ~ | Responsabilidade |
|---------|----------|------------------|
| `mapa.js` | 800+ | Orquestrador Leaflet principal |
| `route-service.js` | 200+ | Cliente OSRM |
| `geolocation-service.js` | 150+ | Wrapper GPS browser |
| `navigation-component.js` | 300+ | UI instruções turn-by-turn |
| `navigation-engine.js` | 200+ | Processa geometria rota OSRM |
| `geo-consent.js` | 80+ | Modal consentimento LGPD |
| `transport-times-widget.js` | duplicata assets | ETAs |
| `mapa.css` | — | Estilos controles mapa |
| `mapa.html` | — | Página standalone mapa |

## 4.1 `mapa.js` — funções e constantes

| Elemento | Descrição |
|----------|-----------|
| `OVERPASS_URL` | `overpass-api.de/api/interpreter` |
| `OSM_ECOPONTOS_CACHE_KEY` | sessionStorage TTL cache POIs |
| `initMapa()` | Cria L.map, tiles OSM |
| `carregarEcopontos()` | Overpass query amenity=recycling |
| `adicionarMarcadorUsuario()` | Pin azul GPS |
| `tragarRota()` | Delega route-service |
| Debounce resize | Performance em mobile |

## 4.2 `route-service.js`

```javascript
// Padrão URL OSRM
https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}
```

| Função | Retorno |
|--------|---------|
| `fetchRoute(from, to, profile)` | GeoJSON coordinates, distance, duration |
| `formatDistance(m)` | "2,4 km" pt-BR |
| `formatDuration(s)` | "8 min" |

## 4.3 Fluxo navegação

```
1. geo-consent.js → usuário aceita GPS
2. geolocation-service → watchPosition
3. Usuário clica ecoponto → route-service calcula rota
4. navigation-engine decodifica polyline
5. navigation-component exibe "Vire à direita em 200m"
```

---

# SEÇÃO 5 — PAINÉIS ADMIN (HTML + JS)

## 5.1 Admin Plataforma

| HTML | JS principal | CSS tema |
|------|--------------|----------|
| `Home-ADM.html` | `home-adm.js` | `home-adm.css`, `plat-adm-premium.css` |
| `usuarios-adm.html` | `usuarios-adm.js` | `usuarios-adm.css` |
| `ecoponto-adm.html` | `ecoponto-adm.js` | `ecoponto-adm.css` |
| `agendamento-adm.html` | `agendamento-adm.js` | `agendamento-adm.css` |
| `relatorio-adm.html` | `relatorio-adm.js` | `relatorio-adm.css` |
| `configuracoes-adm.html` | `configuracoes-adm.js` | `configuracoes-adm.css` |
| `edicao-perfil-admin.html` | `edicao-perfil-admin.js` | — |

**Shell compartilhado:**
- `plat-adm-shell.js` — layout sidebar + header
- `plat-sidebar-nav.js` — navegação
- `plat-adm-theme-boot.js` — dark/light
- `adm-plataforma-icons.js` — ícones SVG inline

### `home-adm.js` — o que faz
- Fetch `dashboard-plataforma-adm.php`
- Renderiza cards KPI: moradores, ecopontos, peso mês, co2 evitado
- Gráficos Chart.js ou canvas simples
- Tabela últimos agendamentos

### `usuarios-adm.js`
- CRUD modal morador
- POST `salvar-usuario-adm.php`, DELETE `excluir-usuario-adm.php`

### `ecoponto-adm.js`
- Mapa Leaflet admin com drag marker
- POST `salvar-ecoponto-adm.php` com lat/lng

---

## 5.2 Admin EcoPonto

| HTML | JS | Destaque |
|------|-----|----------|
| `Home-ADM-Ecoponto.html` | `home-adm-ecoponto.js` | Dashboard local |
| `Coletas-ADM-Ecoponto.html` | `coletas-adm-ecoponto.js` | **Balança admin** |
| `materias-ADM-Ecoponto.html` | `materias-adm-ecoponto.js` | Entrada materiais |
| `relatorio-ADM-Ecoponto.html` | `relatorio-adm-ecoponto.js` | Charts período |
| `configuracoes-ADM-Ecoponto.html` | `configuracoes-adm-ecoponto.js` | Preferências |

**Shell ecoponto:**
- `adm-ecoponto-sidebar-boot.js`
- `adm-ecoponto-sidebar-nav.js`
- `adm-ecoponto-common.js`
- `adm-ecoponto-theme-boot.js`

### `coletas-adm-ecoponto.js` — **arquivo crítico para apresentar**

| Função JS | Ação |
|-----------|------|
| `carregarColetas()` | GET `adm-coletas.php` |
| `renderTabela()` | Status cores: pendente, aguardando, concluída |
| `abrirModal('confirmar_recebimento')` | Form peso + grid materiais |
| `confirmarModal()` | POST confirmar_recebimento |
| Validação | `soma(materiais) === peso_validado` ±0.05 |

**O que dizer:**

> “Este JS é o análogo **operacional** do `balanca-ecoponto.js` do morador. O morador **informa**; o admin **valida**. Só quando o admin confirma é que `coleta_confirmar_recebimento_admin()` executa no PHP.”

---

# SEÇÃO 6 — CSS E IDENTIDADE VISUAL

| Arquivo | Escopo |
|---------|--------|
| `assets/css/style.css` | Variáveis CSS, reset, tipografia |
| `assets/css/header.css` | Navbar responsiva |
| `assets/css/home.css` | Hero, seções home |
| `assets/css/perfil.css` | Dashboard morador |
| `assets/css/premios.css` | Cards prêmios |
| `assets/css/ecopontos.css` | Mapa fullscreen |
| `assets/css/auth-background.css` | Fundo login/cadastro |
| `admin/plat-adm-premium.css` | Tema premium plataforma |
| `admin/adm-ecoponto-pro.css` | Tema verde ecoponto |

**Paleta:** verdes (#0f6b38, #12895d) — identidade ambiental.

---

# SEÇÃO 7 — PERFORMANCE FRONTEND (CITAR SE PERGUNTAREM)

Documentado em `docs/PERFORMANCE-REPORT.md`:

| Otimização | Arquivo |
|------------|---------|
| Lazy EcoCheck | `ecocheck-lazy-loader.js` |
| Lazy mapa home | `ecocoleta-lazy-scripts.js` em `tela-inicia.html` |
| Cache fetch GET | `EcoColetaFetch` em `ecocoleta-paths.js` |
| Debounce notificações | `notif-popup.js` |
| Cache Overpass | `mapa.js` sessionStorage |
| memo + rAF puzzle | `PuzzleSlider.tsx` |
| Logo LCP preload | `auth/login.html` |
| Scripts no footer defer | todas pages auth |

---

# SEÇÃO 8 — TRANSIÇÃO VOLUME 4

**O que dizer:**

> “Apresentei cada script JavaScript, cada componente React do EcoCheck, cada tela admin e o módulo de mapa.
>
> No Volume 4, fecho com os **fluxos ponta a ponta** (sequência de chamadas), **roteiro oral minuto a minuto** para 90 minutos, **regras de negócio expandidas**, **desafios**, **melhorias** e **glossário**.”

---

*Fim do Volume 3*
