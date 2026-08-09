import { chromium } from 'playwright';
import { ChatOllama } from '@langchain/ollama';

async function runAutonomousAgent() {
  console.log('🤖 Initializing Autonomous AI Agent...');
  
  // 1. Launch Playwright Headless Browser (Perfect for Jenkins compatibility)
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 2. Initialize free, local LLM via Ollama
  const llm = new ChatOllama({
    model: "qwen2.5-coder:7b",
    temperature: 0, // 0 ensures deterministic automation choices
  });

  // Target a demo sandbox website
  const targetUrl = 'https://the-internet.herokuapp.com/';
  console.log(`🌐 Navigating to: ${targetUrl}`);
  await page.goto(targetUrl);

  // 3. Extract the available links from the landing page for the LLM to inspect
  const links = await page.$$eval('ul li a', (elements) => 
    elements.map(el => ({ text: el.textContent, href: el.getAttribute('href') }))
  );
  
  const contextString = JSON.stringify(links);

  // 4. Prompt the LLM to autonomously choose where to navigate
  const prompt = `
    You are an autonomous QA automation agent controlling a browser.
    Here is a list of available navigation links on the current page:
    ${contextString}

    Your goal is to find the page related to "Form Authentication" or "Login".
    Return ONLY a raw JSON object with two fields:
    {
      "reasoning": "your short explanation",
      "targetHref": "the exact href value of the link to click"
    }
  `;

  console.log('🧠 Asking LLM to analyze page choices...');
  const response = await llm.invoke(prompt);
  
  // Clean up markdown block formatting the LLM might return
  const cleanJson = response.content.toString().replace(/```json|```/g, '').trim();
  const decision = JSON.parse(cleanJson);

  console.log(`💡 LLM Decision: ${decision.reasoning}`);
  console.log(`🎯 Moving to sub-page: ${decision.targetHref}`);

  // 5. Playwright acts directly on the LLM's dynamic decision
  await page.click(`a[href="${decision.targetHref}"]`);
  await page.waitForLoadState('networkidle');

  console.log(`✅ Arrived at URL: ${page.url()}`);
  
  // Save a visual confirmation screenshot for Jenkins tracking
  await page.screenshot({ path: 'screenshots/agent-success.png' });
  console.log('📸 Screenshot saved to screenshots/agent-success.png');

  await browser.close();
  console.log('🏁 Agent run completed successfully!');
}

runAutonomousAgent().catch(console.error);
