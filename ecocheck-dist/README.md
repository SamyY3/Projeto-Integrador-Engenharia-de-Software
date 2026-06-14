# EcoCheck dist

Artefatos carregados pelas paginas de login/cadastro:

- `ecocheck.iife.js` — modal + puzzle + API `window.EcoCheck`
- `ecocheck.css` — estilos do modal

## Rebuild (opcional)

Com Node.js 18+:

```bat
cd ecocheck
npm install
npm run build
```

O Vite gera novamente estes arquivos a partir de `ecocheck/src` (React + TypeScript + Tailwind).

Se o npm nao estiver disponivel, o bundle atual continua funcional.
