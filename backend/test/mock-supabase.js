const tables = { students: [], calls: [], semesters: [], users: [], config: [], audit_log: [], doctor_courses: [], doctors: [], doctor_payments: [] };
const bcrypt = require('bcryptjs');
tables.users.push({ id: 'user-1', username: 'admin', fname: 'Admin', lname: 'Test', role: 'admin', password_hash: bcrypt.hashSync('test1234', 12), active: true });
function makeQuery(table) {
  let rows = [...(tables[table] || [])];
  let filters = [];
  const q = {
    select() { return q; },
    eq(col, val) { filters.push(r => r[col] === val); return q; },
    or() { return q; }, order() { return q; }, range() { return q; }, limit() { return q; },
    single() {
      const filtered = rows.filter(r => filters.every(f => f(r)));
      return Promise.resolve({ data: filtered[0] || null, error: filtered[0] ? null : { message: 'No rows' } });
    },
    insert(obj) {
      const arr = Array.isArray(obj) ? obj : [obj];
      const inserted = arr.map(o => ({ id: 'gen-' + Date.now() + Math.random().toString(36).slice(2,6), ...o }));
      tables[table].push(...inserted);
      return { select() { return { single() { return Promise.resolve({ data: inserted[0], error: null }); } }; } };
    },
    update(obj) {
      return { eq(col, val) { return { select() { return { single() {
        const idx = tables[table].findIndex(r => r[col] === val);
        if (idx === -1) return Promise.resolve({ data: null, error: { message: 'Not found' } });
        tables[table][idx] = { ...tables[table][idx], ...obj };
        return Promise.resolve({ data: tables[table][idx], error: null });
      } }; } }; } };
    },
    delete() { return { eq(col, val) { tables[table] = tables[table].filter(r => r[col] !== val); return Promise.resolve({ error: null }); } }; },
    then(resolve) { const filtered = rows.filter(r => filters.every(f => f(r))); resolve({ data: filtered, error: null, count: filtered.length }); }
  };
  return q;
}
module.exports = { from: (table) => makeQuery(table), _tables: tables };
