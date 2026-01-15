const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '7G0NvIkWRnU0Dqjgz13p';

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set');
  }

  // Очищаем текст от артефактов
  const cleanText = text
    .replace(/[.!?…]+([.!?…])/g, '$1')  // Remove duplicate punctuation
    .replace(/\s{2,}/g, ' ')  // Normalize spaces
    .replace(/["«»]/g, '')  // Remove quotes
    .replace(/\.{3,}/g, '.')  // Remove excessive dots
    .trim();

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: cleanText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,           // Баланс стабильности
        similarity_boost: 0.75,    // Схожесть с оригинальным голосом
        style: 0.4,                // Добавляем выразительность для естественной интонации
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const bodyText = await response.text();

    if (contentType.includes('text/html') || bodyText.trim().startsWith('<!DOCTYPE html')) {
      const snippet = bodyText.slice(0, 1000).replace(/\s+/g, ' ');
      throw new Error(`ELEVENLABS_CLOUDFLARE_BLOCK: status=${response.status} bodySnippet="${snippet}"`);
    }

    throw new Error(`ElevenLabs API error: ${response.status} - ${bodyText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

