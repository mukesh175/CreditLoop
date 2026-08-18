/**
 * Minimal in-memory stand-in for the Prisma client.
 *
 * Only the operations the financial paths actually use are implemented. It
 * enforces the unique constraints that matter for these tests — particularly
 * IdempotencyRecord(shopId, key), which is what stops duplicate credit.
 */
export function createFakePrisma() {
  const tables = {
    idempotencyRecord: [],
    creditEvent: [],
    auditLog: [],
    customerCreditSnapshot: [],
    returnEvent: [],
    creditAttribution: [],
    orderAttribution: [],
    customerMetric: [],
    notificationLog: [],
    reconciliationRecord: [],
    campaignRecipient: [],
    campaignEvent: [],
    creditRule: [],
    shop: [],
  };

  let idCounter = 0;
  const nextId = () => `id_${++idCounter}`;

  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        if ('in' in value) return value.in.includes(row[key]);
        if ('gte' in value) return row[key] >= value.gte;
        if ('gt' in value) return row[key] > value.gt;
        if ('lte' in value) return row[key] <= value.lte;
        if ('lt' in value) return row[key] < value.lt;
        if ('not' in value) return row[key] !== value.not;
        return true;
      }
      return row[key] === value;
    });

  function compoundWhere(where) {
    // Prisma compound keys arrive as { shopId_key: { shopId, key } }.
    const [first] = Object.values(where);
    return first && typeof first === 'object' && !(first instanceof Date) ? first : where;
  }

  const model = (name) => ({
    async create({ data }) {
      const row = { id: data.id || nextId(), createdAt: new Date(), ...data };
      // Enforce the idempotency unique constraint.
      if (name === 'idempotencyRecord') {
        const clash = tables[name].find(
          (r) => r.shopId === row.shopId && r.key === row.key
        );
        if (clash) {
          const error = new Error('Unique constraint failed on the fields: (`shopId`,`key`)');
          error.code = 'P2002';
          throw error;
        }
      }
      if (name === 'creditEvent' && row.shopifyTransactionId) {
        const clash = tables[name].find(
          (r) => r.shopifyTransactionId === row.shopifyTransactionId
        );
        if (clash) {
          const error = new Error('Unique constraint failed on shopifyTransactionId');
          error.code = 'P2002';
          throw error;
        }
      }
      tables[name].push(row);
      return row;
    },
    async findUnique({ where }) {
      const criteria = compoundWhere(where);
      return tables[name].find((row) => matches(row, criteria)) || null;
    },
    async findFirst({ where = {} } = {}) {
      return tables[name].find((row) => matches(row, where)) || null;
    },
    async findMany({ where = {}, take } = {}) {
      const rows = tables[name].filter((row) => matches(row, where));
      return take ? rows.slice(0, take) : rows;
    },
    async update({ where, data }) {
      const criteria = compoundWhere(where);
      const row = tables[name].find((r) => matches(r, criteria));
      if (!row) throw new Error(`${name} record not found`);
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && 'increment' in value) {
          row[key] = (row[key] || 0) + value.increment;
        } else {
          row[key] = value;
        }
      }
      return row;
    },
    async updateMany({ where = {}, data }) {
      const rows = tables[name].filter((row) => matches(row, where));
      rows.forEach((row) => Object.assign(row, data));
      return { count: rows.length };
    },
    async upsert({ where, create, update }) {
      const criteria = compoundWhere(where);
      const row = tables[name].find((r) => matches(r, criteria));
      if (row) {
        Object.assign(row, update);
        return row;
      }
      return this.create({ data: { ...criteria, ...create } });
    },
    async count({ where = {} } = {}) {
      return tables[name].filter((row) => matches(row, where)).length;
    },
    async deleteMany({ where = {} } = {}) {
      const before = tables[name].length;
      tables[name] = tables[name].filter((row) => !matches(row, where));
      return { count: before - tables[name].length };
    },
    async aggregate({ where = {}, _sum = {} } = {}) {
      const rows = tables[name].filter((row) => matches(row, where));
      const sums = {};
      for (const field of Object.keys(_sum)) {
        sums[field] = rows.reduce((total, row) => total + Number(row[field] || 0), 0);
      }
      return { _sum: sums, _count: rows.length };
    },
    async groupBy() {
      return [];
    },
  });

  const client = { __tables: tables };
  for (const name of Object.keys(tables)) client[name] = model(name);
  client.$transaction = async (operations) =>
    Array.isArray(operations) ? Promise.all(operations) : operations(client);
  return client;
}
