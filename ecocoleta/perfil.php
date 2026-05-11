<?php

include("conexao.php");

$sql = "SELECT 
            usuario.nome,
            usuario.email,
            usuario.foto_perfil,
            usuario.numero,
            usuario.cidade,
            usuario.complemento,
            rua.nome_rua,
            bairro.nome_bairro
        FROM usuario
        LEFT JOIN rua ON usuario.id_rua = rua.id_rua
        LEFT JOIN bairro ON rua.id_bairro = bairro.id_bairro
        WHERE usuario.id_usuario = 1";

$resultado = mysqli_query($conexao, $sql);
$usuario = mysqli_fetch_assoc($resultado);

$fotoPerfil = !empty($usuario['foto_perfil']) ? $usuario['foto_perfil'] : "Imagens/mulher.png";
$nomeUsuario = !empty($usuario['nome']) ? $usuario['nome'] : "Usuário";
$emailUsuario = !empty($usuario['email']) ? $usuario['email'] : "email@exemplo.com";
$cidadeUsuario = !empty($usuario['cidade']) ? $usuario['cidade'] : "Cidade não informada";
$ruaUsuario = !empty($usuario['nome_rua']) ? $usuario['nome_rua'] : "Rua não informada";
$numeroUsuario = !empty($usuario['numero']) ? $usuario['numero'] : "S/N";
$bairroUsuario = !empty($usuario['nome_bairro']) ? $usuario['nome_bairro'] : "Bairro não informado";
$complementoUsuario = !empty($usuario['complemento']) ? $usuario['complemento'] : "Sem complemento";

?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Perfil do Usuário</title>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="perfil.css">
  <link rel="stylesheet" href="header.css">
  <link rel="stylesheet" href="notif-popup.css">
  
</head>

<body class="app perfil">


    <header class="topo">
  <div class="nav-left">
    <a href="tela-inicia.html" class="logo-link">
      <img src="Imagens/logo.2.png" alt="EcoColeta">
    </a>
    <nav>
      <ul class="menu">
        <li><a href="tela-inicia.html">Home</a></li>
        <li><a href="pagina-relatorio.html">Gerar Relatório</a></li>
        <li><a href="como-funciona.html">Como Funciona</a></li>
        <li><a href="ecopontos.html">EcoPontos</a></li>
        <li><a href="premios-disponiveis.html">Prêmios</a></li>
        <li><a href="educacao-ambiental.html">Educação</a></li>
        <li><a href="quem-somos.html">Quem Somos</a></li>
        <li><a href="Ranking.html">Ranking</a></li>
      </ul>
    </nav>
  </div>

  <div class="icones">
    <div class="notif-wrapper">
      <button class="notif-btn" aria-label="Notificações">
          <img src="Imagens/icon notificacao.png" alt="Notificações" class="icon">
      </button>
      <div class="notif-overlay hidden">
        <div class="notif-box">
          <div class="header">
            <h2>Notificações</h2>
            <span class="gear">⚙️</span>
          </div>
          <div class="section">
            <p class="section-title">IMPORTANTE</p>
            <div class="item">
              <div class="icon green">♻️</div>
              <div>
                <p>EcoColeta Novo ponto de coleta disponível próxima a você!</p>
                <span>há 30 minutos</span>
              </div>
            </div>
          </div>
          <div class="section">
            <p class="section-title">MAIS NOTIFICAÇÕES</p>
            <div class="item">
              <div class="icon yellow">🏆</div>
              <div class="content">
                <p>Parabéns! Você ganhou <b>50 pontos</b> pela sua coleta de hoje</p>
                <span>há 3 horas</span>
              </div>
              <div class="badge">+50 pts</div>
            </div>
            <div class="item">
              <div class="icon purple">📅</div>
              <div>
                <p><b>Lembrete:</b> Dia de coleta no bairro amanhã</p>
                <span>há 5 horas</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <a href="perfil.php">
      <img src="Imagens/icons pessoa.png" alt="Perfil">
    </a>
  </div>
</header>

<script src="notif-popup.js"></script>

<div class="container">

  <h2 class="titulo-perfil">Perfil do Usuário</h2>

  <div class="perfil-card">
    <div class="perfil-esquerda">
      <img src="<?php echo $fotoPerfil; ?>" class="foto-perfil">

      <div class="info-perfil">
        <h2><?php echo $nomeUsuario; ?></h2>
        <p>UID: <?php echo $emailUsuario; ?></p>
        <div id="user-points" class="ecopontos">1.250 EcoPoints</div>
      </div>
    </div>

    <button class="btn-editar" id="openPerfilModal" type="button" onclick="window.location.href='edicaoperfil.php'">
      Editar perfil <img src="Imagens/lapis.png" class="icone-lapis">
    </button>
  </div>

  


  


  <div class="conteudo-inferior">

    <div class="linha-superior">
      <div class="box historico-box">
        <h3>Histórico de Reciclagem</h3>

        <div class="item-historico">
          <div class="historico-info">
            <span class="bolinha-verde"></span>
            <span>Coleta em EcoPonto Central</span>
          </div>
          <span class="data-historico">12/03/2026</span>
        </div>

        <div class="item-historico">
          <div class="historico-info">
            <span class="bolinha-verde"></span>
            <span>Entrega de Papel e Vidro</span>
          </div>
          <span class="data-historico">05/02/2026</span>
        </div>

        <div class="item-historico">
          <div class="historico-info">
            <span class="bolinha-verde"></span>
            <span>Reciclagem de Plástico</span>
          </div>
          <span class="data-historico">19/01/2026</span>
        </div>

        <div class="item-historico">
          <div class="historico-info">
            <span class="bolinha-verde"></span>
            <span>Coleta de Lixo Eletrônico</span>
          </div>
          <span class="data-historico">10/01/2026</span>
        </div>
      </div>

      <div class="box premios-box">
        <div class="box-header">
          <h3>Prêmios resgatados</h3>
          <span class="box-tag">3 itens</span>
        </div>
        <div class="premios-resgatados">
          <ul class="premios-list">
            <li>EcoCup térmico <span>450 pts</span></li>
            <li>Caneca sustentável <span>320 pts</span></li>
            <li>Kit de sacolas ecológicas <span>580 pts</span></li>
          </ul>
        </div>
      </div>
    </div>

    <div class="linha-inferior">
      <div class="box endereco-box">
        <div class="box-header">
          <h3>Endereço</h3>
          <span class="box-tag">Atualizado</span>
        </div>
        <p class="endereco-cidade"><?php echo $cidadeUsuario; ?></p>
        <p class="endereco-detalhe"><?php echo $ruaUsuario; ?>, <?php echo $numeroUsuario; ?></p>
        <p class="endereco-detalhe">Bairro: <?php echo $bairroUsuario; ?> • Número: <?php echo $numeroUsuario; ?></p>
        <p class="endereco-detalhe">Complemento: <?php echo $complementoUsuario; ?></p>
        <button class="btn-editar-endereco" id="editarEnderecoBtn" type="button" onclick="window.location.href='edicaoperfil.php'">Editar endereço</button>
      </div>

      <div class="box">
        <div class="topo-notificacoes">
          <h3>Notificações</h3>
          <a href="#" class="ver-mais">ver mais ></a>
        </div>

        <div class="notificacao">
          <div>
            <strong>EcoPontos Recebidos</strong>
            <p>+25 pontos por reciclar plástico</p>
          </div>
          <span>Agora mesmo ></span>
        </div>

        <div class="notificacao">
          <div>
            <strong>EcoPontos Recebidos</strong>
            <p>+25 pontos por reciclar plástico</p>
          </div>
          <span>Agora mesmo ></span>
        </div>

        <div class="notificacao">
          <div>
            <strong>EcoPontos Recebidos</strong>
            <p>+25 pontos por reciclar plástico</p>
          </div>
          <span>Agora mesmo ></span>
        </div>
      </div>
    </div>

    <div class="card-principal">
      <h3 class="titulo-agendamento">Agendamento de coleta</h3>

      <div class="area-agendamento">

        <div class="Calendário-box">
          <div class="calendar-header">
            <h4 id="calendarMonthYear" class="titulo-calendario">Calendário de coleta - Maio 2026</h4>
            <div class="calendar-controls">
              <button type="button" id="calendarPrev" class="btn-calendar" aria-label="Mês anterior">◀</button>
              <button type="button" id="calendarNext" class="btn-calendar" aria-label="Próximo mês">▶</button>
            </div>
          </div>

          <div class="agenda-coleta">

            <div class="cabecalho-dias">
              <span>Horário</span>
              <span>Seg<br>4</span>
              <span>Ter<br>5</span>
              <span>Qua<br>6</span>
              <span>Qui<br>7</span>
              <span>Sex<br>8</span>
              <span>Sáb<br>9</span>
              <span>Dom<br>10</span>
            </div>

            <div class="linha-horario">
              <div class="hora">07:00 às 10:00</div>
              <div class="celula"></div>
              <div class="celula"></div>
              <div class="celula"></div>
              <div class="celula"></div>
              <div class="celula coleta">Coleta</div>
              <div class="celula coleta">Coleta</div>
              <div class="celula"></div>
            </div>

            <div class="linha-horario">
              <div class="hora">10:00 às 13:00</div>
              <div class="celula coleta">Coleta</div>
              <div class="celula"></div>
              <div class="celula coleta">Coleta</div>
              <div class="celula"></div>
              <div class="celula"></div>
              <div class="celula"></div>
              <div class="celula"></div>
            </div>

            <div class="linha-horario">
              <div class="hora">13:00 às 16:00</div>
              <div class="celula"></div>
              <div class="celula coleta">Coleta</div>
              <div class="celula"></div>
              <div class="celula coleta">Coleta</div>
              <div class="celula"></div>
              <div class="celula"></div>
              <div class="celula"></div>
            </div>

            <div class="linha-horario">
              <div class="hora">16:00 às 19:00</div>
              <div class="celula"></div>
              <div class="celula"></div>
              <div class="celula"></div>
              <div class="celula coleta">Coleta</div>
              <div class="celula"></div>
              <div class="celula"></div>
              <div class="celula coleta">Coleta</div>
            </div>

            <div class="linha-horario">
              <div class="hora">19:00 às 22:00</div>
              <div class="celula coleta">Coleta</div>
              <div class="celula"></div>
              <div class="celula"></div>
              <div class="celula"></div>
              <div class="celula"></div>
              <div class="celula coleta">Coleta</div>
              <div class="celula"></div>
            </div>

          </div>
        </div>

        <div class="box-agenda">
          <div class="card-nova-coleta">
            <span>Agende uma nova coleta</span>
            <button class="btn-mais" type="button">+</button>
          </div>
          <div class="conteudo-box"></div>
        </div>

      </div>
    </div>

  </div>
</div>

<footer class="footer">
  <div class="footer-container">

    <div class="footer-info">
      <h4>Institucional</h4>
      <p><img src="Imagens/icons pessoa.png" class="icon"> Universidade Faculdade Paraíso</p>
      <p><img src="Imagens/cnpj..png" class="icon"> CNPJ: 00.000.000/0000-00</p>
    </div>

    <div class="footer-logo">
      <img src="Imagens/logo preta.png" alt="EcoColeta">
    </div>

    <div class="footer-contato">
      <h4>Contato</h4>
      <p><img src="Imagens/telefone-.png" class="icon"> (88) 90000-0000</p>
      <p><img src="Imagens/o-email 1.png" class="icon"> ecocoleta@gmail.com</p>
    </div>

  </div>

  <div class="social">
    <img src="Imagens/icons facebook.png">
    <img src="Imagens/email.2.png">
    <img src="Imagens/icons apicativo X.png">
    <img src="Imagens/icons-youtube.png">
    <img src="Imagens/icons-instagram.png">
  </div>

  <div class="footer-copy">
    <p>©️ 2026 Todos os direitos reservados</p>
  </div>
</footer>

<script src="perfil.js"></script>
</body>
</html>