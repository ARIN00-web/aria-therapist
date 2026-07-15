import 'dotenv/config';
import { streamGeminiResponse } from './services/llm.client';

async function testStream(turn: number) {
  console.log(`\n--- Starting Turn ${turn} ---`);
  try {
    let text = '';
    const result = await streamGeminiResponse({
      system: 'You are a helpful assistant.',
      messages: [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there! How can I help you today?' },
        { role: 'user', content: 'Tell me a short joke.' }
      ],
      onText: (chunk) => {
        process.stdout.write(chunk);
        text += chunk;
      }
    });
    console.log(`\nTurn ${turn} completed successfully.`);
  } catch (err: any) {
    console.error(`\nTurn ${turn} failed:`, err.message || err);
  }
}

async function run() {
  await testStream(1);
  await new Promise(r => setTimeout(r, 2000));
  await testStream(2);
  await new Promise(r => setTimeout(r, 2000));
  await testStream(3);
}

run();
