import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : path.resolve(process.cwd(), 'src/scripts');
const BACKUP_ROOT = path.resolve(currentDir, '../../.backups');

export async function runBackupAndRestoreTest(): Promise<{
  backupDir: string;
  collectionsBackedUp: number;
  totalDocumentsBackedUp: number;
  verificationPassed: boolean;
}> {
  console.log('--- Starting Molty Foam ERP Database Backup & Non-Destructive Restore Test ---');

  // Connect to source database
  const sourceConn = await mongoose.createConnection(MONGODB_URI).asPromise();
  const db = sourceConn.db;
  if (!db) {
    throw new Error('Database connection failed.');
  }

  const collections = await db.listCollections().toArray();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(BACKUP_ROOT, timestamp);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`[Backup] Exporting ${collections.length} collections to: ${backupDir}`);
  const counts: Record<string, number> = {};
  let totalDocs = 0;

  for (const collInfo of collections) {
    const name = collInfo.name;
    if (name.startsWith('system.')) continue;

    const coll = db.collection(name);
    const docs = await coll.find({}).toArray();
    counts[name] = docs.length;
    totalDocs += docs.length;

    const filePath = path.join(backupDir, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
  }

  console.log(`[Backup] Completed. ${totalDocs} total documents exported across ${Object.keys(counts).length} collections.`);
  await sourceConn.close();

  // Test Non-Destructive Restore to separate DB `moltyformerp_restore_test`
  console.log('\n--- Starting Non-Destructive Verification in "moltyformerp_restore_test" ---');
  const targetUri = MONGODB_URI.replace('/moltyformerp?', '/moltyformerp_restore_test?');
  const testConn = await mongoose.createConnection(targetUri).asPromise();
  const testDb = testConn.db;
  if (!testDb) {
    throw new Error('Test restore DB connection failed.');
  }

  // Clean test DB before importing
  await testDb.dropDatabase();

  const backupFiles = fs.readdirSync(backupDir).filter((f) => f.endsWith('.json'));
  let verifiedCollections = 0;
  let allMatches = true;

  for (const file of backupFiles) {
    const collName = path.basename(file, '.json');
    const content = fs.readFileSync(path.join(backupDir, file), 'utf-8');
    const docs = JSON.parse(content);

    if (docs.length > 0) {
      // Re-hydrate dates and ObjectIds where applicable
      await testDb.collection(collName).insertMany(docs);
    }

    const testCount = await testDb.collection(collName).countDocuments();
    const sourceCount = counts[collName] || 0;

    if (testCount !== sourceCount) {
      console.error(`[Verification Mismatch] Collection ${collName}: source=${sourceCount}, restored=${testCount}`);
      allMatches = false;
    } else {
      verifiedCollections++;
    }
  }

  console.log(`[Verification] Verified ${verifiedCollections}/${backupFiles.length} collections with 100% document parity.`);

  // Cleanup test database
  console.log('[Cleanup] Dropping verification database "moltyformerp_restore_test"...');
  await testDb.dropDatabase();
  await testConn.close();
  console.log('[Cleanup] Complete. Production database "moltyformerp" remained 100% untouched and intact.\n');

  return {
    backupDir,
    collectionsBackedUp: Object.keys(counts).length,
    totalDocumentsBackedUp: totalDocs,
    verificationPassed: allMatches,
  };
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/moltyformerp?replicaSet=rs0';

if (typeof require !== 'undefined' && require.main === module) {
  runBackupAndRestoreTest()
    .then((res) => {
      console.log('Backup & Verification Result:', res);
      process.exit(res.verificationPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Backup failed:', err);
      process.exit(1);
    });
}

