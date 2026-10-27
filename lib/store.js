'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

/**
 * Storage: one JSON object per line in data/submissions.jsonl.
 * To use MongoDB (or any database) later, replace only the body of save().
 */
async function save(dataDir, kind, data) {
  const record = { id: crypto.randomUUID(), type: kind, createdAt: new Date().toISOString(), ...data };
  await fs.mkdir(dataDir, { recursive: true });
  await fs.appendFile(path.join(dataDir, 'submissions.jsonl'), JSON.stringify(record) + '\n', { mode: 0o600 });
  return record;
}

module.exports = { save };
