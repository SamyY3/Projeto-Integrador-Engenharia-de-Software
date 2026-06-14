# Dados de demonstração (EcoColeta)

Todos os dados fictícios ficam **versionados no código** em `includes/` e `database/seed_*.php`.  
Ao instalar o banco, o sistema popula automaticamente o MySQL com o mesmo conjunto em qualquer máquina.

## Instalação automática

1. `config\INICIAR-PROJETO.bat` — sobe Apache + MySQL  
2. `config\INSTALAR-BANCO.bat` — cria tabelas + roda seed completo  
3. Na primeira visita ao site, se faltar algo, o `includes/eco-seed-bootstrap.php` completa os dados.

Para repopular tudo do zero:

```bat
config\SEED-TUDO.bat --fresh
```

## Onde os dados estão no código

| Conteúdo | Arquivo |
|----------|---------|
| 50 moradores fictícios | `includes/usuarios-seed-data.php` |
| Ecopontos do mapa | `includes/ecopontos-catalog-data.php` |
| Coletas admin ecoponto | `includes/coletas-ecoponto-seed.php` |
| Agendamentos plataforma | `includes/agendamentos-plataforma-seed.php` |
| Entregas, resgates, prêmios, admins | `includes/seed-dados-completos.php` |
| Relatórios mensais | `includes/relatorio-plataforma-seed.php` |

## Credenciais de acesso

### Moradores (site)

- **E-mail:** qualquer `nome.sobrenome@seed.ecocoleta.local` (50 perfis no seed)  
  Exemplo: `ana.paula.ferreira@seed.ecocoleta.local`
- **Senha:** `Morador@123`

### Admin EcoPonto

- **URL:** `http://localhost/Ecocoleta/admin/Login-ADM-Ecoponto.html`
- **E-mail:** `admin.ecoponto@ecocoleta.local`
- **Senha:** `EcoPonto@123`
- Equipe demo: mais 4 admins criados automaticamente pelo seed

### Admin Plataforma

- **URL:** `http://localhost/Ecocoleta/admin/Login-ADM.html`
- **E-mail:** `admin.plataforma@ecocoleta.local`
- **Senha:** `EcoPlat@2026`

## O que aparece nas telas

Após instalar + seed:

- **Ranking** — moradores com pontos e entregas  
- **Prêmios** — benefícios e resgates de exemplo  
- **Admin Coletas** — dezenas de coletas agendadas  
- **Admin Home** — gráficos e resumo do dia  
- **Mapa** — ecopontos do catálogo sincronizados no banco  
- **Relatórios** — evolução mensal com dados seed

## Desativar seed automático

No servidor ou `.env`, defina:

```
ECO_SEED_AUTO=0
```

Ou em `includes/conexao.config.php`:

```php
return ['auto_install' => false];
```
