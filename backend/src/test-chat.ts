import 'dotenv/config';
import mongoose from 'mongoose';
import { SessionModel } from './models/Session.model';
import { UserModel } from './models/User.model';
import { retrieveClinicalContext } from './services/rag.retriever';
import { buildTherapyContext } from './services/context.builder';
import { streamGeminiResponse } from './services/llm.client';

async function testFullPipeline() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aria';
  console.log('Connecting to MongoDB:', mongoUri);
  await mongoose.connect(mongoUri);

  try {
    // Get the latest active session
    const session = await SessionModel.findOne({ status: 'active' }).sort({ createdAt: -1 });
    if (!session) {
      console.log('No active session found. Please start a session in your browser first.');
      return;
    }

    console.log(`Found session: ${session._id} for user: ${session.userId}`);
    const user = await UserModel.findById(session.userId);
    if (!user) {
      console.log('User not found.');
      return;
    }

    const testMessage = 'I feel anxious and overwhelmed by everything today.';
    console.log(`Simulating message: "${testMessage}"`);

    console.log('1. Retrieving clinical context...');
    const chunks = await retrieveClinicalContext(testMessage, user.preferredModality);
    console.log(`Retrieved ${chunks.length} chunks.`);

    console.log('2. Building therapy context...');
    const context = await buildTherapyContext(String(user._id), String(session._id), chunks.map(c => c.text));
    console.log('Context built successfully. System prompt length:', context.systemPrompt.length);

    console.log('3. Calling streaming LLM...');
    let streamedContent = '';
    const result = await streamGeminiResponse({
      system: context.systemPrompt,
      messages: [...context.messages, { role: 'user', content: testMessage }],
      onText: (chunk) => {
        process.stdout.write(chunk);
        streamedContent += chunk;
      }
    });

    console.log('\nLLM Stream completed successfully. Length:', result.length);
  } catch (err: any) {
    console.error('\nPipeline execution failed with error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

testFullPipeline();
