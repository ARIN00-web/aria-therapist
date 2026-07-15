import 'dotenv/config';
import mongoose from 'mongoose';
import { SessionModel } from './models/Session.model';
import { UserModel } from './models/User.model';
import { createAccessToken } from './utils/tokens';

async function testApiPipeline() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aria';
  console.log('Connecting to MongoDB:', mongoUri);
  await mongoose.connect(mongoUri);

  try {
    const session = await SessionModel.findOne({ status: 'active' }).sort({ createdAt: -1 });
    if (!session) {
      console.log('No active session found.');
      return;
    }

    const user = await UserModel.findById(session.userId);
    if (!user) {
      console.log('User not found.');
      return;
    }

    // Generate a valid JWT token
    const token = createAccessToken(String(user._id), user.tokenVersion || 0);
    const sessionId = String(session._id);
    console.log(`Testing API endpoints for Session ${sessionId} with Token...`);

    const runMessageTest = async (messageText: string, index: number) => {
      console.log(`\n--- Sending API Message ${index}: "${messageText}" ---`);
      
      const response = await fetch(`http://localhost:5001/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: messageText })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API response error (status ${response.status}): ${errorText}`);
        return false;
      }

      console.log('Reading stream response...');
      const reader = response.body?.getReader();
      if (!reader) {
        console.error('Response body is not readable');
        return false;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          const eventName = event.match(/^event: (.+)$/m)?.[1];
          const data = event.match(/^data: (.+)$/m)?.[1];
          if (data && eventName === 'token') {
            const parsed = JSON.parse(data);
            process.stdout.write(parsed.content || '');
          }
        }
      }
      console.log(`\nMessage ${index} Stream complete!`);
      return true;
    };

    const success1 = await runMessageTest('Hello Aria, how are you today?', 1);
    if (!success1) return;
    
    console.log('Waiting 2 seconds...');
    await new Promise(r => setTimeout(r, 2000));
    
    const success2 = await runMessageTest('I had a fight with my friend and I feel terrible.', 2);
    if (!success2) return;

    console.log('Waiting 2 seconds...');
    await new Promise(r => setTimeout(r, 2000));

    const success3 = await runMessageTest('What can I do to feel calmer?', 3);
    if (!success3) return;

  } catch (err) {
    console.error('API Test failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

testApiPipeline();
