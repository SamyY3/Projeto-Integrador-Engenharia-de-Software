# QA Integracao — Caixa Preta e Branca (fluxos funcionais)

Gerado em: 2026-06-11 01:20:08
Base: `http://localhost/Ecocoleta`

## Resumo
| Resultado | Qtd |
|-----------|-----|
| OK | 45 |
| AVISO | 2 |
| FALHA | 0 |
| Total checks | 47 |

## sessionStorage (recuperar/verificacao/nova-senha)

| Tipo | Teste | Status | Detalhe |
|------|-------|--------|---------|
| branca | auth/recuperar.html grava e-mail ao enviar (setItem resetEmail) | OK |  |
| branca | auth/recuperar.html marca nao verificado (setItem resetVerified) | OK |  |
| branca | auth/verificacao.html le e-mail da etapa anterior (getItem resetEmail) | OK |  |
| branca | auth/verificacao.html grava token apos codigo (setItem resetToken) | OK |  |
| branca | auth/verificacao.html marca verificado (setItem resetVerified) | OK |  |
| branca | auth/nova-senha.html exige verificacao (getItem resetVerified) | OK |  |
| branca | auth/nova-senha.html exige token (getItem resetToken) | OK |  |
| branca | auth/cadastro.html grava e-mail apos cadastro (setItem signupEmail) | OK |  |
| branca | auth/cadastro.html grava codigo teste local (setItem signupCodigoTeste) | OK |  |
| branca | auth/verificar-cadastro.html le e-mail pendente (getItem signupEmail) | OK |  |
| branca | auth/verificar-cadastro.html le codigo teste (getItem signupCodigoTeste) | OK |  |
| branca | nova-senha redireciona sem verificacao | OK |  |

## Login morador + EcoCheck + MySQL

| Tipo | Teste | Status | Detalhe |
|------|-------|--------|---------|
| preta | EcoCheck challenge+verify | OK |  |
| preta | POST login.php credencial seed | OK | user#153 |
| preta | Sessao meu_perfil.php apos login | OK |  |
| branca | login.php exige ecocheck_exigir_token() | OK |  |

## Admin EcoPonto

| Tipo | Teste | Status | Detalhe |
|------|-------|--------|---------|
| preta | POST admin/Login-ADM-Ecoponto.php | OK |  |
| preta | Cookie de sessao recebido | OK | 1 cookies |

## Upload avatar

| Tipo | Teste | Status | Detalhe |
|------|-------|--------|---------|
| preta | POST atualizar-perfil.php foto | OK |  |
| branca | Pasta api/uploads gravavel | OK |  |

## Resgate de premios

| Tipo | Teste | Status | Detalhe |
|------|-------|--------|---------|
| preta | POST verificar_resgates | OK |  |
| branca | Endpoint valida sessao usuario_id | OK |  |

## Coleta / balanca

| Tipo | Teste | Status | Detalhe |
|------|-------|--------|---------|
| preta | GET agendamento status | OK | Use POST para esta acao. |
| preta | GET pontuacao simular | OK | Informe um peso valido para simular. |
| branca | balanca-ecoponto.js + pontuacao-coleta.js | OK |  |

## Fluxo balanca completo

| Tipo | Teste | Status | Detalhe |
|------|-------|--------|---------|
| preta | POST agendar coleta pendente | OK | ag#81 status=pendente |
| preta | POST atualizar_balanca (morador) | OK | 5kg ~70 pts |
| preta | POST adm-coletas confirmar_recebimento | OK | +70 pts |
| preta | Saldo EcoPoints apos confirmacao | OK | antes=58 depois=128 delta=70 |
| branca | coleta_confirmar_recebimento_admin() em pontuacao-coleta.php | OK |  |
| branca | adm-coletas.php acao confirmar_recebimento | OK |  |

## Resgate com debito de pontos

| Tipo | Teste | Status | Detalhe |
|------|-------|--------|---------|
| preta | Saldo antes do resgate | OK | 128 |
| preta | Premio elegivel no banco | AVISO | sem premio disponivel ou saldo insuficiente |

## Admin Plataforma

| Tipo | Teste | Status | Detalhe |
|------|-------|--------|---------|
| preta | POST admin/Login-ADM.php | OK |  |
| preta | Cookie de sessao recebido | OK | 1 cookies |

## Mapa GPS/OSRM/Overpass

| Tipo | Teste | Status | Detalhe |
|------|-------|--------|---------|
| preta | OSRM route API | OK | 2459m |
| preta | Overpass API ecopontos | OK | 0 elementos |
| branca | route-service.js usa OSRM | OK |  |
| branca | mapa.js cache Overpass sessionStorage | OK |  |
| branca | geolocation-service.js presente | OK |  |

## E-mail SMTP

| Tipo | Teste | Status | Detalhe |
|------|-------|--------|---------|
| branca | smtp_settings.json valido | OK |  |
| branca | PHPMailer instalado | OK |  |
| branca | modo_local_sem_email | OK | SMTP configurado |
| preta | testar-email.php sem param | OK | exige email |
| preta | Envio SMTP real | AVISO | Execute manualmente: /api/testar-email.php?email=SEU_EMAIL |

## Cadastro / recuperar senha

| Tipo | Teste | Status | Detalhe |
|------|-------|--------|---------|
| preta | POST cadastro.php + EcoCheck | OK |  |
| preta | POST recuperar.php | OK |  |

## Teste manual complementar
- EcoCheck puzzle visual no navegador (drag real)
- GPS no mapa (permissao do browser)
- Admin: navegar Home-ADM apos login com cookie
- SMTP: `api/testar-email.php?email=...`