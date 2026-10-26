const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredText(value, label, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new Error(`${label} est obligatoire (maximum ${max} caractères).`);
  }
  return value.trim();
}

function positiveId(value, label = 'Identifiant') {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error(`${label} invalide.`);
  return id;
}

function validEmail(value) {
  const email = requiredText(value, 'Email', 254).toLowerCase();
  if (!emailPattern.test(email)) throw new Error('Adresse email invalide.');
  return email;
}

module.exports = { requiredText, positiveId, validEmail };