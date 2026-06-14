# Deploy EcoColeta em Hospedagem PHP/MySQL

## Requisitos

- PHP 8.0 ou superior com `mysqli` habilitado.
- MySQL/MariaDB.
- Acesso ao cPanel, FTP ou Gerenciador de Arquivos.
- Pasta publica da hospedagem, geralmente `public_html`.

## Arquivos para subir

Envie todos os arquivos do projeto para `public_html`, incluindo:

- Arquivos `.html`, `.php`, `.css`, `.js`
- Pastas `Imagens`, `uploads`, `vendor`
- Arquivos `.sql` apenas se voce for importar pelo painel da hospedagem

Nao deixe senhas dentro de arquivos publicos versionados.

## Configurar banco

1. No cPanel, crie um banco MySQL.
2. Crie um usuario MySQL e vincule ao banco com todas as permissoes.
3. Importe os SQLs nesta ordem:
   - `SQL_BDD_EcoColeta.sql`
   - `usuario_edicao_opcional.sql`
   - `corrigir_tipo_expiracao_codigo.sql`
   - `premios_beneficios_resgate.sql`
   - `agendamento_coleta_tab.sql`
   - `cadastro_pendente_tab.sql`
   - `notificacao_tab.sql`

## Configurar conexao

1. Copie `conexao.config.example.php` para `conexao.config.php`.
2. Edite `conexao.config.php` com os dados reais:

```php
<?php
return [
    "host" => "localhost",
    "usuario" => "USUARIO_DO_BANCO",
    "senha" => "SENHA_DO_BANCO",
    "banco" => "NOME_DO_BANCO",
    "auto_install" => false,
];
```

Em hospedagem compartilhada, o nome do banco e usuario normalmente tem prefixo do cPanel, por exemplo:

```text
meusite_ecocoleta
meusite_usuario
```

## Pagina inicial

O `.htaccess` define:

```apache
DirectoryIndex tela-inicia.html index.html
```

Assim, ao abrir o dominio, a home sera `tela-inicia.html`.

## Testes apos subir

Abra estas URLs:

- `/tela-inicia.html`
- `/login.html`
- `/cadastro.html`
- `/premios-disponiveis.html`
- `/Login-ADM-pontos.html`

Teste tambem:

- Login de usuario.
- Login ADM EcoPonto.
- Perfil do usuario.
- Agendamento de coleta.
- Resgate de premios.

## Login ADM EcoPonto inicial

O endpoint `login-adm-pontos.php` cria a tabela `administrador_ecoponto` automaticamente se ela nao existir.

Se a tabela estiver vazia, ele cria um acesso local inicial:

```text
E-mail: admin.ecoponto@ecocoleta.local
Senha: EcoPonto@123
```

Depois de publicar, altere essa senha no banco ou crie um administrador real.

## Observacoes de seguranca

- O `.htaccess` bloqueia acesso publico a `conexao.config.php` e arquivos `.sql`.
- Mantenha `conexao.config.php` fora de repositorios publicos.
- Em producao, use senha forte para banco e administradores.
