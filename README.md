# Projeto-Integrador-Engenharia-de-Software
EcoColeta — Plataforma de Coleta Seletiva Gamificada

EcoColeta é uma plataforma web full stack voltada à gestão inteligente de coleta seletiva, desenvolvida com foco em sustentabilidade, engajamento comunitário e experiência do usuário. O sistema conecta moradores, ecopontos parceiros e gestores da plataforma em um ecossistema digital onde o descarte consciente gera impacto ambiental mensurável e recompensas reais.

O projeto nasce da necessidade de tornar a reciclagem mais acessível e motivadora: em vez de apenas informar onde descartar, o EcoColeta gamifica o processo - o morador agenda coletas, registra o peso dos materiais, acompanha rotas no mapa, acumula EcoPoints após validação do ecoponto e troca pontos por benefícios de parceiros locais.

O que o sistema faz
Para o morador

Cadastro com verificação de e-mail e recuperação de senha
Agendamento de coletas com simulação de balança e validação de materiais
Mapa interativo com ecopontos, geocodificação e navegação turn-by-turn (OSRM)
Ranking por rua, perfil personalizado e histórico de atividades
Resgate de prêmios e cupons com sistema de pontuação anti-fraude
Relatórios ambientais com métricas de impacto (CO₂ evitado, árvores, energia)
Para administradores

Painel Plataforma — visão macro: usuários, ecopontos, agendamentos, relatórios e configurações
Painel EcoPonto — operação local: confirmação de coletas, validação de peso, materiais e notificações
Fluxo completo de coleta: pendente → balança → aguardando validação → confirmado → pontuação
Segurança e qualidade

EcoCheck — módulo anti-bot em React/TypeScript com puzzle deslizante, integrado ao fluxo de autenticação
Validação de senha, sessões separadas por perfil e APIs REST em PHP
QA automatizado cobrindo 40+ páginas e 50+ verificações de integração
Stack e arquitetura
Camada	Tecnologias
Backend
PHP 8, MySQL, APIs JSON, PHPMailer, Composer
Frontend
HTML5, CSS3, JavaScript (vanilla), design responsivo
Mapas
Leaflet, OSRM, Nominatim, módulo de navegação próprio
Segurança
EcoCheck (React + TypeScript, build IIFE)
Infra
XAMPP/Apache, .htaccess, scripts de deploy e seed
Dados
20+ tabelas, migrações SQL, seed versionado no código
A arquitetura segue separação clara de responsabilidades: pages/ e auth/ no cliente, api/ como camada de serviços, includes/ com regras de negócio reutilizáveis, admin/ com dois painéis distintos e database/ com schema versionado. O projeto conta com ~500 arquivos, 45+ endpoints e dados de demonstração que populam o banco automaticamente em qualquer ambiente — ideal para avaliação, banca ou clone local em minutos.

Destaques técnicos:
Sistema de pontuação com detecção de fraude (peso informado vs. validado)
Dual admin: gestão macro (plataforma) e operacional (ecoponto)
Mapa com HUD de navegação e acompanhamento da posição do usuário em tempo real
Seed completo versionado — 50 moradores, ecopontos do Cariri, prêmios e coletas demo
EcoCheck como biblioteca React empacotada e consumida pelo front estático
Documentação técnica em 4 volumes (arquitetura, backend, frontend, fluxos E2E)
Frase de impacto (bio / headline)
"Transformei a coleta seletiva em uma experiência digital gamificada — com mapas, pontos, prêmios e dois painéis administrativos, do cadastro do morador à validação no ecoponto."
