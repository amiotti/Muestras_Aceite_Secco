const bcrypt = require("bcrypt");

function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return "La clave debe tener al menos 8 caracteres.";
  }
  return null;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function passwordMatches(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  validatePasswordStrength,
  hashPassword,
  passwordMatches,
};

