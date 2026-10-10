# test-manager-library-3413974-tool

> **Prueba técnica · Ficha ADSO 3413974**
> Horario: de **9:15 a. m. a 3:00 p. m.** (15:00). Después, **feria de presentación** de cada proyecto.

Este repositorio guarda las **utilidades** de *Manager Library*: el sembrador de datos de demostración, que usa la API. **Empieza vacío a propósito**: se construye en el fork de cada aprendiz.

## Instrucciones

Cada aprendiz debe **crear el fork** de los seis repositorios del proyecto y **resolver el proyecto
con el spec planteado**.

1. Hacer fork, a su cuenta de GitHub, de cada repositorio de la tabla del final.
2. Leer el spec en [`test-manager-library-3413974-docs`](https://github.com/code-sena/test-manager-library-3413974-docs).
   Se entrega en dos versiones: `spec-python/` y `spec-.net/`.
3. Desarrollar en los forks.

## El reto se desarrolla con React y PHP (Laravel)

El spec está escrito para Python y para .NET, pero el reto **no** se hace en esos lenguajes:

| Capa | Tecnología del reto |
|---|---|
| Frontend | React |
| Backend | PHP con Laravel |

Lo que el spec define sobre el negocio —historias, criterios de aceptación, reglas, contrato de la
API, modelo de datos— se respeta. Lo que define sobre la tecnología se traduce a React y Laravel.

## La prueba no consiste en escribir el código

El propósito principal es ver la **capacidad de desempeño con SDD** (*Spec-Driven Development*,
desarrollo guiado por especificación): cómo se lee, se interpreta y se aplica una especificación
para llevarla a un stack distinto. El código es el medio, no el fin.

## Feria de presentación

Al cerrar la prueba (3:00 p. m.) cada aprendiz **presenta su proyecto** al grupo: qué construyó del spec, qué dejó fuera y por qué,
y una demostración corta de lo que funciona (la aplicación y el sitio público). Lo que se presenta es lo que quedó **subido a los forks
antes de las 3:00 p. m.**: no se presenta nada que no esté en GitHub.

## Los seis repositorios

| Repositorio | Qué va ahí |
|---|---|
| [`test-manager-library-3413974-docs`](https://github.com/code-sena/test-manager-library-3413974-docs) | El spec: `spec-python/` y `spec-.net/` |
| [`test-manager-library-3413974-api`](https://github.com/code-sena/test-manager-library-3413974-api) | Backend en PHP (Laravel) |
| [`test-manager-library-3413974-app`](https://github.com/code-sena/test-manager-library-3413974-app) | Frontend en React |
| [`test-manager-library-3413974-page`](https://github.com/code-sena/test-manager-library-3413974-page) | Sitio público estático de presentación |
| [`test-manager-library-3413974-infra`](https://github.com/code-sena/test-manager-library-3413974-infra) | Contenedores, red, volúmenes y motor de base de datos vacío |
| [`test-manager-library-3413974-tool`](https://github.com/code-sena/test-manager-library-3413974-tool) | Utilidades: sembrador de datos de demostración |

## Cliente de API

El cliente de demostración usa Node.js 20 y `fetch` integrado, sin dependencias externas. Configura
estas variables en el entorno del contenedor:

| Variable | Uso | Valor local habitual |
|---|---|---|
| `API_BASE_URL` | Base versionada de la API | `http://api/api/v1/` dentro de Docker; `http://localhost:8000/api/v1/` desde el host |
| `ADMIN_USERNAME` | Usuario administrador inicial | Configurado por `infra/.env` |
| `ADMIN_PASSWORD` | Contraseña del administrador | Configurada por `infra/.env` |

No guardes credenciales en este repositorio. El script comprueba el login del administrador y la salud
de la API, y nunca imprime el token. El cliente añade `Authorization: Bearer` en las llamadas
protegidas y representa los errores con `ApiError`, usando el cuerpo común del contrato. El sembrador
recorre la paginación respetando el máximo de 50 elementos por página y agrega datos por medio de la
API: al menos 40 libros, 10 socios y 15 préstamos. Para los tres préstamos vencidos envía `loaned_at`,
que solo debe honrarse cuando la API corre con `APP_ENV=local` (ADR-RL-006); en otros entornos el
contrato de producción mantiene la fecha actual.

Al terminar, el script verifica que existan al menos 40 libros y 10 socios, exactamente tres líneas
vencidas y filas en el reporte de más prestados. Los datos de acceso se leen de variables de entorno;
el token no se imprime ni se guarda en disco.

Cuando esté disponible la imagen y el servicio de Compose (`TOOL-04`), se ejecutará desde `infra`:

```sh
docker compose run --rm tool
```

Las pruebas del cliente se ejecutan con Node dentro de Docker, desde `infra`:

```sh
docker compose -f ../test-manager-library-3413974-tool/docker-compose.test.yml run --rm tool-tests
```
