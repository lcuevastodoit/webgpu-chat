# Tests Unitarios para webml-webpage

## Estructura

```
tests/
├── README.md
├── unit/
│   └── runtime.test.js          # Tests para Plan 1: Múltiples Runtimes
└── integration/
    └── (próximamente)
```

## Instalación

```bash
npm install
```

## Ejecutar Tests

```bash
# Ejecutar todos los tests
npm test

# Modo watch (re-ejecuta al guardar)
npm run test:watch

# Con cobertura
npm run test:coverage
```

## Plan de Tests

### Plan 1: Múltiples Runtimes (`runtime.test.js`)

Tests basados en especificación Gherkin (`plan-1-gherkin.md`):

| Feature | Escenarios | Estado |
|---------|------------|--------|
| Abstracción de Runtime | 6 escenarios | 🔴 Pendiente |
| Interfaz Unificada (SOLID) | 2 escenarios | 🔴 Pendiente |
| Experiencia de Usuario | 2 escenarios | 🔴 Pendiente |
| Detección de Capacidades | 2 escenarios | 🔴 Pendiente |
| Manejo de Errores | 2 escenarios | 🔴 Pendiente |
| Métricas y Transparencia | 1 escenario | 🔴 Pendiente |
| Compatibilidad con Modelos | 2 escenarios | 🔴 Pendiente |

**Total: 17 escenarios de test**

## Principios TDD

1. 🔴 **Red**: Escribir test que falle
2. 🟢 **Green**: Implementar código mínimo para pasar
3. 🔵 **Refactor**: Mejorar código manteniendo tests verdes

## Convenciones

- Un `describe` por Feature del Gherkin
- Un `test` por Escenario
- Comentarios Given/When/Then en cada test
- Mock de dependencias externas (localStorage, fetch, etc.)

## Estado Actual

Los tests **fallarán** hasta que se implementen las clases:
- `RuntimeAdapter`
- `RuntimeRegistry`
- `RuntimeManager`
- `OnnxRuntime`
- `EndpointRuntime`

Esto es correcto para TDD — primero los tests, luego la implementación.
