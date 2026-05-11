<?php

include("conexao.php");

$nome = $_POST['nome'];

$sql = "UPDATE usuario
        SET nome = '$nome'
        WHERE id_usuario = 1";

$resultado = mysqli_query($conexao, $sql);

if($resultado){

    echo "sucesso";

} else {

    echo "erro";

}

?>