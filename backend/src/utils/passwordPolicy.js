const ApiError = require('./ApiError');

const PASSWORD_MIN_LENGTH = 8;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /[0-9]/;
const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.';

const isValidPassword = (password) =>
  typeof password === 'string' &&
  password.length >= PASSWORD_MIN_LENGTH &&
  UPPERCASE_REGEX.test(password) &&
  LOWERCASE_REGEX.test(password) &&
  NUMBER_REGEX.test(password) &&
  SPECIAL_CHAR_REGEX.test(password);

// Server is the authoritative enforcement point (frontend validation is a
// convenience, not a substitute) — every password-creation path calls this
// before hashing, and it never echoes the submitted password back in the
// error, only the requirements.
const assertPasswordPolicy = (password) => {
  if (!isValidPassword(password)) {
    throw new ApiError(400, PASSWORD_REQUIREMENTS_MESSAGE);
  }
};

module.exports = { isValidPassword, assertPasswordPolicy, PASSWORD_REQUIREMENTS_MESSAGE, PASSWORD_MIN_LENGTH };
