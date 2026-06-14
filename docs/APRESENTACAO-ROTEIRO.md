# EcoColeta — Roteiro de Apresentação Oral

**Duração estimada:** 45–60 minutos (com demonstração) · 25–35 minutos (somente fala)  
**Público:** professor / banca acadêmica  
**Projeto:** `http://localhost/Ecocoleta` · PHP 8 + MySQL + JavaScript

---

## Como usar este roteiro

Cada seção traz:
- **O que dizer** — texto sugerido para falar em voz alta
- **Onde mostrar** — arquivo ou tela para abrir no editor ou no navegador
- **Conceito** — termo técnico que o professor pode perguntar

---

# PARTE 1 — ABERTURA (2 min)

## O que dizer

> “Bom dia, professor. Vou apresentar o **EcoColeta**, uma plataforma web de **coleta seletiva gamificada** desenvolvida para incentivar o descarte correto de resíduos na região do Cariri, no Ceará.
>
> O sistema conecta **moradores**, **ecopontos parceiros** e **administradores da plataforma** em um fluxo completo: cadastro, agendamento de coleta, validação de peso na balança, acúmulo de **EcoPoints**, resgate de prêmios, mapa com rotas e painéis administrativos.
>
> A stack principal é **PHP com MySQL** no backend, **HTML/CSS/JavaScript** no frontend, módulo de mapa com **Leaflet**, anti-bot **EcoCheck** em **React**, e envio de e-mail via **PHPMailer**. O projeto roda localmente no **XAMPP** e foi estruturado em pastas para separar autenticação, APIs, páginas públicas e administração.”

**Onde mostrar:** `README.md`, `index.html` → redireciona para `pages/tela-inicia.html`

---

# PARTE 2 — OBJETIVO GERAL DO SISTEMA (3 min)

## O que dizer

> “O **objetivo geral** do EcoColeta é digitalizar e gamificar o ciclo de coleta seletiva:
>
> 1. **Educar** o morador sobre descarte correto (páginas institucionais e relatórios ambientais).
> 2. **Facilitar** o agendamento de coleta domiciliar ou encaminhamento ao ecoponto mais próximo.
> 3. **Registrar** entregas com peso validado, evitando fraude por divergência entre peso informado e peso real.
> 4. **Recompensar** com EcoPoints convertíveis em cupons de parceiros.
> 5. **Gerenciar** ecopontos, moradores e coletas por dois níveis administrativos: **plataforma** (visão macro) e **ecoponto** (operação local).
>
> Em termos acadêmicos, trata-se de um **sistema de informação web** com arquitetura **cliente-servidor**, camada de **API REST em JSON**, persistência **relacional** e integração com **serviços externos** de mapas.”

---

# PARTE 3 — ARQUITETURA DO PROJETO (5 min)

## O que dizer

> “A arquitetura segue o padrão **três camadas**:
>
> | Camada | Tecnologia | Responsabilidade |
> |--------|------------|------------------|
> | **Apresentação** | HTML, CSS, JS, React (EcoCheck) | Telas, formulários, mapa, painéis admin |
> | **Negócio / API** | PHP (procedural + funções em `includes/`) | Regras, sessões, validações, JSON |
> | **Dados** | MySQL via mysqli | Usuários, coletas, entregas, prêmios |
>
> Não usamos framework PHP completo (Laravel/Symfony). Optamos por **PHP modular**: cada endpoint em `api/` é um script fino que inclui bibliotecas em `includes/`. Isso facilita deploy no XAMPP e deixa explícito o fluxo request → validação → SQL → JSON.
>
> O **frontend não é SPA única**: são páginas HTML estáticas que consomem APIs via `fetch`. O arquivo `assets/js/ecocoleta-paths.js` resolve URLs relativas ao subdiretório `/Ecocoleta`, importante quando o projeto não está na raiz do Apache.
>
> A segurança de formulários sensíveis passa pelo **EcoCheck** (desafio visual + análise comportamental) antes de login, cadastro e recuperação de senha.
>
> O `.htaccess` na raiz faz três coisas: **rewrites** de URLs legadas (`/login.html` → `/auth/login.html`), **headers de segurança** (X-Frame-Options, nosniff) e **cache** de assets estáticos.”

**Onde mostrar:** diagrama abaixo + `.htaccess` + `includes/conexao.php`

## Diagrama para desenhar no quadro

```
[Navegador]
    │  HTML/CSS/JS (pages/, auth/, admin/)
    │  fetch POST/GET → JSON
    ▼
[Apache + PHP]
    │  api/*.php, auth/*.php, admin/Login*.php
    │  includes/* (regras de negócio)
    ▼
[MySQL ecocoleta]
    │  usuario, agendamento_coleta_morador, entrega, resgate...

[Serviços externos]
    OSRM (rotas) · Overpass (POIs) · Nominatim (geocode) · SMTP (e-mail)
```

---

# PARTE 4 — ESTRUTURA DE PASTAS (5 min)

## O que dizer

> “Organizei o repositório por **responsabilidade**, não por tipo de arquivo solto na raiz.”

| Pasta | Finalidade | O que falar |
|-------|------------|-------------|
| **`pages/`** | Site público do morador | Home, agendamento, perfil, prêmios, ranking |
| **`auth/`** | Autenticação e ciclo de vida da conta | Login, cadastro em 2 etapas, recuperar senha |
| **`api/`** | Endpoints JSON | Toda comunicação AJAX do frontend |
| **`admin/`** | Painéis administrativos | HTML + JS + CSS dos dois tipos de admin |
| **`includes/`** | Biblioteca PHP compartilhada | Conexão, pontuação, e-mail, sessões |
| **`database/`** | Scripts SQL | Schema, seeds, migrações incrementais |
| **`assets/`** | Estáticos globais | CSS, JS, imagens do morador |
| **`mapa/`** | Módulo de mapa/navegação | Leaflet, OSRM, geolocalização |
| **`ecocheck/`** | Fonte React do anti-bot | TypeScript, Vite |
| **`ecocheck-dist/`** | Build compilado | `ecocheck.iife.js` consumido pelo site |
| **`config/`** | Operação e QA | XAMPP, SMTP exemplo, scripts de teste |
| **`uploads/`** | Arquivos enviados | Fotos de perfil |
| **`vendor/`** | Composer | PHPMailer |
| **`docs/`** | Documentação gerada | QA, performance, este roteiro |

> “A raiz mantém apenas `index.html`, `composer.json`, `.htaccess` e `README.md` — ponto de entrada mínimo.”

---

# PARTE 5 — BANCO DE DADOS (4 min)

## O que dizer

> “O schema principal está em `database/SQL_BDD_EcoColeta.sql`. Tabelas núcleo:”

| Tabela | Papel |
|--------|-------|
| `bairro`, `rua` | Endereço normalizado (Cariri) |
| `usuario` | Morador: e-mail, senha_hash, id_rua, saldo_ecopoints |
| `ponto_entrega` | EcoPontos (PEV): nome, coordenadas, materiais aceitos |
| `material`, `item_entrega` | Tipos de resíduo e itens por entrega |
| `entrega` | Registro oficial pós-validação admin (peso, pontos) |
| `coleta` | Legado / integração com fluxo antigo |
| `parceiro`, `beneficio` | Prêmios e cupons |
| `resgate` | Histórico de troca de pontos por benefício |

> “Tabelas adicionadas por migrações: `agendamento_coleta_morador` (agenda do morador), `cadastro_pendente` (cadastro até confirmar e-mail), `notificacao`, `administrador_ecoponto`, `administrador_plataforma`, `configuracao_plataforma`.
>
> A conexão em `includes/conexao.php` usa **mysqli**, pode **criar o banco automaticamente** na primeira execução e aplicar SQLs em ordem — útil para demonstração em qualquer máquina com XAMPP.”

---

# PARTE 6 — MÓDULO DE AUTENTICAÇÃO (8 min)

## 6.1 EcoCheck — componente React

**Onde mostrar:** `ecocheck/src/components/`

| Arquivo / Classe | Função |
|------------------|--------|
| **`AntiBotModal.tsx`** | Modal com estados idle → loading → playing → success/error; carrega desafio e emite token |
| **`PuzzleSlider.tsx`** | Slider de quebra-cabeça; usuário alinha peça; coleta amostras de movimento |
| **`VerificationService`** | `fetchChallenge()` e `verify()` contra `api/ecocheck-api.php` |
| **`HumanBehaviorValidator`** | Valida duração mínima, quantidade de amostras, velocidade (anti-bot) |

**O que dizer:**

> “O EcoCheck é empacotado como **IIFE** em `ecocheck-dist/ecocheck.iife.js`. No login, `assets/js/ecocheck-bridge.js` intercepta o submit, abre o modal, e só libera o POST quando o servidor devolve `ecocheck_verified_token` na sessão PHP.
>
> No servidor, `ecocheck/ecocheck-lib.php` gera o puzzle (GD ou SVG), valida posição com tolerância de ±10px, exige movimento humano (≥700ms, ≥6 amostras) e expira o token em ~10 minutos. Funções principais: `ecocheck_iniciar_sessao()`, `ecocheck_exigir_token()`, `ecocheck_validar_verify()`.”

## 6.2 Cadastro em duas etapas

**Fluxo:**

```
cadastro.html → cadastro.php → cadastro_pendente + e-mail código 6 dígitos
     → verificar-cadastro.html → verificar_cadastro.php → INSERT usuario
```

**O que dizer:**

> “Separei cadastro em duas etapas para **confirmar posse do e-mail** antes de criar a conta real. Na etapa 1, `auth/cadastro.php` grava em `cadastro_pendente` e envia código via PHPMailer. Na etapa 2, `verificar_cadastro.php` valida o código e só então insere em `usuario`.
>
> O `sessionStorage` guarda `signupEmail` e opcionalmente `signupCodigoTeste` em ambiente local sem SMTP.”

## 6.3 Login morador

| Arquivo | Função |
|---------|--------|
| `auth/login.html` | Formulário + EcoCheck lazy load |
| `auth/login.php` | Valida token EcoCheck, `password_verify`, seta `$_SESSION['usuario_id']` |
| `includes/session-bootstrap.php` | `ecocoleta_session_start()` — ponto único de `session_start()` |

## 6.4 Recuperação de senha

**Fluxo + sessionStorage:**

```
recuperar.html (setItem resetEmail)
  → recuperar.php (envia código)
  → verificacao.html (valida código, setItem resetToken, resetVerified)
  → nova-senha.html (exige resetVerified === 'true')
  → resetar_senha.php
  → senha-criada.html
```

## 6.5 Três tipos de sessão

| Ator | Chaves de sessão | Guard PHP |
|------|------------------|-----------|
| Morador | `usuario_id`, `usuario_nome`, `usuario_email` | checagem inline nas APIs |
| Admin plataforma | `ecocoleta_plat_admin_*` | `ecoplat_exigir_sessao()` |
| Admin ecoponto | `ecoponto_admin_id`, `ecoponto_admin_id_pev` | `ecoadm_exigir_sessao()` |

**O que dizer:**

> “Cada perfil tem **namespace de sessão separado**, evitando que um login de admin sobrescreva sessão de morador. Logout central: `api/logout.php`.”

---

# PARTE 7 — FRONTEND MORADOR (6 min)

## Páginas (`pages/`)

| Página | JS principal | API principal |
|--------|--------------|---------------|
| `tela-inicia.html` | `home.js`, `mapa/mapa.js` | geocode, ecopontos |
| `agendar-coleta.html` | `agendar-coleta.js` | `agendamento_coleta.php`, `ecopontos-agendamento.php` |
| `balanca-ecoponto.html` | `balanca-ecoponto.js`, `pontuacao-coleta.js` | `pontuacao-coleta.php` (simulação) |
| `perfil.html` | `perfil.js` | `meu_perfil.php` |
| `edicaoperfil.html` | `edicaoperfil.js` | `atualizar-perfil.php` |
| `premios-disponiveis.html` | `premios.js` | `resgate_premio.php` |
| `Ranking.html` | `ranking.js` | `ranking-ruas.php` |
| `ecopontos.html` | `ecopontos.js` | mapa completo |

## JavaScript compartilhado (`assets/js/`)

| Arquivo | Responsabilidade |
|---------|------------------|
| `ecocoleta-paths.js` | Base URL + mapa de caminhos legados + `EcoColetaFetch` (cache GET) |
| `header-nav.js` | Menu, estado logado, links ativos |
| `notif-popup.js` | Sininho de notificações |
| `ecocheck-lazy-loader.js` | Carrega EcoCheck só nas telas auth |
| `ecocoleta-lazy-scripts.js` | Carregamento assíncrono de scripts |
| `premios.js` | Lista benefícios, resgate, cupom novo usuário |
| `agendar-coleta.js` | Calendário, slots 0–4, validação endereço |

**O que dizer:**

> “O frontend é **progressive**: páginas carregam só o JS necessário. Implementamos lazy loading do EcoCheck e do mapa para melhorar LCP nas telas de autenticação — documentado em `docs/PERFORMANCE-REPORT.md`.”

---

# PARTE 8 — APIs PHP (`api/`) — VISÃO POR DOMÍNIO (8 min)

## O que dizer

> “A pasta `api/` concentra ~50 endpoints. Agrupo por domínio de negócio:”

### Morador — perfil e conta
- `meu_perfil.php` — GET perfil, saldo, estatísticas
- `atualizar-perfil.php` — POST multipart (foto, endereço, senha)
- `excluir_conta.php` — exclusão com confirmação
- `notificacoes.php` — listar/marcar lidas

### Agendamento e coleta
- `agendamento_coleta.php` — `listar`, `agendar`, `atualizar_balanca`, `cancelar`
- `ecopontos-agendamento.php` — sugere PEV por material e distância
- `pontuacao-coleta.php` — **somente simulação** (não grava pontos)
- `registrar_entrega.php` — entrega direta no PEV (fluxo alternativo)

### Prêmios
- `resgate_premio.php` — `verificar_resgates`, `resgatar`, `listar_historico`, cupom ECOSAVE20

### Mapa / geo
- `geocode-nominatim.php` — proxy geocoding (Nominatim → Photon → fallback Cariri)
- `listar-ecopontos.php` — catálogo de PEVs

### Ranking e relatórios
- `ranking-ruas.php` / `ranking.php` — ranking por rua, bônus semanal
- Relatório pessoal consumido pelas páginas de relatório

### Admin EcoPonto
- `adm-coletas.php` — **confirma recebimento** e credita pontos reais
- `adm-dashboard.php`, `adm-materiais.php`, `adm-relatorio.php`
- `configuracoes-adm-ecoponto.php`, `meu-perfil-admin.php`

### Admin Plataforma
- `dashboard-plataforma-adm.php` — KPIs macro
- `listar-usuarios-adm.php`, `salvar-usuario-adm.php`, `excluir-usuario-adm.php`
- `listar-ecopontos.php`, `salvar-ecoponto-adm.php`
- `listar-agendamentos-adm.php`, `salvar-agendamento-adm.php`
- `relatorio-plataforma-adm.php`, `configuracoes-plataforma-adm.php`

### Infraestrutura
- `ecocheck-api.php` — challenge/verify/status
- `logout.php` — encerra sessão
- `testar-email.php` — diagnóstico SMTP (localhost)

> “Endpoints em `auth/` duplicam alguns caminhos por rewrite: cadastro, login, recuperar ficam na pasta auth mas são acessíveis como `/Ecocoleta/cadastro.php`.”

---

# PARTE 9 — BIBLIOTECA PHP (`includes/`) — FUNÇÕES-CHAVE (7 min)

## O que dizer

> “A lógica pesada não fica nos endpoints; fica em `includes/` para reutilização e teste.”

| Arquivo | Funções / responsabilidades principais |
|---------|----------------------------------------|
| **`conexao.php`** | `$conn` mysqli, auto-install DB |
| **`session-bootstrap.php`** | `ecocoleta_session_start()` |
| **`stmt_helpers.php`** | `ecocoleta_stmt_fetch_one_assoc`, `ecocoleta_obter_saldo_usuario` |
| **`email_helper.php`** | `ecocoleta_carregar_smtp_settings`, `ecocoleta_enviar_email` |
| **`senha-validacao.php`** | Regras de senha (sequências numéricas proibidas) |
| **`notificacoes_helper.php`** | CRUD `notificacao`, templates por evento |
| **`pontuacao-coleta.php`** | Ver tabela abaixo — **coração da gamificação** |
| **`balanca-agendamento.php`** | Estado pendente de peso no agendamento |
| **`ecoponto-agendamento.php`** | `ecoponto_payload_agendamento`, aceitação de materiais |
| **`admin-ecoponto-data.php`** | Listagens, KPIs, CRUD operacional ecoponto (~3500 linhas) |
| **`admin-ecoponto-helpers.php`** | `ecoadm_exigir_sessao`, `ecoadm_json_ok/erro` |
| **`admin-plataforma-data.php`** | Gestão macro, seeds de dashboard |
| **`admin-plataforma-helpers.php`** | `ecoplat_exigir_sessao` |
| **`geocode-resolver.php`** | Nominatim, Photon, coordenadas locais |
| **`ranking-ruas.php`** | Agregação por rua, bônus `ECORANK_BONUS_PONTOS` |
| **`usuarios-seed-data.php`** | 50 moradores demo Cariri |

### `pontuacao-coleta.php` — funções que o professor pode cobrar

| Função | O que faz |
|--------|-----------|
| `coleta_calcular_pontos()` | Soma: +10 agendamento + bônus peso + bônus material +50 conclusão |
| `coleta_calcular_nivel()` | Iniciante → Eco Lenda (faixas 200/500/1000/2000) |
| `coleta_avaliar_divergencia_peso()` | Compara peso informado vs validado; penalidades |
| `coleta_confirmar_recebimento_admin()` | **Único ponto que credita pontos reais** — INSERT `entrega`, UPDATE agendamento, notifica |
| `coleta_validar_materiais_admin()` | Soma dos materiais deve igualar peso da balança |

**O que dizer:**

> “Regra crítica de negócio: `api/pontuacao-coleta.php` **nunca persiste pontos**. Isso evita fraude no cliente. Só `coleta_confirmar_recebimento_admin()`, chamada pelo admin ecoponto, grava `entrega` e atualiza saldo.”

---

# PARTE 10 — PAINÉIS ADMINISTRATIVOS (5 min)

## Admin Plataforma (`admin/Home-ADM.html` …)

**O que dizer:**

> “O administrador da **plataforma** enxerga o ecossistema inteiro: KPIs em `dashboard-plataforma-adm.php`, gestão de moradores, ecopontos, agendamentos globais, relatórios consolidados e configurações. Login: `admin/Login-ADM.php` com credencial seed `admin.plataforma@ecocoleta.local`.”

| Tela | Função |
|------|--------|
| `usuarios-adm.html` | CRUD moradores |
| `ecoponto-adm.html` | Mapa + cadastro PEV |
| `agendamento-adm.html` | Visão global de agendamentos |
| `relatorio-adm.html` | Analytics plataforma |
| `configuracoes-adm.html` | Preferências, equipe admin |

## Admin EcoPonto (`admin/Home-ADM-Ecoponto.html` …)

**O que dizer:**

> “O administrador do **ecoponto parceiro** opera o dia a dia: coletas do seu PEV, validação na balança, materiais recebidos, relatório local. A tela mais importante é `Coletas-ADM-Ecoponto.html`, que chama `api/adm-coletas.php` com ação `confirmar_recebimento`. Login: `admin/Login-ADM-Ecoponto.php`.”

| Tela | JS | API |
|------|-----|-----|
| `Coletas-ADM-Ecoponto.html` | `coletas-adm-ecoponto.js` | `adm-coletas.php` |
| `materias-ADM-Ecoponto.html` | `materias-adm-ecoponto.js` | `adm-materiais.php` |
| `relatorio-ADM-Ecoponto.html` | `relatorio-adm-ecoponto.js` | `adm-relatorio.php` |

---

# PARTE 11 — MÓDULO DE MAPA (4 min)

**Onde mostrar:** `mapa/`

| Arquivo | Função |
|---------|--------|
| `mapa.js` | Leaflet, marcadores ecopontos, cache Overpass em sessionStorage |
| `route-service.js` | Rotas OSRM (driving/walking) |
| `geolocation-service.js` | `navigator.geolocation` com fallback |
| `navigation-component.js` | UI de navegação passo a passo |
| `geo-consent.js` | Consentimento LGPD para GPS |
| `transport-times-widget.js` | Widget ETA a pé/carro/bike/ônibus |

**O que dizer:**

> “O mapa integra três serviços OpenStreetMap: **Nominatim** para converter endereço em coordenadas, **OSRM** para calcular rota até o ecoponto, e **Overpass** para pontos de reciclagem na região. Implementamos cache no `sessionStorage` para não sobrecarregar Overpass em navegação repetida.”

---

# PARTE 12 — FLUXO DE NAVEGAÇÃO ENTRE TELAS (4 min)

## O que dizer — mapa mental

```
                    ┌─────────────────┐
                    │  tela-inicia    │ (pública)
                    └────────┬────────┘
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
      login.html        cadastro.html     como-funciona
           │                 │
           ▼                 ▼
      perfil.html    verificar-cadastro
           │
     ┌─────┴─────┬──────────┬────────────┐
     ▼           ▼          ▼            ▼
agendar-coleta  premios  Ranking   edicaoperfil
     │
     ▼
balanca-ecoponto (após agendar)

ADMIN PLATAFORMA: Login-ADM → Home-ADM → usuarios / ecopontos / agendamentos

ADMIN ECOPONTO: Login-ADM-Ecoponto → Home-ADM-Ecoponto → Coletas (balança)
```

> “A navegação é **híperlink + redirect JS** após login bem-sucedido. O header (`header-nav.js`) adapta o menu se `meu_perfil.php` retorna sessão válida.”

---

# PARTE 13 — FLUXO DE DADOS (FRONTEND → BACKEND → BD) (6 min)

## Exemplo 1 — Agendamento completo

**O que dizer:**

> 1. Morador abre `agendar-coleta.html`; JS chama `ecopontos-agendamento.php` com endereço do perfil.
> 2. `ecoponto-agendamento.php` geocodifica e retorna PEV sugerido + lista.
> 3. Morador escolhe data/slot; POST `agendamento_coleta.php` `acao=agendar`.
> 4. PHP valida: sessão, endereço (`ecocoleta_usuario_tem_endereco_coleta`), material, PEV aceita resíduo.
> 5. INSERT em `agendamento_coleta_morador`; `notificacoes_helper` cria alertas.
> 6. Resposta JSON → UI exibe confirmação.

## Exemplo 2 — Balança e crédito de pontos

```
Morador: atualizar_balanca (peso_pendente_kg) → status aguardando_validacao
Admin:   confirmar_recebimento (peso_validado_kg + materiais JSON)
         → coleta_confirmar_recebimento_admin()
         → INSERT entrega + item_entrega
         → UPDATE agendamento status concluida
         → saldo_ecopoints recalculado
Morador: meu_perfil.php / verificar_resgates mostram novo saldo
```

## Exemplo 3 — Resgate de prêmio

```
premios.js → POST resgate_premio.php acao=resgatar
  → BEGIN TRANSACTION
  → SELECT beneficio FOR UPDATE
  → verifica saldo >= pontos_necessarios
  → verifica não resgatado antes
  → INSERT resgate
  → UPDATE usuario.saldo_ecopoints
  → COMMIT
  → notificacao resgate
```

**O que dizer:**

> “Todos os fluxos críticos usam **JSON** com `Content-Type: application/json` ou `x-www-form-urlencoded`. Sessão PHP via cookie — modelo **stateful** clássico de aplicações PHP.”

---

# PARTE 14 — APIs E SERVIÇOS EXTERNOS (3 min)

| Serviço | URL | Uso |
|---------|-----|-----|
| OSRM | router.project-osrm.org | Rotas no mapa |
| Overpass | overpass-api.de | POIs reciclagem |
| Nominatim | nominatim.openstreetmap.org | Geocoding |
| Photon | photon.komoot.io | Fallback geocode |
| SMTP | configurável | Códigos cadastro/recuperação |

**E-mail:** `includes/email_helper.php` + PHPMailer; `config/smtp_settings.json`; flag `modo_local_sem_email` exibe código na tela em dev.

---

# PARTE 15 — REGRAS DE NEGÓCIO (5 min)

## Pontuação
- Base: 10 (agendamento) + faixa de peso + bônus por material + 50 (conclusão admin)
- Níveis gamificados: Iniciante → Eco Lenda
- Divergência de peso: até 10% ok; até 30% recalcula; acima escala penalidades até revisão de conta

## EcoCheck
- Token obrigatório em login/cadastro/recuperar/admin login
- Puzzle + comportamento + honeypot

## Resgate
- Um benefício por usuário
- Saldo insuficiente bloqueia
- Cupom ECOSAVE20: só conta nova sem histórico

## Agendamento
- Exige endereço no perfil
- Não agenda data passada
- Slot único por usuário/data/horário
- Material deve ser aceito pelo PEV escolhido

**O que dizer:**

> “Essas regras estão centralizadas em PHP, não espalhadas no JavaScript — o front apenas exibe validações UX; a decisão final é sempre servidor.”

---

# PARTE 16 — QUALIDADE, TESTES E DESAFIOS (4 min)

## O que dizer

> “Implementamos garantia de qualidade em duas camadas documentadas em `docs/`:
>
> 1. **QA caixa preta/branca de páginas** — `config/qa-all-pages.ps1` testa 42 HTML (HTTP 200, viewport, scripts).
> 2. **QA integração de fluxos** — `config/qa-integracao-fluxos.php` testa login+EcoCheck, admin, mapa OSRM/Overpass, upload avatar, balança completa, resgate com débito, SMTP, sessionStorage.
>
> ### Principais desafios resolvidos
>
> | Desafio | Solução |
> |---------|---------|
> | URLs legadas após reorganização em pastas | `.htaccess` + `ecocoleta-paths.js` |
> | Fraude de pontos no cliente | Simulação separada; crédito só no admin |
> | Deploy XAMPP sem mysqlnd | `stmt_helpers.php` com `bind_result` |
> | EcoCheck bloqueando bots | React + validação comportamental servidor |
> | Performance em auth | Lazy load EcoCheck, cache fetch, memo PuzzleSlider |
> | E-mail em dev sem SMTP | `modo_local_sem_email` + sessionStorage |
> | Divergência peso informado vs real | Matriz de penalidades + histórico ocorrências |”

---

# PARTE 17 — MELHORIAS FUTURAS (3 min)

## O que dizer

> “Como trabalho futuro, proponho:
>
> 1. **API REST versionada** (`/api/v1/`) com documentação OpenAPI.
> 2. **Testes automatizados PHPUnit** para `pontuacao-coleta.php` e `resgate_premio.php`.
> 3. **PWA / notificações push** para lembrete de coleta agendada.
> 4. **App mobile** (Flutter/React Native) reutilizando as APIs JSON existentes.
> 5. **Painel analytics** com exportação CSV/PDF server-side.
> 6. **Rate limiting** e CSRF tokens nos POSTs críticos.
> 7. **Migrar mysqli** para PDO com prepared statements padronizados.
> 8. **CI/CD** com GitHub Actions rodando `qa-integracao-fluxos.php`.
> 9. **Cache Redis** para ranking e dashboard admin.
> 10. **Integração IoT** com balança real via serial/USB no ecoponto.”

---

# PARTE 18 — DEMONSTRAÇÃO AO VIVO (10 min) — ROTEIRO

| Ordem | Ação | O que narrar |
|-------|------|--------------|
| 1 | Abrir `http://localhost/Ecocoleta/` | “Página inicial com mapa embutido.” |
| 2 | Login morador seed | “EcoCheck puzzle → sessão → perfil.” |
| 3 | Agendar coleta | “Validação endereço, slot, ecoponto sugerido.” |
| 4 | Simular balança | “Pontos estimados — ainda não creditados.” |
| 5 | Login admin ecoponto | “Painel Coletas → confirmar peso → pontos reais.” |
| 6 | Voltar ao perfil | “Saldo EcoPoints atualizado.” |
| 7 | Resgatar prêmio | “Débito transacional.” |
| 8 | Mostrar `config/qa-integracao-fluxos.php` | “Testes automatizados dos fluxos.” |

**Credenciais demo:**
- Morador: `ana.paula.ferreira@seed.ecocoleta.local` / `Morador@123`
- Plataforma: `admin.plataforma@ecocoleta.local` / `EcoPlat@2026`
- EcoPonto: `admin.ecoponto@ecocoleta.local` / `EcoPonto@123`

---

# PARTE 19 — ENCERRAMENTO (1 min)

## O que dizer

> “Em resumo, o EcoColeta é um sistema web completo que integra **educação ambiental**, **logística de coleta**, **gamificação**, **geolocalização** e **dois níveis administrativos**, com segurança anti-bot e regras de negócio no servidor.
>
> A organização em pastas `auth`, `api`, `includes`, `pages` e `admin` reflete separação de responsabilidades. A documentação em `docs/` registra performance e QA.
>
> Agradeço a atenção. Fico à disposição para perguntas sobre qualquer arquivo, função ou fluxo específico.”

---

# ANEXO A — LISTA COMPLETA DE ARQUIVOS PHP EM `api/` (referência rápida)

Consulte a Parte 8 deste roteiro e o relatório em `docs/QA-INTEGRACAO-FLUXOS.md`. Stubs vazios em `api/` (`cadastro.php`, `recuperar.php`) existem por compatibilidade de rewrite — implementação real em `auth/`.

---

# ANEXO B — PERGUNTAS FREQUENTES DA BANCA

| Pergunta | Resposta sugerida |
|----------|-------------------|
| “Por que não usou Laravel?” | Deploy pedagógico em XAMPP; controle explícito do fluxo HTTP. |
| “Como evita SQL injection?” | Prepared statements mysqli em endpoints críticos. |
| “Onde ficam os pontos?” | `entrega.pontos_gerados` − `resgate.pontos_utilizados`; coluna `saldo_ecopoints` sincronizada. |
| “Simulação vs real?” | `pontuacao-coleta.php` simula; `adm-coletas.php` confirma. |
| “Três admins não conflitam?” | Chaves de sessão diferentes por perfil. |

---

*Documento gerado para apresentação acadêmica do projeto EcoColeta.*
