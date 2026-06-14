# Relatorio QA - Caixa Preta e Caixa Branca (TODAS as paginas)

Gerado em: 2026-06-11 18:42:50
Raiz do projeto: `D:\XAMPP\htdocs\Ecocoleta`
Servidor: **ONLINE - http://localhost/Ecocoleta**

## Resumo executivo

| Metrica | Valor |
|---------|-------|
| Paginas HTML analisadas | **84** |
| Caixa preta OK | **84 / 84** |
| Caixa branca OK | **84 / 84** |
| Com assets/scripts quebrados | **0** |
| HTTP != 200 | **0** |
| PHP com includes ausentes | **2** |

## Metodologia

### Caixa preta
- Arquivo existe no disco
- GET HTTP 200 (Apache)
- URL legada na raiz (.htaccess)
- Assets href/src e scripts locais resolviveis
- Estrutura: html, 	itle, charset, iewport, ase em subpastas
- IDs duplicados (aviso)

### Caixa branca
- equire/equire_once em PHP
- ction de formularios
- Amostra de APIs REST
- Smoke POST login

## Resultado por pagina

| Pagina | Cat. | CP | CB | HTTP | Legado | Assets | Scripts |
|--------|------|----|----|------|--------|--------|---------|
| admin\agendamento-adm.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\Coletas-ADM-Ecoponto.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\configuracoes-adm.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\configuracoes-ADM-Ecoponto.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\ecoponto-adm.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\edicao-perfil-admin.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\Home-ADM.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\Home-ADM-Ecoponto.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\Login-ADM.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\Login-ADM-Ecoponto.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\mapa-publico-adm.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\materias-ADM-Ecoponto.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\relatorio-adm.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\relatorio-ADM-Ecoponto.html | Admin | OK | OK | 200 |  | OK | OK |
| admin\usuarios-adm.html | Admin | OK | OK | 200 |  | OK | OK |
| agendamento-adm.html | Outro | OK | OK | 200 | 200 | OK | OK |
| agendar-coleta.html | Outro | OK | OK | 200 | 200 | OK | OK |
| auth\cadastro.html | Auth | OK | OK | 200 | 200 | OK | OK |
| auth\login.html | Auth | OK | OK | 200 | 200 | OK | OK |
| auth\login-temp.html | Auth | OK | OK | 200 | 200 | OK | OK |
| auth\nova-senha.html | Auth | OK | OK | 200 | 200 | OK | OK |
| auth\recuperar.html | Auth | OK | OK | 200 | 200 | OK | OK |
| auth\resetar.html | Auth | OK | OK | 200 | 200 | OK | OK |
| auth\senha-criada.html | Auth | OK | OK | 200 | 200 | OK | OK |
| auth\verificacao.html | Auth | OK | OK | 200 | 200 | OK | OK |
| auth\verificar-cadastro.html | Auth | OK | OK | 200 | 200 | OK | OK |
| balanca-ecoponto.html | Outro | OK | OK | 200 | 200 | OK | OK |
| cadastro.html | Outro | OK | OK | 200 | 200 | OK | OK |
| Coletas-ADM-Ecoponto.html | Outro | OK | OK | 200 | 200 | OK | OK |
| como-funciona.html | Outro | OK | OK | 200 | 200 | OK | OK |
| configuracoes-adm.html | Outro | OK | OK | 200 | 200 | OK | OK |
| configuracoes-ADM-Ecoponto.html | Outro | OK | OK | 200 | 200 | OK | OK |
| ecoponto-adm.html | Outro | OK | OK | 200 | 200 | OK | OK |
| ecopontos.html | Outro | OK | OK | 200 | 200 | OK | OK |
| edicaoperfil.html | Outro | OK | OK | 200 | 200 | OK | OK |
| edicao-perfil-admin.html | Outro | OK | OK | 200 | 200 | OK | OK |
| educacao-ambiental.html | Outro | OK | OK | 200 | 200 | OK | OK |
| formulario-coleta.html | Outro | OK | OK | 200 | 200 | OK | OK |
| Home-ADM.html | Outro | OK | OK | 200 | 200 | OK | OK |
| Home-ADM-Ecoponto.html | Outro | OK | OK | 200 | 200 | OK | OK |
| index.html | Raiz | OK | OK | 200 |  | OK | OK |
| login.html | Outro | OK | OK | 200 | 200 | OK | OK |
| Login-ADM.html | Outro | OK | OK | 200 | 200 | OK | OK |
| Login-ADM-Ecoponto.html | Outro | OK | OK | 200 | 200 | OK | OK |
| login-temp.html | Outro | OK | OK | 200 | 200 | OK | OK |
| mapa.html | Outro | OK | OK | 200 | 200 | OK | OK |
| mapa\mapa.html | Mapa | OK | OK | 200 |  | OK | OK |
| mapa-publico-adm.html | Outro | OK | OK | 200 | 200 | OK | OK |
| materias-ADM-Ecoponto.html | Outro | OK | OK | 200 | 200 | OK | OK |
| notif-popup.html | Outro | OK | OK | 200 | 200 | OK | OK |
| nova-senha.html | Outro | OK | OK | 200 | 200 | OK | OK |
| pages\agendar-coleta.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\balanca-ecoponto.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\como-funciona.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\ecopontos.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\edicaoperfil.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\educacao-ambiental.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\formulario-coleta.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\mapa.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\notif-popup.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\pagina-relatorio.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\perfil.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\premios-disponiveis.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\quem-somos.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\Ranking.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\relatorio.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\relatorio-mensal.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pages\tela-inicia.html | Publico | OK | OK | 200 | 200 | OK | OK |
| pagina-relatorio.html | Outro | OK | OK | 200 | 200 | OK | OK |
| perfil.html | Outro | OK | OK | 200 | 200 | OK | OK |
| premios-disponiveis.html | Outro | OK | OK | 200 | 200 | OK | OK |
| quem-somos.html | Outro | OK | OK | 200 | 200 | OK | OK |
| Ranking.html | Outro | OK | OK | 200 | 200 | OK | OK |
| recuperar.html | Outro | OK | OK | 200 | 200 | OK | OK |
| relatorio.html | Outro | OK | OK | 200 | 200 | OK | OK |
| relatorio-adm.html | Outro | OK | OK | 200 | 200 | OK | OK |
| relatorio-ADM-Ecoponto.html | Outro | OK | OK | 200 | 200 | OK | OK |
| relatorio-mensal.html | Outro | OK | OK | 200 | 200 | OK | OK |
| resetar.html | Outro | OK | OK | 200 | 200 | OK | OK |
| senha-criada.html | Outro | OK | OK | 200 | 200 | OK | OK |
| tela-inicia.html | Outro | OK | OK | 200 | 200 | OK | OK |
| usuarios-adm.html | Outro | OK | OK | 200 | 200 | OK | OK |
| verificacao.html | Outro | OK | OK | 200 | 200 | OK | OK |
| verificar-cadastro.html | Outro | OK | OK | 200 | 200 | OK | OK |

## Falhas caixa preta (estrutura)
## Detalhes - assets/scripts ausentes
## Caixa branca - PHP
- **api\agendamento_coleta_api.php**: session_start sem verificacao session_status (risco notice)
- **api\saldo_usuario.php**: session_start sem verificacao session_status (risco notice)

## APIs (amostra)
| Endpoint | HTTP | JSON | Resultado |
|----------|------|------|-----------|
| api/ecocheck-api.php?action=status | 200 | sim | OK |
| api/meu_perfil.php | 503 | - | ERR |
| api/notificacoes.php | 503 | - | ERR |
| api/logout.php | 200 | sim | OK |
| api/listar-ecopontos.php | 503 | - | ERR |
| api/ranking.php | 503 | - | ERR |
| api/ranking-ruas.php | 503 | - | ERR |

## Smoke funcional
- **POST login**: ERR - O servidor remoto retornou um erro: (503) Servidor Não Disponível.

## Por categoria
- **Raiz**:  /  caixa preta OK
- **Publico**: 17 / 17 caixa preta OK
- **Auth**: 9 / 9 caixa preta OK
- **Admin**: 15 / 15 caixa preta OK
- **Mapa**:  /  caixa preta OK
- **Outro**: 41 / 41 caixa preta OK

## Testes manuais (nao automatizados)
- Login/cadastro + EcoCheck + MySQL
- Admin plataforma e ecoponto (sessao)
- Mapa: GPS, rota, Overpass
- Upload avatar, resgate premios, agendamento coleta
- E-mail SMTP
