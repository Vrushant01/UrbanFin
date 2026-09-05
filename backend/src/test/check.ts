import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';

async function check() {
  await connectDB();
  const users = await User.find();
  console.log('Total users in DB:', users.length);
  for (const u of users) {
    const match = await u.comparePassword('Password@123');
    console.log(`User: ${u.loginId}, Role: ${u.role}, Password@123 match: ${match}`);
  }
  process.exit(0);
}

check();
