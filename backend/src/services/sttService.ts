import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<{ text: string; confidence?: number }> {
  // Сохраняем временный файл
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempPath = path.join(tempDir, filename);
  fs.writeFileSync(tempPath, audioBuffer);

  try {
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      language: 'ru',
      response_format: 'json',
      timestamp_granularities: ['segment'],
    } as any);

    // Извлекаем текст из JSON ответа
    const text = typeof transcription === 'string' ? transcription : (transcription as any).text || '';
    
    return {
      text,
      confidence: 0.5, // Whisper не предоставляет confidence, но мы можем валидировать текст
    };
  } finally {
    // Удаляем временный файл
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}
