export function requireKey() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.log('\nSet your OpenRouter API key first:');
    console.log('  export OPENROUTER_API_KEY="your-key-here"');
    console.log('\nGet one at https://openrouter.ai/keys\n');
    process.exit(1);
  }
  return key;
}

export async function checkKey(key) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!res.ok) {
      console.error(`\nAPI key check failed (${res.status}). Make sure your OPENROUTER_API_KEY is valid.`);
      console.log('Get one at https://openrouter.ai/keys\n');
      process.exit(1);
    }
  } catch (e) {
    console.error('\nCould not connect to OpenRouter. Check your internet connection.\n');
    process.exit(1);
  }
}

export async function callLLM(apiKey, systemPrompt, userMessage) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`OpenRouter API error (${res.status}): ${err}`);
    process.exit(1);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.error('No content returned from API.');
    process.exit(1);
  }

  return content;
}
