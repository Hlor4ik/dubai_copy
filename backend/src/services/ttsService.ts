const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Синтезирует одну фразу
async function synthesizePhrase(text: string, apiKey: string, voiceId: string): Promise<Buffer> {
  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: text.trim(),
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.4,           // Чуть ниже для вариативности
        similarity_boost: 0.8,    // Выше для более естественного звучания
        style: 0.5,               // Добавляет выразительность
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

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '7G0NvIkWRnU0Dqjgz13p';

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set');
  }

  // Разбиваем текст на фразы по пунктуации для более естественного звучания
  // Группируем по предложениям/фразам
  const phrases = text
    .split(/([.!?…]+)/)  // Сохраняем пунктуацию
    .reduce((acc: string[], part: string, idx: number, arr: string[]) => {
      if (idx % 2 === 0 && part.trim()) {
        // Текст + пунктуация
        const nextPunct = arr[idx + 1] || '';
        acc.push(part.trim() + nextPunct);
      }
      return acc;
    }, [])
    .filter(p => p.trim().length > 0);

  // Если только одна фраза - синтезируем её напрямую
  if (phrases.length <= 1) {
    return synthesizePhrase(text, apiKey, voiceId);
  }

  // Синтезируем каждую фразу отдельно и объединяем
  console.log(`[TTS] Synthesizing ${phrases.length} phrases for natural speech`);
  
  const audioBuffers: Buffer[] = [];
  for (const phrase of phrases) {
    const phraseBuffer = await synthesizePhrase(phrase, apiKey, voiceId);
    audioBuffers.push(phraseBuffer);
  }

  // Объединяем все аудио буферы в один
  return Buffer.concat(audioBuffers);
}

