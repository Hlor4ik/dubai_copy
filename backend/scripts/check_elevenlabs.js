// Simple diagnostic script to test ElevenLabs TTS endpoint from this machine.
// Usage: ELEVENLABS_API_KEY=yourkey node scripts/check_elevenlabs.js

const fetch = globalThis.fetch || require('node-fetch');

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const voiceId = process.env.ELEVENLABS_VOICE_ID || '7G0NvIkWRnU0Dqjgz13p';
const apiKey = process.env.ELEVENLABS_API_KEY;

if (!apiKey) {
  console.error('Set ELEVENLABS_API_KEY environment variable.');
  process.exit(2);
}

(async () => {
  try {
    console.log('Requesting ElevenLabs TTS...');
    const res = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({ text: 'Test', model_id: 'eleven_multilingual_v2' }),
    });

    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));

    const text = await res.text();
    console.log('Body (first 2000 chars):');
    console.log(text.slice(0, 2000));

    if (!res.ok) process.exit(3);
    process.exit(0);
  } catch (err) {
    console.error('Request failed:', err);
    process.exit(1);
  }
})();
