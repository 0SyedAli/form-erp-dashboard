import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Brand, Category, Size, Thickness, Product, Variant } from '../models/index.js';

export async function cleanAndSeedCatalogue() {
  const isSelfConnected = mongoose.connection.readyState !== 1;
  if (isSelfConnected) {
    console.log('Connecting to database...');
    await connectDatabase();
  }
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection failed');

  console.log('Cleaning up test catalogue records...');

  // 1. Delete test and dummy brands
  const brandDelete = await db.collection('brands').deleteMany({
    $or: [
      { name: { $regex: /test|POS|Purchasing/i } },
      { code: { $regex: /TEST|BP/i } },
    ],
  });
  console.log('Deleted test brands:', brandDelete.deletedCount);

  // 2. Delete test categories
  const catDelete = await db.collection('categories').deleteMany({
    $or: [
      { name: { $regex: /test|POS/i } },
      { code: { $regex: /TCAT|PM|FT/i } },
    ],
  });
  console.log('Deleted test categories:', catDelete.deletedCount);

  // 3. Delete non-standard sizes (keep only standard mattress dimensions)
  const allowedSizes = [
    { length: 78, width: 72 },
    { length: 78, width: 66 },
    { length: 78, width: 60 },
    { length: 78, width: 42 },
    { length: 78, width: 36 },
    { length: 78, width: 78 },
    { length: 76, width: 78 },
    { length: 86, width: 78 },
  ];
  await db.collection('sizes').deleteMany({
    $nor: allowedSizes.map((s) => ({ length: s.length, width: s.width })),
  });

  // 4. Delete non-standard thicknesses (keep only 4, 5, 6, 8, 10 inches)
  const allowedThicks = [4, 5, 6, 8, 10];
  await db.collection('thicknesses').deleteMany({
    value: { $nin: allowedThicks },
  });

  // 5. Seed standard Brands
  const standardBrands = [
    { name: 'Master', code: 'MASTER', status: 'ACTIVE', description: 'Master Mattress & Bedding' },
    { name: 'MoltyFoam', code: 'MOLTY', status: 'ACTIVE', description: 'Original Molty Foam Pakistan' },
    { name: 'Dura Foam', code: 'DURA', status: 'ACTIVE', description: 'Dura Foam Pakistan' },
  ];

  for (const b of standardBrands) {
    await db.collection('brands').updateOne(
      { code: b.code },
      { $set: { ...b, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }

  const masterBrand = await db.collection('brands').findOne({ code: 'MASTER' });
  const moltyBrand = await db.collection('brands').findOne({ code: 'MOLTY' });

  // 6. Seed standard Categories
  if (masterBrand && moltyBrand) {
    const standardCats = [
      { brandId: masterBrand._id, name: 'Medical Care', code: 'MED', status: 'ACTIVE', description: 'Medical Care Mattresses' },
      { brandId: masterBrand._id, name: 'Orthopedic', code: 'ORTHO', status: 'ACTIVE', description: 'Orthopedic Spine Support' },
      { brandId: masterBrand._id, name: 'Spring Luxury', code: 'LUX', status: 'ACTIVE', description: 'Pocket Spring & Luxury' },
      { brandId: moltyBrand._id, name: 'Original Foam', code: 'ORIG', status: 'ACTIVE', description: 'Original High Density Foam' },
      { brandId: moltyBrand._id, name: 'Ultra Luxury', code: 'ULTRA', status: 'ACTIVE', description: 'Ultra Luxury Bedding' },
      { brandId: moltyBrand._id, name: 'Gold', code: 'GOLD', status: 'ACTIVE', description: 'Gold Series Bedding' },
    ];

    for (const c of standardCats) {
      await db.collection('categories').updateOne(
        { brandId: c.brandId, name: c.name },
        { $set: { ...c, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
    }
  }

  // 7. Seed standard Sizes
  const standardSizes = [
    { length: 78, width: 72, unit: 'in', displayLabel: '78 × 72 (King)', status: 'ACTIVE' },
    { length: 78, width: 66, unit: 'in', displayLabel: '78 × 66 (Queen)', status: 'ACTIVE' },
    { length: 78, width: 60, unit: 'in', displayLabel: '78 × 60 (Double)', status: 'ACTIVE' },
    { length: 78, width: 42, unit: 'in', displayLabel: '78 × 42 (Single)', status: 'ACTIVE' },
    { length: 78, width: 36, unit: 'in', displayLabel: '78 × 36 (Single Small)', status: 'ACTIVE' },
    { length: 78, width: 78, unit: 'in', displayLabel: '78 × 78', status: 'ACTIVE' },
    { length: 76, width: 78, unit: 'in', displayLabel: '76 × 78', status: 'ACTIVE' },
    { length: 86, width: 78, unit: 'in', displayLabel: '86 × 78', status: 'ACTIVE' },
  ];

  for (const s of standardSizes) {
    await db.collection('sizes').updateOne(
      { length: s.length, width: s.width, unit: s.unit },
      { $set: { ...s, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }

  // 8. Seed standard Thicknesses
  const standardThicks = [
    { value: 4, unit: 'in', displayLabel: '4 Inches', status: 'ACTIVE' },
    { value: 5, unit: 'in', displayLabel: '5 Inches', status: 'ACTIVE' },
    { value: 6, unit: 'in', displayLabel: '6 Inches', status: 'ACTIVE' },
    { value: 8, unit: 'in', displayLabel: '8 Inches', status: 'ACTIVE' },
    { value: 10, unit: 'in', displayLabel: '10 Inches', status: 'ACTIVE' },
  ];

  for (const t of standardThicks) {
    await db.collection('thicknesses').updateOne(
      { value: t.value, unit: t.unit },
      { $set: { ...t, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }

  const finalSizes = await db.collection('sizes').find().toArray();
  console.log('Current standard sizes count:', finalSizes.length, finalSizes.map(s => s.displayLabel));
  const finalThicks = await db.collection('thicknesses').find().toArray();
  console.log('Current standard thicknesses count:', finalThicks.length, finalThicks.map(t => t.displayLabel));

  if (isSelfConnected) {
    await disconnectDatabase();
  }
  console.log('Catalogue cleanup and standard seed completed successfully.');
}

if (process.argv[1]?.endsWith('cleanAndSeedCatalogue.ts') || process.argv[1]?.endsWith('cleanAndSeedCatalogue.js')) {
  cleanAndSeedCatalogue().catch((err) => {
    console.error('Fatal seed error:', err);
    process.exit(1);
  });
}
