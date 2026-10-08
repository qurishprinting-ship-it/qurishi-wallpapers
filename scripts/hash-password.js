#!/usr/bin/env node
'use strict';
// Usage: npm run hash-password   (prompts; nothing is stored or sent anywhere)
// Prints the value for the ADMIN_PASSWORD_HASH environment variable.
const readline = require('readline');
const { hashPassword } = require('../api/_lib/auth');

const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
rl._writeToOutput = function (s) { if (s.includes('\n') || s.startsWith('Admin password')) rl.output.write(s); else rl.output.write('*'); };
rl.question('Admin password (min 12 chars): ', async (pw) => {
  rl.close();
  process.stderr.write('\n');
  if (pw.length < 12) { console.error('Use at least 12 characters.'); process.exit(1); }
  console.log(await hashPassword(pw));
});
