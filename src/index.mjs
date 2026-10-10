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

  const currentBooks = await api.listAllBooks();
  let created = 0;
  const usedIsbns = new Set(currentBooks.map((book) => book.isbn));

  while (currentBooks.length < BOOK_COUNT) {
    const number = currentBooks.length + 1;
    let isbnNumber = number;
    let isbn = buildIsbn(isbnNumber);
    while (usedIsbns.has(isbn)) {
      isbnNumber += 1;
      isbn = buildIsbn(isbnNumber);
    }
    const category = categories[created % categories.length];

    const book = await api.createBook({
      title: `Libro demo ${number}`,
      author: `Autor ${number}`,
      isbn,
      category_id: category.id,
      total_copies: 2,
    });

    currentBooks.push(book);
    usedIsbns.add(isbn);
    created += 1;
  }

  return { created, categories };
}

async function seedMembers(api) {
  const currentMembers = await api.listAllMembers();
  let created = 0;

  while (currentMembers.length < MEMBER_COUNT) {
    const number = currentMembers.length + 1;
    const member = await api.createMember({
      full_name: `Socio demo ${number}`,
      document_number: `DOC-${String(100000 + number).padStart(8, "0")}`,
    });
    currentMembers.push(member);
    created += 1;
  }

  return { created };
}

async function seedLoans(api, members, books) {
  if (members.length < 3) {
    throw new Error("Se necesitan al menos 3 socios para crear préstamos vencidos sin bloquear los demás.");
  }

  const currentLoans = await api.listAllLoans();
  const loans = [];
  const availableBooks = books.filter((book) => book.available_copies > 0);
  let bookIndex = 0;
  const loansToCreate = Math.max(0, LOAN_COUNT - currentLoans.length);

  for (let offset = 0; offset < loansToCreate; offset += 1) {
    while (bookIndex < availableBooks.length && availableBooks[bookIndex].available_copies < 1) {
      bookIndex += 1;
    }
    const book = availableBooks[bookIndex];
    if (!book) {
      throw new Error("No hay ejemplares disponibles para completar los préstamos de demostración.");
    }

    const loanNumber = currentLoans.length + offset;
    const isOverdue = loanNumber < OVERDUE_LOAN_COUNT;
    const memberIndex = isOverdue
      ? loanNumber
      : 3 + ((loanNumber - OVERDUE_LOAN_COUNT) % (members.length - 3));

    const loanedAt = isOverdue
      ? new Date(Date.now() - (20 + loanNumber) * 24 * 60 * 60 * 1000)
      : new Date();

    const payload = {
      member_id: members[memberIndex].id,
      items: [{ book_id: book.id }],
    };
    if (isOverdue) {
      payload.loaned_at = toIso(loanedAt);
    }
    const loan = await api.createLoan(payload);

    loans.push(loan);
    book.available_copies -= 1;
    bookIndex += 1;
  }

  return loans;
}

async function runSeeder(api) {
  const booksState = await seedBooks(api);
  const membersState = await seedMembers(api);

  const books = await api.listAllBooks();
  const members = await api.listAllMembers();

  if (books.length < BOOK_COUNT || members.length < MEMBER_COUNT) {
    throw new Error("No se alcanzaron los mínimos de libros y socios requeridos.");
  }

  const loans = await seedLoans(api, members, books);
  const overdue = await api.listAllOverdue();
  if (overdue.length !== OVERDUE_LOAN_COUNT) {
    throw new Error(`Se esperaban ${OVERDUE_LOAN_COUNT} líneas vencidas y la API devolvió ${overdue.length}.`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const report = await api.mostBorrowed("2000-01-01", today);
  if (!report.rows.length) {
    throw new Error("El reporte de libros más prestados no devolvió filas.");
  }

  console.log(`Sembrado completado: ${booksState.created} libros creados, ${membersState.created} socios creados, ${loans.length} préstamos creados.`);
  console.log(`Total final: ${books.length} libros, ${members.length} socios, ${overdue.length} líneas vencidas y ${report.rows.length} filas de reporte.`);
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
