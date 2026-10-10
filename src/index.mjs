import { ApiClient } from "./api-client.mjs";

async function main() {
  const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8000/api/v1/";
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error("Define ADMIN_USERNAME y ADMIN_PASSWORD en el entorno.");
  }

  const api = new ApiClient(baseUrl);
  const session = await api.login(username, password);
  if (session.role !== "admin") {
    throw new Error(`Se esperaba iniciar sesión como admin; la API devolvió el rol "${session.role}".`);
  }

  await api.health();
  console.log(`Login correcto para "${username}" (rol: admin).`);
  console.log("Salud de la API: ok.");
}

main().catch((error) => {
  console.error(`Error del sembrador: ${error.message}`);
  process.exitCode = 1;
});
