import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { after, before, describe, it } from "node:test";
import { ApiClient, ApiError } from "../src/api-client.mjs";

const execFileAsync = promisify(execFile);
let server;
let baseUrl;

before(async () => {
  server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const body = chunks.length === 0 ? null : JSON.parse(Buffer.concat(chunks).toString());

    if (request.url === "/api/v1/auth/login" && request.method === "POST") {
      if (body.username === "admin" && body.password === "secret") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          access_token: "test-token",
          token_type: "Bearer",
          expires_in: 28800,
          role: "admin",
        }));
        return;
      }
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        code: "INVALID_CREDENTIALS",
        message: "Credenciales inválidas.",
        details: [],
      }));
      return;
    }

    if (request.url === "/api/v1/health") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (request.url === "/api/v1/books" && request.headers.authorization === "Bearer test-token") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ items: [] }));
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      code: "NOT_FOUND",
      message: "No existe.",
      details: [],
    }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

describe("ApiClient", () => {
  it("inicia sesión y añade el token Bearer a las llamadas protegidas", async () => {
    const api = new ApiClient(baseUrl);
    const session = await api.login("admin", "secret");

    assert.deepEqual(session, { role: "admin", expiresIn: 28800 });
    assert.deepEqual(await api.request("books"), { items: [] });
  });

  it("consulta salud sin token", async () => {
    const api = new ApiClient(baseUrl);

    assert.deepEqual(await api.health(), { status: "ok" });
  });

  it("expone el error del contrato sin perder estado ni detalles", async () => {
    const api = new ApiClient(baseUrl);

    await assert.rejects(api.login("admin", "bad"), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 401);
      assert.equal(error.code, "INVALID_CREDENTIALS");
      assert.equal(error.message, "Credenciales inválidas.");
      assert.deepEqual(error.details, []);
      return true;
    });
  });

  it("rechaza llamadas protegidas antes de iniciar sesión", async () => {
    const api = new ApiClient(baseUrl);

    await assert.rejects(api.request("books"), /iniciar sesión/);
  });

  it("valida la estructura de la respuesta de login", async () => {
    const api = new ApiClient(baseUrl);
    api.request = async () => ({ access_token: "token" });

    await assert.rejects(api.login("admin", "secret"), /no cumple el contrato/);
  });

  it("ejecuta el script base y no revela el token", async () => {
    const { stdout, stderr } = await execFileAsync(process.execPath, ["src/index.mjs"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        API_BASE_URL: baseUrl,
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: "secret",
      },
    });

    assert.match(stdout, /Login correcto para "admin" \(rol: admin\)/);
    assert.match(stdout, /Salud de la API: ok/);
    assert.equal(stderr, "");
    assert.doesNotMatch(stdout, /test-token/);
  });
});
