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

  async request(path, { method = "GET", body, authenticated = true, headers = {} } = {}) {
    const requestHeaders = { Accept: "application/json", ...headers };
    if (body !== undefined) {
      requestHeaders["Content-Type"] = "application/json";
    }
    if (authenticated) {
      if (!this.accessToken) {
        throw new Error("La API requiere iniciar sesión antes de esta solicitud.");
      }
      requestHeaders.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(new URL(path, this.baseUrl), {
      method,
      headers: requestHeaders,
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

  async listCategories() {
    const result = await this.request("categories");
    const categories = Array.isArray(result) ? result : result?.items;
    if (!Array.isArray(categories)) {
      throw new Error("GET /categories no devolvió una lista.");
    }
    return categories;
  }

  async listBooks({ q = "", categoryId = null, page = 1, size = 50 } = {}) {
    const query = new URLSearchParams({ page: String(page), size: String(size) });
    if (q) query.set("q", q);
    if (categoryId) query.set("category_id", categoryId);

    const result = await this.request(`books?${query.toString()}`);
    if (
      !result ||
      typeof result !== "object" ||
      !Array.isArray(result.items) ||
      !Number.isInteger(result.page) ||
      !Number.isInteger(result.size) ||
      !Number.isInteger(result.total)
    ) {
      throw new Error("GET /books no devolvió la estructura paginada esperada.");
    }
    return result;
  }

  async listAllBooks() {
    return this.listAllPages((page, size) => this.listBooks({ page, size }));
  }

  async createBook(payload) {
    const result = await this.request("books", {
      method: "POST",
      body: payload,
    });
    if (!result || typeof result !== "object" || !result.id) {
      throw new Error("POST /books no devolvió un libro válido.");
    }
    return result;
  }

  async listMembers({ q = "", page = 1, size = 50 } = {}) {
    const query = new URLSearchParams({ page: String(page), size: String(size) });
    if (q) query.set("q", q);

    const result = await this.request(`members?${query.toString()}`);
    if (
      !result ||
      typeof result !== "object" ||
      !Array.isArray(result.items) ||
      !Number.isInteger(result.page) ||
      !Number.isInteger(result.size) ||
      !Number.isInteger(result.total)
    ) {
      throw new Error("GET /members no devolvió la estructura paginada esperada.");
    }
    return result;
  }

  async listAllMembers() {
    return this.listAllPages((page, size) => this.listMembers({ page, size }));
  }

  async createMember(payload) {
    const result = await this.request("members", {
      method: "POST",
      body: payload,
    });
    if (!result || typeof result !== "object" || !result.id) {
      throw new Error("POST /members no devolvió un socio válido.");
    }
    return result;
  }

  async createLoan(payload) {
    const result = await this.request("loans", {
      method: "POST",
      body: payload,
    });
    if (!result || typeof result !== "object" || !result.id) {
      throw new Error("POST /loans no devolvió un préstamo válido.");
    }
    return result;
  }

  async listLoans({ page = 1, size = 50 } = {}) {
    const query = new URLSearchParams({ page: String(page), size: String(size) });
    const result = await this.request(`loans?${query.toString()}`);
    if (
      !result ||
      typeof result !== "object" ||
      !Array.isArray(result.items) ||
      !Number.isInteger(result.page) ||
      !Number.isInteger(result.size) ||
      !Number.isInteger(result.total)
    ) {
      throw new Error("GET /loans no devolvió la estructura paginada esperada.");
    }
    return result;
  }

  async listAllLoans() {
    return this.listAllPages((page, size) => this.listLoans({ page, size }));
  }

  async listOverdue({ page = 1, size = 50 } = {}) {
    const query = new URLSearchParams({ page: String(page), size: String(size) });
    const result = await this.request(`loans/overdue?${query.toString()}`);
    if (
      !result ||
      typeof result !== "object" ||
      !Array.isArray(result.items) ||
      !Number.isInteger(result.page) ||
      !Number.isInteger(result.size) ||
      !Number.isInteger(result.total)
    ) {
      throw new Error("GET /loans/overdue no devolvió una lista.");
    }
    return result;
  }

  async listAllOverdue() {
    return this.listAllPages((page, size) => this.listOverdue({ page, size }));
  }

  async getLoan(id) {
    const result = await this.request(`loans/${encodeURIComponent(id)}`);
    if (!result || typeof result !== "object" || result.id !== id || !Array.isArray(result.items)) {
      throw new Error("GET /loans/{id} no devolvió un préstamo válido.");
    }
    return result;
  }

  async mostBorrowed(from, to) {
    const query = new URLSearchParams({ from, to });
    const result = await this.request(`reports/most-borrowed?${query.toString()}`);
    if (!result || typeof result !== "object" || !Array.isArray(result.rows)) {
      throw new Error("GET /reports/most-borrowed no devolvió filas.");
    }
    return result;
  }

  async listAllPages(fetchPage, size = 50) {
    const firstPage = await fetchPage(1, size);
    const items = [...firstPage.items];
    for (let page = 2; items.length < firstPage.total; page += 1) {
      const result = await fetchPage(page, size);
      if (result.items.length === 0) {
        throw new Error("La API devolvió una página vacía antes de alcanzar el total indicado.");
      }
      items.push(...result.items);
    }
    return items;
  }
}
