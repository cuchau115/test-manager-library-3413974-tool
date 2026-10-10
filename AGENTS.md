# AGENTS.md — repo `tool` (sembrador de demostración)

> **Lee primero el plan maestro completo:** `../AGENTS.md` (raíz del proyecto). Copia canónica
> versionada: `../test-manager-library-3413974-docs/AGENTS.md`. Este archivo es solo un puntero.

## Reglas duras (resumen; detalle en el maestro §1)
- El sembrador usa **la API**, nunca SQL directo.
- Para los 3 vencidos, seguir **ADR-RL-006** (`DOC-02`); si no existe, parar y avisar.
- Todo con **Docker** (`docker compose run --rm tool`).
- **Commits pequeños** (`tool: …`) y **push** al fork `cuchau115/test-manager-library-3413974-tool`.
- Toda tarea exige **evidencia** (`GET /books` ≥40, `GET /members` 10, `GET /loans/overdue` 3).

## Estado actual del trabajo
- [*] `TOOL-01` completado: cliente HTTP + script base del sembrador, login admin, salud, manejo de errores del contrato y validación con Docker (`node --test`).
- [*] `TOOL-02` completado: sembrado paginado e idempotente de al menos 40 libros y 10 socios; verificado en la API real y segunda ejecución no duplicó datos.
- [*] `TOOL-03` completado: 15 préstamos, exactamente 3 líneas vencidas y filas de reporte verificados en la API real; fechas locales según ADR-RL-006.
- [*] `TOOL-04` completado: imagen Docker y perfil opcional Compose integrados; `docker compose --profile tool run --rm tool` completó la siembra.

## Tareas de este repo (maestro §9.10)
`TOOL-01`…`TOOL-04`. Modelo: `opencode/deepseek-v4-flash`.
Dependencias: `TOOL-01`←DOC-02; `TOOL-02`←T-16.6; `TOOL-03`←T-16.7.
