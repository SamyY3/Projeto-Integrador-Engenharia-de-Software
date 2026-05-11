<?php

$host = "localhost";
$usuario = "root";
$senha = "";
$banco = "ecocoleta";

$conexao = mysqli_connect($host, $usuario, $senha, $banco);

if (!$conexao) {
    die("Erro na conexão: " . mysqli_connect_error());
}

?>