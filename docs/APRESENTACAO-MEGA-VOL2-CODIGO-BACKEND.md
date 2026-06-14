# Volume 2 — Backend: APIs, Auth, Admin e Includes (Catálogo Completo)

---

# SEÇÃO 1 — INTRODUÇÃO AO BACKEND

**O que dizer:**

> “O backend EcoColeta segue o padrão **script PHP + biblioteca compartilhada**. Cada endpoint em `api/` tem em média 50–200 linhas: valida sessão, lê `$_POST`/`$_GET`, chama funções de `includes/`, devolve `json_encode`. A lógica de negócio **não** deve ser copiada no JavaScript — o front apenas exibe e envia dados.”

**Convenções JSON do projeto:**
```json
{ "sucesso": true, "mensagem": "...", "dados": {} }
{ "sucesso": false, "erro": "Texto para o usuário", "erro_codigo": "opcional" }
```

---

# SEÇÃO 2 — CATÁLOGO `api/` (ENDPOINT POR ENDPOINT)

## 2.1 Autenticação e infraestrutura

### `api/ecocheck-api.php`
| Ação GET/POST | Entrada | Saída | Regra |
|---------------|---------|-------|-------|
| `challenge` | — | `challengeId`, `background`, `piece` base64 | Expira desafios antigos |
| `verify` | JSON body: positionX, durationMs, sampleCount… | `sucesso`, `token` | Tolerância ±10px; min 700ms |
| `status` | — | Se token válido na sessão | Para UI bridge |

### `api/logout.php`
- **Método:** GET ou POST
- **Efeito:** `session_destroy()`, `ecocheck_limpar_verificacao_sessao()`
- **Resposta:** `{ sucesso: true }`

### `api/testar-email.php`
- **Restrição:** localhost only
- **GET `?email=`** → envia e-mail teste via PHPMailer

---

## 2.2 Morador — perfil e conta

### `api/meu_perfil.php` (GET)
**O que dizer:** “Endpoint central do dashboard do morador.”

| Campo resposta | Origem |
|----------------|--------|
| `usuario.nome`, `email`, `foto_perfil` | tabela `usuario` |
| `saldo_ecopoints` | `ecocoleta_obter_saldo_usuario()` |
| `nivel` | `coleta_calcular_nivel()` |
| `estatisticas` | agregação entregas/agendamentos |

### `api/atualizar-perfil.php` (POST multipart)
| Campo POST | Validação |
|------------|-----------|
| `email`, `confirmaremail` | Devem ser iguais |
| `senha`, `confirmarsenha` | Opcional; se preenchida: ≥8 chars, maiúsc/minúsc/número |
| `foto` ou `foto_base64` | PNG/JPG/WebP → `uploads/` |
| `endereco`, `bairro`, `cidade`, `cep`, `numero` | Normalização CEP |

### `api/excluir_conta.php`
- Exige confirmação POST
- Remove ou desativa usuário e limpa sessão

### `api/atualizar-nome.php` / `api/atualizar_nome.php`
- Atualização rápida de nome (legado, resposta texto)

---

## 2.3 Agendamento e coleta

### `api/agendamento_coleta.php`

| `acao` | Método | Parâmetros | Efeito |
|--------|--------|------------|--------|
| `listar` | GET/POST | `desde`, `ate` (DATE) | SELECT agendamentos do usuário |
| `agendar` | POST | `data_coleta`, `slot_ordem` 0–4, `tipo_residuo`, `id_pev?`, `somente_pendente?` | INSERT; notifica morador e admins |
| `atualizar_balanca` | POST | `id_agendamento`, `peso_pendente_kg`, `tipo_residuo` | UPDATE status `aguardando_validacao` |
| `cancelar` | POST | `id_agendamento` ou data+slot | DELETE/soft cancel |

**Validações em `agendar`:**
1. Sessão `usuario_id`
2. `ecocoleta_usuario_tem_endereco_coleta()` — morador com rua no perfil
3. Data ≥ hoje
4. Material não vazio
5. PEV aceita material (`ecoponto_pev_aceita_todos_residuos`)
6. UNIQUE (usuario, data, slot) — erro `ja_agendado`

### `api/ecopontos-agendamento.php`
- Entrada: tipo de resíduo
- Saída: `ecoponto_payload_agendamento()` — lista PEVs ordenada por distância Haversine + sugerido

### `api/pontuacao-coleta.php`
**O que dizer com ênfase:**

> “Este endpoint é **somente leitura/simulação**. Parâmetro `peso_kg` + `tipos[]` → chama `coleta_calcular_pontos()` e devolve estimativa. **Nunca grava no banco.** Isso é decisão de segurança: o morador vê preview; crédito real só via admin.”

### `api/registrar_entrega.php`
- Fluxo alternativo: morador registra entrega direta no PEV
- Calcula pontos a partir de peso se não informado

---

## 2.4 Prêmios e gamificação

### `api/resgate_premio.php` (POST only)

| `acao` | Descrição | Transação |
|--------|-----------|-----------|
| `verificar_resgates` | IDs já resgatados + saldo | Não |
| `listar_historico` | JOIN `resgate` + `beneficio` | Não |
| `resgatar` | Debita pontos, INSERT `resgate` | **BEGIN/COMMIT** |
| `verificar_cupom_novo_usuario` | Elegibilidade ECOSAVE20 | Não |
| `resgatar_cupom_novo_usuario` | Cupom especial conta nova | **Transação** |

**Regras `resgatar`:**
- `SELECT beneficio FOR UPDATE`
- Verifica `saldo >= pontos_necessarios`
- Verifica não duplicado (`uq` lógico por usuario+beneficio)
- `INSERT resgate`
- `UPDATE usuario.saldo_ecopoints` recalculado
- `ecocoleta_notif_resgate()`

### `api/ranking-ruas.php` / `api/ranking.php`
- Agrega peso/pontos por rua no período (semana/mês)
- Bônus top rua: constante `ECORANK_BONUS_PONTOS = 100`
- Se logado: posição pessoal da rua do usuário

---

## 2.5 Notificações

### `api/notificacoes.php`

| `acao` | Efeito |
|--------|--------|
| `listar` | Últimas N notificações |
| `marcar_lida` | `id_notificacao` |
| `marcar_todas_lidas` | UPDATE em lote |
| `contar_nao_lidas` | Badge no header |

**Tipos criados por `notificacoes_helper.php`:** agendamento, coleta concluída, resgate, divergência peso, revisão conta.

---

## 2.6 Geolocalização

### `api/geocode-nominatim.php`
- Proxy servidor para não expor rate-limit no cliente
- Cadeia: Nominatim → Photon → fallback coordenadas Cariri (`geocode-resolver.php`)

### `api/listar-ecopontos.php`
- `?publico=1` — sem sessão admin
- Retorna catálogo `ponto_entrega` + coords + materiais

---

## 2.7 Admin EcoPonto

### `api/adm-coletas.php`

| Método | Ação | Descrição |
|--------|------|-----------|
| GET | — | Lista coletas do PEV do admin logado + resumo hoje |
| POST | `nova` / `criar_coleta` | Admin cria coleta manual |
| POST | `confirmar_recebimento` | **Peso validado + materiais JSON → credita pontos** |
| POST | `status` | Altera status (exceto concluída direto) |
| POST | `responsavel` | Atribui responsável pela coleta |
| POST | `tipo` | Altera tipo caminhão/etc |

**Payload `confirmar_recebimento`:**
```
acao=confirmar_recebimento
id_agendamento=56
peso_validado_kg=5.0
materiais=[{"material":"plastico","peso_kg":5.0}]
```

### `api/adm-dashboard.php`
- KPIs: coletas hoje, peso total, materiais top

### `api/adm-materiais.php`
- GET: linhas de material depositado
- POST: registrar entrada material

### `api/adm-relatorio.php`
- Período: semana, mês, trimestre
- Gráficos por material, evolução peso

### `api/adm-notificacoes.php`
- Igual morador mas para `notificacao_admin`

### `api/configuracoes-adm-ecoponto.php`
- GET/POST preferências JSON do admin ecoponto

### `api/meu-perfil-admin.php` / `api/atualizar-perfil-admin.php`
- Perfil admin ecoponto com foto

---

## 2.8 Admin Plataforma

| Arquivo | Função |
|---------|--------|
| `dashboard-plataforma-adm.php` | KPIs rede inteira, gráficos, agendamentos recentes |
| `listar-usuarios-adm.php` | Paginação moradores |
| `salvar-usuario-adm.php` | CRUD morador |
| `excluir-usuario-adm.php` | Remove morador |
| `listar-ecopontos.php` | Todos PEVs |
| `salvar-ecoponto-adm.php` | CRUD ecoponto + coords |
| `excluir-ecoponto-adm.php` | Remove PEV |
| `listar-agendamentos-adm.php` | Visão global |
| `salvar-agendamento-adm.php` | Editar agendamento |
| `excluir-agendamento-adm.php` | Cancelar |
| `relatorio-plataforma-adm.php` | Analytics consolidado |
| `configuracoes-plataforma-adm.php` | Settings globais |
| `adm-plataforma-administradores.php` | Equipe admin plataforma |
| `meu-perfil-plataforma-adm.php` | Perfil admin plataforma |

---

# SEÇÃO 3 — `auth/*.php` (DETALHADO)

## `auth/login.php`
```
POST: email, senha, ecocheck_token
1. ecocheck_exigir_token()
2. SELECT usuario WHERE LOWER(email)=?
3. password_verify(senha, senha_hash) — suporta legacy md5/sha1 migração
4. $_SESSION[usuario_id, usuario_nome, usuario_email]
5. JSON { sucesso, usuario: { id, nome, email } }
```

## `auth/cadastro.php`
```
POST: nome, email, senha, ecocheck_token
1. ecocheck_exigir_token()
2. senha-validacao.php — regras força + sequências
3. INSERT/UPDATE cadastro_pendente
4. Gera código 6 dígitos, hash, expiração
5. email_helper envia ou modo_local retorna codigo_para_teste
```

## `auth/verificar_cadastro.php`
```
POST: email, codigo (6 dígitos)
1. Valida cadastro_pendente não expirado
2. password_hash da senha pendente
3. INSERT usuario
4. DELETE cadastro_pendente
```

## `auth/recuperar.php`
**Dois modos no mesmo arquivo:**
- **Modo A:** POST só `email` → gera código recuperação → e-mail
- **Modo B:** POST `email` + `codigo` (6 dígitos) → valida → retorna `reset_token` para próxima etapa

## `auth/resetar_senha.php`
```
POST: token, senha
1. Valida reset_token não expirado
2. Atualiza senha_hash
3. Limpa tokens recuperação
```

---

# SEÇÃO 4 — `admin/*.php`

## `admin/Login-ADM.php` (Plataforma)
- EcoCheck obrigatório
- Tabela `administrador_plataforma`
- Sessão: `ecocoleta_plat_admin_*`
- Seed automático se tabela vazia

## `admin/Login-ADM-Ecoponto.php`
- Tabela `administrador_ecoponto`
- `ecoadm_obter_contexto()` vincula admin ao `id_pev`
- Sessão: `ecoponto_admin_id`, `ecoponto_admin_id_pev`

## `admin/admin-plataforma-session.php` / `admin-ecoponto-session.php`
- GET: status sessão (nome, foto, expiração)
- `?acao=logout`: destrói sessão respectiva

---

# SEÇÃO 5 — `includes/` (FUNÇÃO POR FUNÇÃO)

## 5.1 `includes/conexao.php`
- Carrega `conexao.config.php` se existir
- Cria DB `ecocoleta` se ausente
- Executa SQLs de `database/` em ordem
- Expõe `$conn` global mysqli

## 5.2 `includes/session-bootstrap.php`
- `ecocoleta_session_start()` — único ponto de `session_start()` com opções cookie

## 5.3 `includes/stmt_helpers.php`
| Função | Propósito |
|--------|-----------|
| `ecocoleta_stmt_fetch_one_assoc()` | Fetch sem mysqlnd |
| `ecocoleta_stmt_fetch_all_assoc()` | Lista de linhas |
| `ecocoleta_stmt_num_rows()` | Contagem compatível |
| `ecocoleta_obter_saldo_usuario()` | Saldo = entregas − resgates |
| `ecocoleta_obter_saldo_calculado_entrega_resgate()` | Soma SQL |
| `ecocoleta_usuario_tem_coluna_saldo_ecopoints()` | Introspecção schema |

## 5.4 `includes/pontuacao-coleta.php` (18 funções)

| Função | Explicação para o professor |
|--------|----------------------------|
| `coleta_bonus_material_por_tipo()` | Mapa bônus: eletrônicos +20, pilhas +30, óleo +15, metal +10 |
| `coleta_bonus_peso($kg)` | ≤5kg→+10, ≤15→+25, ≤30→+50, >30→+75 |
| `coleta_bonus_materiais($tipos)` | Soma bônus por cada tipo informado |
| `coleta_calcular_pontos($peso, $tipos, $incluirConclusao)` | **Fórmula central** — detalhe em array |
| `coleta_calcular_nivel($pontos)` | Retorna id/nome/min/max do nível gamificado |
| `coleta_calcular_diferenca_percentual($inf, $val)` | % diferença peso informado vs validado |
| `coleta_avaliar_divergencia_peso()` | Matriz decisão: auto_ok / advertência / redução / zero / revisão |
| `coleta_aplicar_penalidade_pontos()` | Aplica % redução ou zera pontos |
| `coleta_garantir_schema_pontuacao()` | ALTER TABLE idempotente colunas pontuação |
| `coleta_confirmar_recebimento_admin()` | **TRANSAÇÃO**: entrega + itens + update agendamento + notif |
| `coleta_validar_materiais_admin()` | Soma materiais = peso balança (±0.05kg) |
| `coleta_notif_*()` | Família de notificações pós-coleta |

### Exemplo numérico para falar em voz alta:
> “Morador agenda plástico, informa **5 kg**. Estimativa: 10 (agendamento) + 10 (peso ≤5) + bônus material + 50 (conclusão) = **~70 pontos**. Admin confirma 5 kg na balança com material plástico 5 kg → `entrega` criada com 70 pontos → saldo morador sobe 70.”

## 5.5 `includes/ecoponto-agendamento.php` (16 funções)

| Função | Propósito |
|--------|-----------|
| `ecoponto_normalizar_tipos_residuo()` | Parse CSV/JSON tipos |
| `ecoponto_haversine_km()` | Distância entre coordenadas |
| `ecoponto_coords_usuario()` | Geocode endereço morador |
| `ecoponto_listar_para_morador()` | PEVs com distância e materiais |
| `ecoponto_payload_agendamento()` | Pacote completo para UI agendar |
| `ecoponto_pev_aceita_residuo()` | Valida material aceito no PEV |

## 5.6 `includes/admin-ecoponto-data.php` (60+ funções) — grupos

| Grupo | Funções representativas |
|-------|------------------------|
| Schema | `ecoadm_garantir_schema_integracao`, `ecoadm_agendamento_tem_coluna` |
| Contexto admin | `ecoadm_obter_contexto`, `ecoadm_vincular_admin_pev` |
| Painel coletas | `ecoadm_listar_coletas_ecoponto_painel`, `ecoadm_resumo_coletas_hoje` |
| Relatórios | `ecoadm_montar_relatorio`, `ecoadm_enriquecer_linhas_relatorio` |
| Materiais | `ecoadm_registrar_material_entrega`, `ecoadm_listar_linhas_materiais` |
| Formatação | `ecoadm_formatar_peso`, `ecoadm_formatar_data_br` |
| Seeds | `ecoseed_pev_padrao_id`, `ecoseed_distribuir_coletas_hoje_rede` |

## 5.7 `includes/email_helper.php`
- `ecocoleta_carregar_smtp_settings()` — lê `config/smtp_settings.json`
- `ecocoleta_enviar_email()` — PHPMailer HTML
- `modo_local_sem_email` — dev sem SMTP

## 5.8 `includes/senha-validacao.php`
- Comprimento 8–16
- Maiúscula, minúscula, número
- Proíbe sequências: 1234, 4321 em runs de 4+

## 5.9 `includes/notificacoes_helper.php`
- `ecocoleta_notif_agendamento()` — morador + admins
- `ecocoleta_notif_resgate()` — confirma cupom
- `ecocoleta_garantir_tabela_notificacao()` — DDL idempotente

## 5.10 `includes/ranking-ruas.php`
- Agrega por `rua`/`bairro`
- Período rolling 7/30 dias
- Cache opcional em memória por request

## 5.11 `includes/geocode-resolver.php`
- `ecocoleta_geocode_endereco()` — cadeia de provedores
- Fallback Juazeiro do Norte centro

## 5.12 Seeds e demos
- `usuarios-seed-data.php` — 50 perfis nome.sobrenome@seed.ecocoleta.local
- `seed-dados-completos.php` — entregas, resgates, notificações demo
- `dashboard-plataforma-demo.php` — fallback se BD vazio

---

# SEÇÃO 6 — `ecocheck/ecocheck-lib.php` (SERVIDOR)

| Função | Algoritmo |
|--------|-----------|
| `ecocheck_gerar_imagens_puzzle()` | GD: retângulo aleatório, recorte peça |
| `ecocheck_gerar_svg_puzzle()` | Fallback sem GD |
| `ecocheck_criar_desafio()` | Persiste challenge em `$_SESSION` |
| `ecocheck_verificar_desafio()` | Valida posição, tempo, samples, straightRatio |
| `ecocheck_token_valido_na_requisicao()` | TTL ~600s |
| `ecocheck_exigir_token()` | Die JSON se inválido |

---

# SEÇÃO 7 — STUBS E ALIASES (EXPLICAR SE PERGUNTAREM)

| Arquivo stub em `api/` | Motivo |
|------------------------|--------|
| `cadastro.php` vazio | Rewrite aponta para `auth/cadastro.php` |
| `recuperar.php` vazio | Rewrite → `auth/recuperar.php` |
| `conexcao.php` vazio | Typo legado; real é `includes/conexao.php` |
| `Login-ADM-Ecoponto.php` vazio | Real em `admin/` |

**O que dizer:**

> “Mantive stubs por **compatibilidade retroativa** de URLs e scripts antigos que ainda referenciam `api/cadastro.php`. O `.htaccess` garante que o caminho correto seja servido.”

---

# SEÇÃO 8 — TRANSIÇÃO VOLUME 3

**O que dizer:**

> “Cobri o backend completo: cada endpoint, cada controller de auth, cada família de funções em `includes/`.
>
> Agora apresento o **frontend**: cada página HTML, cada script JavaScript, componentes React do EcoCheck e módulo de mapa — ou seja, como o usuário vê e interage com essas APIs.”

---

*Fim do Volume 2*
