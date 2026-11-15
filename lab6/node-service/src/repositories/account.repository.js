import { BadRequestError, NotFoundError } from '../errors/app-error.js';

export class PostgresAccountRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll() {
    const { rows } = await this.pool.query(
      'SELECT id, user_id, balance::float8 AS balance FROM accounts ORDER BY id ASC'
    );
    return rows;
  }

  async transfer(fromAccountId, toAccountId, amount) {
    if (fromAccountId === toAccountId) {
      throw new BadRequestError('same_account', 'Source and destination accounts must be different');
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new BadRequestError('invalid_amount', 'Transfer amount must be positive');
    }

    // 1. Ручне отримання з'єднання з пулу[cite: 28, 32]
    const client = await this.pool.connect();
    try {
      // 2. Початок транзакції[cite: 28, 32]
      await client.query('BEGIN');

      const fromRes = await client.query(
        'SELECT id, user_id, balance FROM accounts WHERE id = $1 FOR UPDATE',
        [fromAccountId]
      );
      if (fromRes.rows.length === 0) {
        throw new NotFoundError('account_not_found', `Source account ${fromAccountId} not found`);
      }

      const toRes = await client.query(
        'SELECT id, user_id, balance FROM accounts WHERE id = $1 FOR UPDATE',
        [toAccountId]
      );
      if (toRes.rows.length === 0) {
        throw new NotFoundError('account_not_found', `Destination account ${toAccountId} not found`);
      }

      const currentBalance = Number(fromRes.rows[0].balance);
      if (currentBalance < amount) {
        throw new BadRequestError(
          'insufficient_funds',
          `Insufficient balance on account ${fromAccountId}: available ${currentBalance.toFixed(2)}, required ${amount.toFixed(2)}`
        );
      }

      // 3. Списання та зарахування коштів[cite: 28, 32]
      const updatedFrom = await client.query(
        'UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING id, user_id, balance::float8 AS balance',
        [amount, fromAccountId]
      );
      const updatedTo = await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2 RETURNING id, user_id, balance::float8 AS balance',
        [amount, toAccountId]
      );

      // 4. Фіксація транзакції[cite: 28, 32]
      await client.query('COMMIT');

      return {
        status: 'committed',
        transferredAmount: amount,
        fromAccount: updatedFrom.rows[0],
        toAccount: updatedTo.rows[0]
      };
    } catch (err) {
      // 5. Відкат транзакції при будь-якій помилці[cite: 28, 32]
      await client.query('ROLLBACK');
      throw err;
    } finally {
      // 6. Обов'язкове повернення з'єднання в пул[cite: 28, 32]
      client.release();
    }
  }
}