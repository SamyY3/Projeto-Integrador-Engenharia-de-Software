# EcoCheck — puzzle anti-bot (React + TypeScript + Tailwind)

## Componentes

| Arquivo | Função |
|---------|--------|
| `src/components/AntiBotModal.tsx` | Modal com estados loading / playing / success / error |
| `src/components/PuzzleSlider.tsx` | Puzzle deslizante (arrastar peça até o encaixe) |
| `src/services/HumanBehaviorValidator.ts` | Analisa movimento do mouse/dedo (retas, velocidade, tempo) |
| `src/services/VerificationService.ts` | API PHP + token temporário em `sessionStorage` |

## Build

```bash
cd ecocheck
npm install
npm run build
```

Ou no Windows: execute `build.bat`.

Saída: `../ecocheck-dist/ecocheck.iife.js` e `ecocheck.css`.

## API PHP

- `GET ecocheck-api.php?action=challenge` — novo puzzle (imagens GD)
- `POST ecocheck-api.php?action=verify` — valida posição + métricas
- Token válido por 10 min na sessão PHP

## Uso nas páginas

```html
<link rel="stylesheet" href="ecocheck-dist/ecocheck.css">
<link rel="stylesheet" href="ecocheck-widget.css">
<script src="ecocheck-dist/ecocheck.iife.js"></script>
<script src="ecocheck-bridge.js"></script>
```

Envie `ecocheck_token` no POST do login após verificação.
