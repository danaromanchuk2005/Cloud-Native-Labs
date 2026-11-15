import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // Вимога: cost factor не менше 12[cite: 35]

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}