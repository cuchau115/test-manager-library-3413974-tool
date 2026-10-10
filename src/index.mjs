import { ApiClient } from "./api-client.mjs";

const BOOK_COUNT = 40;
const MEMBER_COUNT = 10;
const LOAN_COUNT = 15;
const OVERDUE_LOAN_COUNT = 3;

function buildIsbn(index) {
  return String(9780000000000 + index).slice(0, 13);
}

function toIso(date) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function seedBooks(api) {
  const categories = await api.listCategories();
  if (!categories.length) {
    throw new Error("La API no devolvió categorías para sembrar libros.");
  }

  const currentBooks = await api.listBooks({ page: 1, size: 200 });
  const existingCount = currentBooks.items.length;
  let created = 0;

  for (let index = 0; index < BOOK_COUNT - existingCount; index += 1) {
    const category = categories[index % categories.length];
    const number = existingCount + index + 1;

    const book = await api.createBook({
      title: `Libro demo ${number}`,
      author: `Autor ${number}`,
      isbn: buildIsbn(number),
      category_id: category.id,
      total_copies: 2,
    });

    created += book ? 1 : 0;
  }

  return { created, categories };
}

async function seedMembers(api) {
  const currentMembers = await api.listMembers({ page: 1, size: 200 });
  const existingCount = currentMembers.items.length;
  let created = 0;

  for (let index = 0; index < MEMBER_COUNT - existingCount; index += 1) {
    const number = existingCount + index + 1;
    const member = await api.createMember({
      full_name: `Socio demo ${number}`,
      document_number: `DOC-${String(100000 + number).padStart(8, "0")}`,
    });
    created += member ? 1 : 0;
  }

  return { created };
}

async function seedLoans(api, memberIds, bookIds) {
  const loans = [];
  const memberAssignment = memberIds.slice();
  const sortedBooks = [...bookIds];

  for (let index = 0; index < LOAN_COUNT; index += 1) {
    const memberId = memberAssignment[index % memberAssignment.length];
    const itemsCount = 1 + (index % 3);
    const selectedBooks = [];

    for (let itemIndex = 0; itemIndex < itemsCount; itemIndex += 1) {
      const bookId = sortedBooks[(index * 3 + itemIndex) % sortedBooks.length];
      if (!selectedBooks.includes(bookId)) {
        selectedBooks.push(bookId);
      }
    }

    const loanedAt = index < OVERDUE_LOAN_COUNT
      ? new Date(Date.now() - (20 + index) * 24 * 60 * 60 * 1000)
      : new Date();

    const loan = await api.createLoan({
      member_id: memberId,
      loaned_at: toIso(loanedAt),
      items: selectedBooks.map((bookId) => ({ book_id: bookId })),
    });

    loans.push(loan);
  }

  return loans;
}

async function runSeeder(api) {
  const booksState = await seedBooks(api);
  const membersState = await seedMembers(api);

  const books = await api.listBooks({ page: 1, size: 200 });
  const members = await api.listMembers({ page: 1, size: 200 });

  const memberIds = members.items.map((member) => member.id);
  const bookIds = books.items.map((book) => book.id);

  const loans = await seedLoans(api, memberIds, bookIds);

  console.log(`Sembrado completado: ${booksState.created} libros creados, ${membersState.created} socios creados, ${loans.length} préstamos creados.`);
  console.log(`Total final: ${books.items.length} libros, ${members.items.length} socios.`);
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

  await api.health();
  console.log(`Login correcto para "${username}" (rol: admin).`);
  console.log("Salud de la API: ok.");
  await runSeeder(api);
}

main().catch((error) => {
  console.error(`Error del sembrador: ${error.message}`);
  process.exitCode = 1;
});
