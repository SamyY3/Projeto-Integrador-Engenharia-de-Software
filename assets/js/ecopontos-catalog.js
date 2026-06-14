

(function (global) {
  "use strict";

  var RESPONSAVEIS = [
    "Mariana Silva",
    "Carlos Mendes",
    "Ana Paula Rocha",
    "João Pedro Lima",
    "Fernanda Costa",
    "Ricardo Alves",
    "Patrícia Nunes",
    "Lucas Ferreira",
  ];

  var CAPACIDADES = [52, 61, 68, 72, 78, 84, 88, 91, 45, 58, 63, 70, 76, 82];

  var BASE = [
    { id: "juazeiro-centro", name: "EcoPonto Verde", address: "Centro, Juazeiro do Norte", city: "Juazeiro do Norte", lat: -7.2127, lng: -39.3155, bairro: "Centro" },
    { id: "juazeiro-lagoa-seca", name: "Ponto Verde Sustentável", address: "Lagoa Seca, Juazeiro do Norte", city: "Juazeiro do Norte", lat: -7.2468, lng: -39.3042, bairro: "Lagoa Seca" },
    { id: "juazeiro-piraja", name: "ReciclaJá", address: "Pirajá, Juazeiro do Norte", city: "Juazeiro do Norte", lat: -7.1972, lng: -39.3238, bairro: "Pirajá" },
    { id: "crato-centro", name: "Centro de Reciclagem Ambiental", address: "Centro, Crato", city: "Crato", lat: -7.2343, lng: -39.4097, bairro: "Centro" },
    { id: "crato-seminario", name: "Espaço EcoVida", address: "Seminário, Crato", city: "Crato", lat: -7.2267, lng: -39.4275, bairro: "Seminário" },
    { id: "barbalha-centro", name: "Estação de Reciclagem", address: "Centro, Barbalha", city: "Barbalha", lat: -7.3124, lng: -39.3049, bairro: "Centro" },
    { id: "barbalha-parque", name: "Núcleo de Coleta Sustentável", address: "Parque da Cidade, Barbalha", city: "Barbalha", lat: -7.2998, lng: -39.2926, bairro: "Parque da Cidade" },
    { id: "missao-velha-centro", name: "PEV Verde", address: "Centro, Missão Velha", city: "Missão Velha", lat: -7.2497, lng: -39.1437, bairro: "Centro" },
    { id: "caririacu-centro", name: "EcoCentro Comunitário", address: "Centro, Caririaçu", city: "Caririaçu", lat: -7.0428, lng: -39.2848, bairro: "Centro" },
    { id: "jardim-centro", name: "Planeta Verde", address: "Centro, Jardim", city: "Jardim", lat: -7.5755, lng: -39.2826, bairro: "Centro" },
    { id: "milagres-centro", name: "EcoFuturo", address: "Centro, Milagres", city: "Milagres", lat: -7.3138, lng: -38.9458, bairro: "Centro" },
    { id: "nova-olinda-centro", name: "Recicle-se", address: "Centro, Nova Olinda", city: "Nova Olinda", lat: -7.0866, lng: -39.6803, bairro: "Centro" },
    { id: "santana-cariri-centro", name: "EcoAção", address: "Centro, Santana do Cariri", city: "Santana do Cariri", lat: -7.1774, lng: -39.7371, bairro: "Centro" },
    { id: "farias-brito-centro", name: "Verdejando", address: "Centro, Farias Brito", city: "Farias Brito", lat: -6.9308, lng: -39.5656, bairro: "Centro" },
    { id: "brejo-santo-centro", name: "EcoVibe", address: "Centro, Brejo Santo", city: "Brejo Santo", lat: -7.4929, lng: -38.9877, bairro: "Centro" },
  ];

  global.EcoColetaEcopontosCatalog = BASE.map(function (p, i) {
    return {
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      lat: p.lat,
      lng: p.lng,
      bairro: p.bairro || p.city,
      status: p.status || "ativo",
      capacidade: CAPACIDADES[i % CAPACIDADES.length],
      responsavel: RESPONSAVEIS[i % RESPONSAVEIS.length],
    };
  });
})(window);
