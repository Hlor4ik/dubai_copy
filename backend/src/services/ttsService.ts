const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set');
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const bodyText = await response.text();

    // Если вернулась HTML‑страница (Cloudflare / блокировка), даём понятную ошибку
    if (contentType.includes('text/html') || bodyText.trim().startsWith('<!DOCTYPE html')) {
      const snippet = bodyText.slice(0, 1000).replace(/\s+/g, ' ');
      throw new Error(`ELEVENLABS_CLOUDFLARE_BLOCK: status=${response.status} bodySnippet="${snippet}"`);
    }

    // Иначе возвращаем текст ошибки напрямую
    throw new Error(`ElevenLabs API error: ${response.status} - ${bodyText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

