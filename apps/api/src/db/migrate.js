import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './pool.js';
import { getOrderedCreateStatements } from './schemaStatements.js';
import { applySchemaPatches, CREATE_STATEMENTS } from './patch-schema.js';
import { seedSystemSettings } from './seed-system-settings.js';
import { seedTrainingCourses } from './seed-training-courses.js';
import { seedRbac } from './seed-rbac.js';
import { seedHr } from './seed-hr.js';
import { seedHrLetters } from './seed-hr-letters.js';
import { seedErp } from './seed-erp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const schemaFiles = ['schema.sql', 'schema-extended.sql'];
const pool = getPool();

try {
  for (const file of schemaFiles) {
    const schemaPath = path.join(__dirname, file);
    if (!fs.existsSync(schemaPath)) continue;
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const statements = getOrderedCreateStatements(sql);
    for (const statement of statements) {
      await pool.query(statement);
      const match = statement.match(/CREATE TABLE IF NOT EXISTS `?(\w+)`?/i);
      console.log('Created:', match?.[1] || 'table');
    }
  }

  console.log('\nApplying schema patches...');
  await applySchemaPatches(pool);
  for (const statement of CREATE_STATEMENTS) {
    await pool.query(statement);
    const match = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    console.log('Created:', match?.[1] || 'table');
  }

  await seedSystemSettings(pool);
  console.log('\nSeeding training courses...');
  await seedTrainingCourses(pool);
  console.log('\nSeeding RBAC roles & permissions...');
  await seedRbac(pool);
  console.log('\nSeeding HR defaults...');
  await seedHr(pool);
  console.log('\nSeeding HR letter templates...');
  await seedHrLetters(pool);
  console.log('\nSeeding ERP defaults...');
  await seedErp(pool);
  console.log('\nMigration complete.');
} catch (error) {
  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('\nMySQL access denied. Check apps/api/.env and Hostinger Remote MySQL whitelist for VPS IP 187.124.2.238');
  }
  throw error;
} finally {
  await pool.end();
}
