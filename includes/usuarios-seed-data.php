<?php

declare(strict_types=1);

const ECOSEED_USUARIOS_TOTAL = 50;
const ECOSEED_USUARIOS_EMAIL_SUFFIX = "@seed.ecocoleta.local";
const ECOSEED_USUARIOS_SENHA_PADRAO = "Morador@123";

function ecoseed_usuarios_cidades_rotacao(): array
{
    return [
        "Juazeiro do Norte - CE",
        "Barbalha - CE",
        "Missão Velha - CE",
        "Crato - CE",
    ];
}

function ecoseed_enderecos_por_cidade(): array
{
    return [
        "Juazeiro do Norte - CE" => [
            "Centro" => ["Av. Padre Cícero", "Rua São Pedro", "Rua Franklin Távora"],
            "Triângulo" => ["Rua Catulo da Paixão Cearense", "Rua Coronel Alexandrino", "Rua Monsenhor Otáviano"],
            "Pirajá" => ["Rua Pirajá", "Rua José Lourenço", "Rua Manoel Monteiro"],
            "Horto" => ["Rua do Horto", "Rua Maria José", "Rua Capitão Pedro Teixeira"],
            "Lagoa Seca" => ["Rua Lagoa Seca", "Rua Projetada", "Rua Vicente Sales"],
            "Romeirão" => ["Rua Romeirão", "Rua João Cordeiro", "Travessa Romeirão"],
            "São Miguel" => ["Rua São Miguel", "Rua Antônio Vieira", "Rua Dom José"],
            "Serrinha" => ["Rua Epitácio Leite", "Rua da Serrinha", "Travessa Serrinha"],
            "Dom José" => ["Rua Dom José", "Rua Padre Cícero", "Rua Projetada Dom José"],
            "Bela Vista" => ["Rua Bela Vista", "Rua Projetada Bela Vista", "Travessa Bela Vista"],
            "Alto do Moura" => ["Rua Alto do Moura", "Rua Mestre Vitalino", "Rua Severino Bezerra"],
            "Timbaúba" => ["Rua Timbaúba", "Rua Antônio Rolim", "Rua Francisco das Chagas"],
            "Pedra dos Dias" => ["Rua Pedra dos Dias", "Rua José Euclides", "Rua Dom Manoel"],
        ],
        "Barbalha - CE" => [
            "Centro (Barbalha)" => ["Rua Coronel José Nogueira", "Rua Monsenhor Otáviano", "Praça da Matriz"],
            "Parque da Cidade (Barbalha)" => ["Rua do Parque", "Av. Dom José", "Rua Projetada Parque"],
            "Boa Vista (Barbalha)" => ["Rua Boa Vista", "Rua João Cordeiro", "Travessa Boa Vista"],
            "Santo Antônio (Barbalha)" => ["Rua Santo Antônio", "Rua São Francisco", "Rua Projetada Santo Antônio"],
            "São Sebastião (Barbalha)" => ["Rua São Sebastião", "Rua Antônio Rolim", "Travessa São Sebastião"],
            "Mangueiral (Barbalha)" => ["Rua do Mangueiral", "Rua Francisco das Chagas", "Rua Projetada Mangueiral"],
            "Novo Barbalha" => ["Rua Novo Barbalha", "Av. Padre Cícero", "Rua Projetada Novo Barbalha"],
            "Igreja Nova (Barbalha)" => ["Rua Igreja Nova", "Rua Major Pedro Teixeira", "Travessa Igreja Nova"],
            "Cohab (Barbalha)" => ["Rua da Cohab", "Rua Projetada Cohab", "Rua São José"],
            "São Geraldo (Barbalha)" => ["Rua São Geraldo", "Rua Dom Bosco", "Travessa São Geraldo"],
            "Vale da Lua (Barbalha)" => ["Rua Vale da Lua", "Rua Antônio Vieira", "Rua Projetada Vale da Lua"],
            "Pedras Cariri (Barbalha)" => ["Rua Pedras Cariri", "Rua João XXIII", "Travessa Pedras Cariri"],
        ],
        "Missão Velha - CE" => [
            "Centro (Missão Velha)" => ["Rua Coronel José Nogueira", "Rua Major Pedro Teixeira", "Praça da Matriz"],
            "Cacimbas (Missão Velha)" => ["Rua das Cacimbas", "Rua João Cordeiro", "Travessa Cacimbas"],
            "Pedra Branca (Missão Velha)" => ["Rua Pedra Branca", "Rua Francisco das Chagas", "Rua Projetada Pedra Branca"],
            "Novo Missão (Missão Velha)" => ["Rua Novo Missão", "Av. Dom José", "Rua Projetada Novo Missão"],
            "São José (Missão Velha)" => ["Rua São José", "Rua Antônio Rolim", "Travessa São José"],
            "Bom Jesus (Missão Velha)" => ["Rua Bom Jesus", "Rua São Miguel", "Rua Projetada Bom Jesus"],
            "Lameiro (Missão Velha)" => ["Rua do Lameiro", "Rua Monsenhor Hipólito", "Travessa Lameiro"],
            "Saco (Missão Velha)" => ["Rua do Saco", "Rua João XXIII", "Rua Projetada Saco"],
            "Açudinho (Missão Velha)" => ["Rua do Açudinho", "Rua Dom Manoel", "Travessa Açudinho"],
            "Capela (Missão Velha)" => ["Rua da Capela", "Rua São Pedro", "Rua Projetada Capela"],
            "Varjota (Missão Velha)" => ["Rua Varjota", "Rua Bela Vista", "Travessa Varjota"],
            "Alto da Bela Vista (Missão Velha)" => ["Rua Alto da Bela Vista", "Rua Projetada", "Rua Vicente Sales"],
        ],
        "Crato - CE" => [
            "Centro (Crato)" => ["Rua Major Pedro Teixeira", "Rua Coronel José Nogueira", "Praça da Sé"],
            "Seminário (Crato)" => ["Rua do Seminário", "Rua Monsenhor Otáviano", "Travessa Seminário"],
            "Pimenta (Crato)" => ["Rua Pimenta", "Rua João Cordeiro", "Rua Projetada Pimenta"],
            "Grangeiro (Crato)" => ["Rua Grangeiro", "Rua Antônio Vieira", "Travessa Grangeiro"],
            "Novo Crato" => ["Rua Novo Crato", "Av. Virgílio Távora", "Rua Projetada Novo Crato"],
            "São Miguel (Crato)" => ["Rua São Miguel", "Rua Dom José", "Travessa São Miguel"],
            "Vila Alta (Crato)" => ["Rua Vila Alta", "Rua Francisco das Chagas", "Rua Projetada Vila Alta"],
            "Santa Luzia (Crato)" => ["Rua Santa Luzia", "Rua São Francisco", "Travessa Santa Luzia"],
            "Muriti (Crato)" => ["Rua Muriti", "Rua João XXIII", "Rua Projetada Muriti"],
            "Palmeiral (Crato)" => ["Rua Palmeiral", "Rua Antônio Rolim", "Travessa Palmeiral"],
            "Anarie (Crato)" => ["Rua Anarie", "Rua Dom Bosco", "Rua Projetada Anarie"],
            "Parque Recreio (Crato)" => ["Rua Parque Recreio", "Rua Bela Vista", "Travessa Parque Recreio"],
            "São Gonçalo (Crato)" => ["Rua São Gonçalo", "Rua Padre Cícero", "Rua Projetada São Gonçalo"],
        ],
    ];
}

function ecoseed_bairros_da_cidade(string $cidade): array
{
    $mapa = ecoseed_enderecos_por_cidade();
    return array_keys($mapa[$cidade] ?? []);
}

function ecoseed_usuarios_dataset(): array
{
    $cidades = ecoseed_usuarios_cidades_rotacao();

    $perfis = [
        ["Ana Paula Ferreira Lima", "ana.paula.ferreira"],
        ["Bruno Henrique Alves Costa", "bruno.henrique.alves"],
        ["Camila Fernanda Rocha Souza", "camila.fernanda.rocha"],
        ["Daniel Oliveira Martins", "daniel.oliveira.martins"],
        ["Eduarda Santos Pereira", "eduarda.santos.pereira"],
        ["Felipe Augusto Nunes Dias", "felipe.augusto.nunes"],
        ["Gabriela Rocha Lima", "gabriela.rocha.lima"],
        ["Henrique Alves Carvalho", "henrique.alves.carvalho"],
        ["Isabela Costa Mendes", "isabela.costa.mendes"],
        ["João Pedro Silva Oliveira", "joao.pedro.silva"],
        ["Karina Souza Barbosa", "karina.souza.barbosa"],
        ["Lucas Mendes Teixeira", "lucas.mendes.teixeira"],
        ["Mariana Silva Gomes", "mariana.silva.gomes"],
        ["Nicolas Pereira Ribeiro", "nicolas.pereira.ribeiro"],
        ["Olívia Santos Freitas", "olivia.santos.freitas"],
        ["Paulo Ricardo Araújo", "paulo.ricardo.araujo"],
        ["Queila Andrade Cavalcante", "queila.andrade.cavalcante"],
        ["Rafael Teixeira Holanda", "rafael.teixeira.holanda"],
        ["Sabrina Lima Bezerra", "sabrina.lima.bezerra"],
        ["Thiago Barbosa Matos", "thiago.barbosa.matos"],
        ["Úrsula Campos Feitosa", "ursula.campos.feitosa"],
        ["Vinícius Nunes Arruda", "vinicius.nunes.arruda"],
        ["Wagner Dias Bandeira", "wagner.dias.bandeira"],
        ["Yasmin Freitas Holanda", "yasmin.freitas.holanda"],
        ["Zeca Araújo Paiva", "zeca.araujo.paiva"],
        ["Amanda Vieira Correa", "amanda.vieira.correa"],
        ["Bernardo Pinto Maciel", "bernardo.pinto.maciel"],
        ["Carolina Duarte Sampaio", "carolina.duarte.sampaio"],
        ["Diego Carvalho Brito", "diego.carvalho.brito"],
        ["Eliane Moura Fontenele", "eliane.moura.fontenele"],
        ["Fábio Cunha Teles", "fabio.cunha.teles"],
        ["Gisele Ramos Crispim", "gisele.ramos.crispim"],
        ["Hugo Ferreira Macedo", "hugo.ferreira.macedo"],
        ["Ingrid Lopes Dantas", "ingrid.lopes.dantas"],
        ["Júlio Cardoso Monteiro", "julio.cardoso.monteiro"],
        ["Larissa Gomes Sales", "larissa.gomes.sales"],
        ["Marcelo Ribeiro Antunes", "marcelo.ribeiro.antunes"],
        ["Natália Borges Cavalcanti", "natalia.borges.cavalcanti"],
        ["Otávio Machado Leite", "otavio.machado.leite"],
        ["Patrícia Rezende Holanda", "patricia.rezende.holanda"],
        ["Quésia Nascimento Arruda", "quesia.nascimento.arruda"],
        ["Renato Farias Bezerra", "renato.farias.bezerra"],
        ["Simone Castro Paiva", "simone.castro.paiva"],
        ["Tatiane Pires Holanda", "tatiane.pires.holanda"],
        ["Ubirajara Melo Cavalcante", "ubirajara.melo.cavalcante"],
        ["Valentina Azevedo Teles", "valentina.azevedo.teles"],
        ["William Correa Fontenele", "william.correa.fontenele"],
        ["Ximena Prado Matos", "ximena.prado.matos"],
        ["Yuri Santana Feitosa", "yuri.santana.feitosa"],
        ["Zilda Barros Holanda", "zilda.barros.holanda"],
    ];

    $complementos = [
        "Casa", "Apto 101", "Apto 204", "Bloco B - 12", "Fundos", "Sobrado",
        "Apto 302", "Cobertura", "Kitnet", "Apto 505", "Bloco A - 8", null,
    ];

    $usuarios = [];
    foreach ($perfis as $i => [$nome, $slugEmail]) {
        $cidade = $cidades[$i % count($cidades)];
        $bairrosCidade = ecoseed_bairros_da_cidade($cidade);
        $bairro = $bairrosCidade[$i % max(1, count($bairrosCidade))] ?? "Centro";

        $telA = 9000 + (($i * 173) % 1000);
        $telB = 1000 + (($i * 97) % 9000);
        $diasAtras = 12 + ($i * 7) % 340;

        $usuarios[] = [
            "nome" => $nome,
            "email" => $slugEmail . ECOSEED_USUARIOS_EMAIL_SUFFIX,
            "telefone" => sprintf("(88) 9%04d-%04d", $telA, $telB),
            "tipo_usuario" => "morador",
            "status_conta" => ($i % 13 === 0 || $i % 19 === 0) ? "inativo" : "ativo",
            "cidade" => $cidade,
            "bairro" => $bairro,
            "numero" => (string) (12 + ($i * 17) % 780),
            "complemento" => $complementos[$i % count($complementos)],
            "data_cadastro" => (new DateTimeImmutable("now"))
                ->modify("-{$diasAtras} days")
                ->modify("-" . ($i % 20) . " hours")
                ->format("Y-m-d H:i:s"),
        ];
    }

    return $usuarios;
}

return ecoseed_usuarios_dataset();
