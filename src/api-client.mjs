export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    this.accessToken = null;
  }

  async request(path, { method = "GET", body, authenticated = true } = {}) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (authenticated) {
      if (!this.accessToken) {
        throw new Error("La API requiere iniciar sesión antes de esta solicitud.");
      }
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(new URL(path, this.baseUrl), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let result = null;

    if (text !== "") {
      try {
        result = JSON.parse(text);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(`La API respondió con contenido que no es JSON (HTTP ${response.status}).`);
        }
        throw error;
      }
    }

    if (!response.ok) {
      throw new ApiError(
        response.status,
        result?.code ?? "API_ERROR",
        result?.message ?? `La API respondió HTTP ${response.status}.`,
        result?.details ?? [],
      );
    }

    return result;
  }

  async login(username, password) {
    const result = await this.request("auth/login", {
      method: "POST",
      body: { username, password },
      authenticated: false,
    });

    if (
      typeof result?.access_token !== "string" ||
      result.access_token.length === 0 ||
      result.token_type !== "Bearer" ||
      !Number.isInteger(result.expires_in) ||
      typeof result.role !== "string"
    ) {
      throw new Error("La respuesta de login no cumple el contrato de la API.");
    }

    this.accessToken = result.access_token;
    return { role: result.role, expiresIn: result.expires_in };
  }

  async health() {
    const result = await this.request("health", { authenticated: false });
    if (result?.status !== "ok") {
      throw new Error("La comprobación de salud de la API no devolvió status=ok.");
    }
    return result;
  }
}
