# Seed de usuários fictícios

Insere **50 moradores permanentes** na tabela `usuario` do MySQL (banco `ecocoleta`).

Os perfis ficam versionados em `includes/usuarios-seed-data.php` — o mesmo conjunto em qualquer computador que rode o seed.

## Executar

**Windows (XAMPP):**

```bat
config\SEED-USUARIOS.bat
config\SEED-USUARIOS.bat --fresh
```

**Linha de comando (qualquer SO):**

```bash
php database/seed_usuarios.php
php database/seed_usuarios.php --fresh
```

## Comportamento

| Comando | Efeito |
|---------|--------|
| `seed_usuarios.php` | Insere os 50 usuários se ainda não existirem (ou completa faltantes). |
| `seed_usuarios.php --fresh` | Remove todos com e-mail `*@seed.ecocoleta.local` e reinsere os 50. |

## Credenciais dos usuários seed

- **E-mail:** `nome.sobrenome@seed.ecocoleta.local` (50 endereços únicos)
- **Senha:** `Morador@123`
- **Tipo:** todos `morador`
- **Cidades (alternadas):** Juazeiro do Norte, Barbalha, Missão Velha e Crato — CE (bairros e ruas locais)
- **Telefone:** DDD 88 (Ceará)
- **Status:** `ativo` ou `inativo` (coluna `status_conta`, criada automaticamente se faltar)

## Campos preenchidos

Nome completo, e-mail, telefone (DDD 88), senha hash, tipo, status, endereço em bairros de Juazeiro do Norte (`id_rua`, número, cidade, complemento) e data de cadastro distribuída nos últimos 12 meses.

## Painel ADM

A página **Gestão de Usuários** (`admin/usuarios-adm.html`) lista direto do MySQL via `api/listar-usuarios-adm.php` — sem dados mock no front.

## Requisitos

- MySQL do XAMPP em execução
- Banco `ecocoleta` criado (`config\INSTALAR-BANCO.bat`)

Para popular **tudo** de uma vez (usuários, ecopontos, agendamentos, entregas):

```bat
config\SEED-TUDO.bat
```

**Credenciais e visão geral:** [`DADOS-DEMO.md`](DADOS-DEMO.md)
