(function (global) {
  "use strict";

  global.EcoApoiadoresCatalog = [
    {
      id: 1,
      name: "VitaNex",
      sector: "Saúde & bem-estar",
      tier: "ouro",
      since: "2024",
      highlight: "Benefícios exclusivos para moradores da região",
      initials: "VN",
      accent: "#0f2c21",
    },
    {
      id: 2,
      name: "PharmaLeaf",
      sector: "Farmácias",
      tier: "prata",
      since: "2024",
      highlight: "Descontos em produtos de higiene sustentável",
      initials: "PL",
      accent: "#1a5c44",
    },
    {
      id: 3,
      name: "SaúdePrime",
      sector: "Clínicas parceiras",
      tier: "ouro",
      since: "2025",
      highlight: "Campanhas de check-up vinculadas a EcoPoints",
      initials: "SP",
      accent: "#164a36",
    },
    {
      id: 4,
      name: "MaxCompra",
      sector: "Varejo local",
      tier: "bronze",
      since: "2025",
      highlight: "Cupons em supermercados do Cariri",
      initials: "MC",
      accent: "#2d6b52",
    },
    {
      id: 5,
      name: "MercaPlus",
      sector: "Alimentação",
      tier: "prata",
      since: "2025",
      highlight: "Troca de pontos por cestas orgânicas",
      initials: "MP",
      accent: "#0d6b38",
    },
  ];

  global.EcoApoiadoresTiers = [
    {
      id: "bronze",
      label: "Bronze",
      price: "A partir de R$ 500/mês",
      perks: [
        "Logo na página de apoiadores",
        "Menção em newsletter mensal",
        "Selo digital EcoColeta Parceiro",
      ],
    },
    {
      id: "prata",
      label: "Prata",
      price: "A partir de R$ 1.200/mês",
      featured: true,
      perks: [
        "Tudo do Bronze",
        "Destaque no carrossel da home",
        "Campanha de cupons para moradores",
        "Relatório trimestral de impacto",
      ],
    },
    {
      id: "ouro",
      label: "Ouro",
      price: "Sob consulta",
      perks: [
        "Tudo do Prata",
        "Patrocínio de prêmios e ranking",
        "Presença em eventos e ecopontos",
        "Dashboard de métricas de engajamento",
      ],
    },
  ];

  global.EcoApoiadoresStats = [
    { value: "5+", label: "Marcas parceiras ativas" },
    { value: "15K+", label: "Moradores alcançados" },
    { value: "2.4t", label: "Reciclados com incentivo" },
    { value: "98%", label: "Satisfação dos parceiros" },
  ];
})(window);
