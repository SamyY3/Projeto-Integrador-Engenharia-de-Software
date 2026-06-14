
(function (global) {
  "use strict";

  var BONUS_MATERIAL = {
    eletronico: 20,
    eletronicos: 20,
    pilhas: 30,
    bateria: 30,
    baterias: 30,
    oleo: 15,
    oleo_cozinha: 15,
    metal: 10,
  };

  function bonusPeso(pesoKg) {
    var p = Math.max(0, Number(pesoKg) || 0);
    if (p <= 0) return 0;
    if (p <= 5) return 10;
    if (p <= 15) return 25;
    if (p <= 30) return 50;
    return 75;
  }

  function bonusMateriais(tipos) {
    var bonus = 0;
    (tipos || []).forEach(function (tipo) {
      var t = String(tipo || "").toLowerCase().trim();
      if (BONUS_MATERIAL[t]) bonus += BONUS_MATERIAL[t];
    });
    return bonus;
  }

  function calcularPontos(pesoKg, tiposResiduo, incluirConclusao) {
    var peso = Math.max(0, Number(pesoKg) || 0);
    var tipos = Array.isArray(tiposResiduo) ? tiposResiduo : [];
    var detalhe = {
      agendamento: 10,
      peso: bonusPeso(peso),
      materiais: bonusMateriais(tipos),
      conclusao: incluirConclusao !== false ? 50 : 0,
    };
    var total = detalhe.agendamento + detalhe.peso + detalhe.materiais + detalhe.conclusao;
    return { total: Math.max(0, total), detalhe: detalhe };
  }

  function calcularNivel(pontosTotais) {
    var p = Math.max(0, parseInt(pontosTotais, 10) || 0);
    if (p >= 2000) return { id: "eco_lenda", nome: "Eco Lenda", min: 2000, max: null };
    if (p >= 1000) return { id: "eco_heroi", nome: "Eco Herói", min: 1000, max: 1999 };
    if (p >= 500) return { id: "eco_guardiao", nome: "Eco Guardião", min: 500, max: 999 };
    if (p >= 200) return { id: "eco_amigo", nome: "Eco Amigo", min: 200, max: 499 };
    return { id: "iniciante", nome: "Iniciante", min: 0, max: 199 };
  }

  global.EcoPontuacaoColeta = {
    calcularPontos: calcularPontos,
    calcularNivel: calcularNivel,
    bonusPeso: bonusPeso,
    bonusMateriais: bonusMateriais,
  };
})(window);
