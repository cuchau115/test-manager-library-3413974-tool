import { performance } from "node:perf_hooks";
import { ApiClient } from "./api-client.mjs";

const TARGET_BOOK_COUNT = 5000;
const SEARCH_TITLE = "Carga rendimiento";
const PAGE_SIZE = 50;
const CONCURRENCY = 8;
const SEARCH_SAMPLES = 5;

function buildIsbn(index) {
  return String(9780000000000 + index).slice(0, 13);
}

async function forEachConcurrent(items, concurrency, action) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await action(items[index]);
    }
  });
  const results = await Promise.allSettled(workers);
  const failure = results.find((result) => result.status === "rejected");
  if (failure) {
    throw failure.reason;
  }
}

async function findLoadBooks(api) {
  const firstPage = await api.listBooks({ q: SEARCH_TITLE, page: 1, size: PAGE_SIZE });
  const books = [...firstPage.items];
  for (let page = 2; books.length < firstPage.total; page += 1) {
    const result = await api.listBooks({ q: SEARCH_TITLE, page, size: PAGE_SIZE });
    if (!result.items.length) {
      throw new Error("La búsqueda de libros de carga terminó antes del total informado.");
    }
    books.push(...result.items);
  }
  return books.filter((book) =>
    new RegExp(`^${SEARCH_TITLE} \\d{4}$`).test(book.title) &&
    /^978900000\d{4}$/.test(book.isbn),
  );
}

async function deleteLoadBooks(api) {
  const books = await findLoadBooks(api);
  await forEachConcurrent(books, CONCURRENCY, (book) =>
    api.request(`books/${encodeURIComponent(book.id)}`, { method: "DELETE" }),
  );
  return books.length;
}

async function createLoadBooks(api, categories, count) {
  await forEachConcurrent(Array.from({ length: count }, (_, index) => index), CONCURRENCY, async (index) => {
    const number = index + 1;
    await api.createBook({
      title: `${SEARCH_TITLE} ${String(number).padStart(4, "0")}`,
      author: "Autor de carga",
      isbn: buildIsbn(9000000000 + number),
      category_id: categories[index % categories.length].id,
      total_copies: 1,
    });
  });
}

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

  const staleLoadBooks = await deleteLoadBooks(api);
  const categories = await api.listCategories();
  if (!categories.length) {
    throw new Error("La API no devolvió categorías para la prueba de carga.");
  }

  const totalBeforeLoad = (await api.listBooks({ page: 1, size: 1 })).total;
  const loadBookCount = Math.max(0, TARGET_BOOK_COUNT - totalBeforeLoad);
  let timing = [];

  try {
    await createLoadBooks(api, categories, loadBookCount);
    const totalAfterLoad = (await api.listBooks({ page: 1, size: 1 })).total;
    if (totalAfterLoad < TARGET_BOOK_COUNT) {
      throw new Error(`La API informa ${totalAfterLoad} libros; se requieren ${TARGET_BOOK_COUNT}.`);
    }

    for (let sample = 0; sample < SEARCH_SAMPLES; sample += 1) {
      const startedAt = performance.now();
      const result = await api.listBooks({ q: SEARCH_TITLE, page: 1, size: PAGE_SIZE });
      timing.push(performance.now() - startedAt);
      if (result.total !== loadBookCount || result.items.length !== Math.min(loadBookCount, PAGE_SIZE)) {
        throw new Error("La búsqueda no devolvió la cantidad esperada de libros de carga.");
      }
    }

    const maxMs = Math.max(...timing);
    const averageMs = timing.reduce((sum, elapsed) => sum + elapsed, 0) / timing.length;
    console.log(
      `Búsqueda con ${totalAfterLoad} libros: ${SEARCH_SAMPLES} muestras, máximo ${maxMs.toFixed(1)} ms, promedio ${averageMs.toFixed(1)} ms.`,
    );
    if (maxMs >= 300) {
      throw new Error(`RNF-1 incumplido: la búsqueda más lenta tomó ${maxMs.toFixed(1)} ms (límite: <300 ms).`);
    }
  } finally {
    const removed = await deleteLoadBooks(api);
    console.log(`Limpieza: ${removed} libros temporales eliminados lógicamente.`);
  }

  if (staleLoadBooks) {
    console.log(`Se retiraron ${staleLoadBooks} libros residuales de una ejecución interrumpida anterior.`);
  }
}

main().catch((error) => {
  console.error(`Error en la prueba de rendimiento: ${error.message}`);
  process.exitCode = 1;
});
