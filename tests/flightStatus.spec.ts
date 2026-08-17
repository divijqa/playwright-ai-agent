import { runAgent } from '../src/agent/aiAgent.js';

(async () => {
  console.log('Running quick integration test for agent...');
  try {
    await runAgent();
    console.log('Agent test finished successfully.');
  } catch (e) {
    console.error('Agent test failed:', e);
    process.exit(1);
  }
})();
