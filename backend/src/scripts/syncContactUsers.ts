import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Contact } from '../models/Contact.js';
import { User } from '../models/User.js';
import { Role, ContactType } from '../types/index.js';

dotenv.config();

export async function syncContactUsers(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://rrempire29_db_user:Rudra8081@cluster0.pffmaj2.mongodb.net/urbanfin?retryWrites=true&w=majority';
  
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  console.log('[Sync] Connected to MongoDB database');

  // Bulk enable portal access for all contacts
  await Contact.updateMany({}, { $set: { hasPortalAccess: true } });
  console.log('[Sync] Enabled portal access for all contacts');

  const contacts = await Contact.find();
  console.log(`[Sync] Found ${contacts.length} total contacts`);

  const existingUsers = await User.find();
  const existingEmailMap = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]));
  const existingLoginIdSet = new Set(existingUsers.map((u) => u.loginId.toLowerCase()));
  const existingContactIdMap = new Map(
    existingUsers.filter((u) => u.contactId).map((u) => [u.contactId!.toString(), u])
  );

  console.log(`[Sync] Found ${existingUsers.length} existing user accounts`);

  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);
  const newUsersToInsert: any[] = [];
  const now = new Date();

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const contactIdStr = c._id.toString();

    if (existingContactIdMap.has(contactIdStr) || existingEmailMap.has(c.email.toLowerCase())) {
      const existingUser = existingContactIdMap.get(contactIdStr) || existingEmailMap.get(c.email.toLowerCase());
      if (existingUser && !existingUser.contactId) {
        existingUser.contactId = contactIdStr;
        await existingUser.save();
      }
      continue;
    }

    const email = (c.email || '').toLowerCase().trim();
    let loginId = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    if (!loginId || loginId.length < 3) {
      loginId = (c.type === ContactType.Vendor ? 'vend_' : 'cust_') + (i + 1);
    }
    if (loginId.length > 25) {
      loginId = loginId.slice(0, 25);
    }
    if (existingLoginIdSet.has(loginId)) {
      loginId = `${loginId.slice(0, 20)}_${i + 1}`;
    }
    existingLoginIdSet.add(loginId);

    const isVendor = c.type === ContactType.Vendor;
    const role = isVendor ? Role.Vendor : Role.User;

    newUsersToInsert.push({
      name: c.name,
      loginId,
      email,
      passwordHash: defaultPasswordHash,
      role,
      contactId: contactIdStr,
      isSuspended: false,
      isMasterAdmin: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (newUsersToInsert.length > 0) {
    const result = await User.insertMany(newUsersToInsert);
    console.log(`[Sync] Successfully created ${result.length} linked portal user accounts.`);
  } else {
    console.log('[Sync] All contacts already have linked portal user accounts.');
  }
}

if (process.argv[1]?.includes('syncContactUsers')) {
  syncContactUsers()
    .then(() => {
      console.log('[Sync] Completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Sync] Error:', err);
      process.exit(1);
    });
}
