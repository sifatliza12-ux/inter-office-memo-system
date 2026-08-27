const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const isValidEmail = (email) => typeof email === 'string' && EMAIL_REGEX.test(email);

module.exports = { isValidEmail };
