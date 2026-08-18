import runAgent from './src/agent/aiAgent.js';

runAgent().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
