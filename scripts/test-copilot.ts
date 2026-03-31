import { CopilotClient, approveAll } from '@github/copilot-sdk';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('GITHUB_TOKEN set:', !!process.env.GITHUB_TOKEN);
  console.log('Token prefix:', process.env.GITHUB_TOKEN?.slice(0, 15) + '...');

  const client = new CopilotClient({
    githubToken: process.env.GITHUB_TOKEN,
    useLoggedInUser: false,
  });
  try {
    console.log('Creating session...');
    const session = await client.createSession({ model: 'gpt-4.1', onPermissionRequest: approveAll });
    console.log('Session created. Sending prompt...');
    const response = await session.sendAndWait({ prompt: 'Say only the word "hello".' });
    console.log('Response:', response?.data?.content);
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    console.error('Error name:', e?.name);
    console.error('Error message:', e?.message);
    console.error('Error code:', e?.code);
    console.error('Full error:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
  } finally {
    await client.stop();
  }
}

main();
