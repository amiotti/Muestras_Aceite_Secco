const { createUser, findUserByEmail, normalizeEmail } = require("../src/db");
const { hashPassword, validatePasswordStrength } = require("../src/auth");

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return "";
  }
  return process.argv[index + 1] || "";
}

async function main() {
  const email = normalizeEmail(getArgValue("--email"));
  const password = String(getArgValue("--password"));

  if (!email || !password) {
    console.error(
      "Uso: npm run create-user -- --email usuario@dominio.com --password TuClaveSegura"
    );
    process.exit(1);
  }

  const passwordValidationError = validatePasswordStrength(password);
  if (passwordValidationError) {
    console.error(passwordValidationError);
    process.exit(1);
  }

  const existingUser = findUserByEmail(email);
  if (existingUser) {
    console.error(`El usuario ${email} ya existe.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  createUser(email, passwordHash);

  console.log(`Usuario creado correctamente: ${email}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

