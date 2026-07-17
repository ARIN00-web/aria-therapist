import 'dotenv/config';
import process from 'process';
import mongoose from 'mongoose';
import connectDB from '../database/connection.database';

async function run() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    console.error("No database connection");
    process.exit(1);
    return;
  }

  // 1. Fix users collection
  const usersCollection = db.collection('users');
  const users = await usersCollection.find({}).toArray();
  console.log(`Found ${users.length} users in database.`);

  for (const user of users) {
    if (typeof user._id === 'string') {
      console.log(`Fixing user with string _id: ${user._id}`);
      try {
        const newId = new mongoose.Types.ObjectId(user._id);
        
        // Delete old document
        await usersCollection.deleteOne({ _id: user._id });
        
        // Insert new document with ObjectId
        const newUser = { ...user, _id: newId };
        await usersCollection.insertOne(newUser);
        console.log(`Successfully converted user ${user.email} to ObjectId: ${newId}`);
      } catch (err) {
        console.error(`Failed to convert user ${user.email}:`, err);
      }
    }
  }

  // 2. Fix user sessions collection
  const sessionsCollection = db.collection('user_sessions');
  const sessions = await sessionsCollection.find({}).toArray();
  console.log(`Found ${sessions.length} sessions in database.`);
  for (const session of sessions) {
    let modified = false;
    const queryId = session._id;
    const newSession = { ...session };

    if (typeof session._id === 'string') {
      newSession._id = new mongoose.Types.ObjectId(session._id);
      modified = true;
    }
    if (typeof session.userId === 'string') {
      newSession.userId = new mongoose.Types.ObjectId(session.userId);
      modified = true;
    }

    if (modified) {
      console.log(`Fixing session with string ID: ${session._id}`);
      await sessionsCollection.deleteOne({ _id: queryId });
      await sessionsCollection.insertOne(newSession);
    }
  }

  // 3. Fix accounts collection
  const accountsCollection = db.collection('accounts');
  const accounts = await accountsCollection.find({}).toArray();
  console.log(`Found ${accounts.length} accounts in database.`);
  for (const account of accounts) {
    let modified = false;
    const queryId = account._id;
    const newAccount = { ...account };

    if (typeof account._id === 'string') {
      newAccount._id = new mongoose.Types.ObjectId(account._id);
      modified = true;
    }
    if (typeof account.userId === 'string') {
      newAccount.userId = new mongoose.Types.ObjectId(account.userId);
      modified = true;
    }

    if (modified) {
      console.log(`Fixing account with string ID: ${account._id}`);
      await accountsCollection.deleteOne({ _id: queryId });
      await accountsCollection.insertOne(newAccount);
    }
  }

  console.log("Done database fix!");
  await mongoose.disconnect();
}

run().catch(console.error);
