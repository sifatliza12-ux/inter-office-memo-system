// Mirrors backend/src/utils/passwordPolicy.js exactly — the server is the
// authoritative enforcement point (see that file), this is convenience/UX
// only, so the two must stay in sync rather than drift into two different
// policies.
const PASSWORD_MIN_LENGTH = 8;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /[0-9]/;
const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

export const PASSWORD_REQUIREMENTS = [
  { key: 'length', label: '8+ characters', test: (value) => value.length >= PASSWORD_MIN_LENGTH },
  { key: 'uppercase', label: 'One uppercase letter', test: (value) => UPPERCASE_REGEX.test(value) },
  { key: 'lowercase', label: 'One lowercase letter', test: (value) => LOWERCASE_REGEX.test(value) },
  { key: 'number', label: 'One number', test: (value) => NUMBER_REGEX.test(value) },
  { key: 'special', label: 'One special character', test: (value) => SPECIAL_CHAR_REGEX.test(value) },
];

export const isValidPassword = (password) =>
  typeof password === 'string' && PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password));

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.';
