import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

import { DialogueContext } from './types/index.js';
import { transcribeAudio } from './services/sttService.js';
import { synthesizeSpeech } from './services/ttsService.js';
import { processDialogue, createInitialGreeting, streamProcessDialogue } from './services/dialogueService.js';
import { localizeForVoice } from './services/apartmentService.js';
import { getApartmentById, searchApartments, formatApartmentForVoice } from './services/apartmentService.js';
import {
  startSession,
  updateSession,
  endSession,
  markLandingGenerated,
  getAllSessions,
} from './services/analyticsService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://dubai-copy-2.onrender.com'],
  credentials: true
}));
app.use(express.json());

// Раздача временных файлов (PDF)
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/temp', express.static(path.join(__dirname, '../temp')));

// Multer для загрузки аудио
const upload = multer({ storage: multer.memoryStorage() });

// In-memory хранилище сессий
const dialogueContexts: Map<string, DialogueContext> = new Map();

// === API Routes ===

// Начать новую сессию
app.post('/api/session/start', async (_req, res) => {
  try {
    const sessionId = uuidv4();
    const greeting = createInitialGreeting();

    const context: DialogueContext = {
      sessionId,
      params: {},
      shownApartments: [],
      messageHistory: [{ role: 'assistant', content: greeting }],
      startTime: Date.now(),
    };

    dialogueContexts.set(sessionId, context);
    startSession(sessionId);

    // Генерируем аудио приветствия
    const audioBuffer = await synthesizeSpeech(localizeForVoice(greeting));

    res.json({
      sessionId,
      greeting,
      audio: audioBuffer.toString('base64'),
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// Обработать голосовое сообщение
app.post('/api/chat/voice', upload.single('audio'), async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    const context = dialogueContexts.get(sessionId);

    if (!context) {
      return res.status(400).json({ error: 'Session not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // 1. STT - распознаем речь
    const userText = await transcribeAudio(req.file.buffer, `${sessionId}.webm`);
    console.log(`[STT] User said: ${userText}`);

    // 2. Добавляем сообщение в историю
    context.messageHistory.push({ role: 'user', content: userText });

    // 3. Обрабатываем диалог
    const result = await processDialogue(userText, context);
    console.log(`[LLM] Response: ${result.response.substring(0, 100)}...`);
    console.log(`[LLM] Action: ${result.action}`);
    console.log(`[LLM] Apartment: ${result.apartment?.id || 'none'}`);

    // 4. Обновляем контекст
    Object.entries(result.paramsUpdate).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        (context.params as Record<string, unknown>)[key] = value;
      }
    });

    // Добавляем квартиру в показанные (только для search/next)
    if (result.apartment && (result.action === 'search' || result.action === 'next')) {
      if (!context.shownApartments.includes(result.apartment.id)) {
        context.shownApartments.push(result.apartment.id);
      }
    }

    context.messageHistory.push({ role: 'assistant', content: result.response });
    updateSession(context);

    // 5. Генерируем лендинг если клиент подтвердил интерес
    let landingUrl: string | undefined;
    if (result.action === 'confirm_interest') {
      // Берём квартиру из результата или последнюю показанную
      const apartmentForLanding = result.apartment || 
        (context.shownApartments.length > 0 
          ? getApartmentById(context.shownApartments[context.shownApartments.length - 1])
          : undefined);
      
      if (apartmentForLanding) {
        const landingId = apartmentForLanding.id; // Use apartment ID directly
        context.selectedApartment = apartmentForLanding.id;
        markLandingGenerated(sessionId, apartmentForLanding.id);
        landingUrl = `/apartment/${landingId}`;
        console.log(`[LANDING] Generated: ${landingUrl} for apartment ${apartmentForLanding.id}`);
      } else {
        console.log(`[LANDING] No apartment to generate landing for`);
      }
    }

    // 6. TTS - синтезируем ответ
    const audioBuffer = await synthesizeSpeech(localizeForVoice(result.response));

    res.json({
      userText,
      response: result.response,
      audio: audioBuffer.toString('base64'),
      action: result.action,
      apartment: result.apartment,
      landingUrl,
      params: context.params,
    });
  } catch (error) {
    console.error('Error processing voice:', error);
    res.status(500).json({ error: 'Failed to process voice message' });
  }
});

// Streaming endpoint: returns Server-Sent Events (SSE) with audio chunks (base64) as they are synthesized.
app.post('/api/chat/voice-stream', upload.single('audio'), async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    const context = dialogueContexts.get(sessionId);

    if (!context) {
      return res.status(400).json({ error: 'Session not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // 1. STT
    const userText = await transcribeAudio(req.file.buffer, `${sessionId}.webm`);
    console.log(`[STT STREAM] User said: ${userText}`);

    context.messageHistory.push({ role: 'user', content: userText });

    // Setup SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();

    // send helper
    const sendEvent = (event: string, data: string) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${data}\n\n`);
    };

    // ACK messages removed for faster response time

    // Buffer tokens and synthesize on short phrase boundaries (~15 chars or punctuation)
    // to trigger TTS faster and start playback sooner
    let tokenBuffer = '';
    const MAX_BUFFER_LEN = 15; // characters per synthesis — aggressive for low latency
    const phraseRegex = /([.!?,])\s+/; // phrase boundary

    // Helper to synthesize and emit a phrase
    const synthesizeAndEmit = async (text: string) => {
      if (!text.trim()) return;
      try {
        // Clean text from artifacts: remove multiple punctuation, extra spaces, quotes
        let cleanText = text
          .trim()
          .replace(/[.!?…]+([.!?…])/g, '$1')  // Remove duplicate punctuation
          .replace(/\s{2,}/g, ' ')  // Normalize multiple spaces
          .replace(/["«»]/g, '')  // Remove quotes
          .replace(/\.{2,}/g, '.')  // Remove multiple dots
          .trim();
        
        // Localize English terms for natural pronunciation
        cleanText = localizeForVoice(cleanText);
        
        const audioBuf = await synthesizeSpeech(cleanText);
        const b64 = audioBuf.toString('base64');
        sendEvent('audio', b64);
        console.log(`[STREAM TTS] Synthesized: "${cleanText.substring(0, 50)}..."`);
      } catch (e) {
        console.error('[STREAM TTS] synth failed', e);
        sendEvent('error', JSON.stringify({ message: 'tts_error' }));
      }
    };

    // Collect full LLM response first (no streaming to TTS yet)
    let llmBuffer = '';
    const onToken = async (token: string) => {
      llmBuffer += token;
    };

    // Local fast-path for common confirm_interest phrases (skip LLM if detected)
    const lowerText = userText.toLowerCase().trim();
    const lastShownId = context.shownApartments[context.shownApartments.length - 1];
    
    // Check for "start search now" when user has at least one parameter
    const hasParams = Object.keys(context.params).length > 0;
    console.log(`[STREAM] Local detector check: hasParams=${hasParams}, lastShownId=${lastShownId}, lowerText="${lowerText}"`);
    
    if (hasParams && !lastShownId && /^(нет|всё|начинай|начни|ищи|покажи|давай|поехали|го|поиск|варианты|показать)[,.\s!]?/i.test(lowerText)) {
      console.log('[STREAM] Local search trigger detected:', userText);
      const availableApartments = searchApartments(context.params, context.shownApartments);
      if (availableApartments.length > 0) {
        const apartment = availableApartments[0];
        if (!context.shownApartments.includes(apartment.id)) {
          context.shownApartments.push(apartment.id);
        }
        const textToSpeak = `Вот вариант: ${formatApartmentForVoice(apartment)} Нравится?`;
        await synthesizeAndEmit(textToSpeak);
        
        context.messageHistory.push({ role: 'assistant', content: textToSpeak });
        updateSession(context);
        
        sendEvent('done', JSON.stringify({
          response: textToSpeak,
          action: 'search',
          apartment,
          params: context.params,
        }));
        
        return res.end();
      } else {
        const textToSpeak = 'По этим параметрам нет вариантов. Уточните запрос.';
        await synthesizeAndEmit(textToSpeak);
        
        context.messageHistory.push({ role: 'assistant', content: textToSpeak });
        updateSession(context);
        
        sendEvent('done', JSON.stringify({
          response: textToSpeak,
          action: 'none',
          params: context.params,
        }));
        
        return res.end();
      }
    }
    
    // Check for "да", "да покажи", "хочу эту", etc. when apartment was just shown
    if (lastShownId && (/^да(\s|$)|^(ну )?да[,!\.]?\s*(покажи|покаж|эту|её)?$|^покажи\s+(мне|её|эту)|^хочу\s+эту|^беру|^подходит|^нравится|^отлично|^хорошо$/i.test(lowerText))) {
      console.log('[STREAM] Local confirm_interest detected:', userText);
      const apartment = getApartmentById(lastShownId);
      if (apartment) {
        const textToSpeak = 'Отлично! Я создаю для вас персональную страницу с подробной информацией. Ссылка появится на экране.';
        await synthesizeAndEmit(textToSpeak);
        
        const landingId = apartment.id; // Use apartment ID directly
        context.selectedApartment = apartment.id;
        markLandingGenerated(sessionId, apartment.id);
        const landingUrl = `/apartment/${landingId}`;
        
        context.messageHistory.push({ role: 'assistant', content: textToSpeak });
        updateSession(context);
        
        sendEvent('done', JSON.stringify({
          response: textToSpeak,
          action: 'confirm_interest',
          apartment,
          landingUrl,
          params: context.params,
        }));
        
        return res.end();
      }
    }

    // Start streaming LLM -> buffer
    const { finalResponse, error } = await streamProcessDialogue(userText, context, onToken);

    // If stream failed, fall back to processDialogue
    if (error) {
      console.log('[STREAM] Falling back to non-streaming response');
      const result = await processDialogue(userText, context);
      
      Object.entries(result.paramsUpdate).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          (context.params as Record<string, unknown>)[key] = value;
        }
      });
      
      if (result.apartment && (result.action === 'search' || result.action === 'next')) {
        if (!context.shownApartments.includes(result.apartment.id)) {
          context.shownApartments.push(result.apartment.id);
        }
      }
      
      context.messageHistory.push({ role: 'assistant', content: result.response });
      updateSession(context);
      
      let landingUrl: string | undefined;
      if (result.action === 'confirm_interest' && result.apartment) {
        const landingId = result.apartment.id; // Use apartment ID directly
        context.selectedApartment = result.apartment.id;
        markLandingGenerated(sessionId, result.apartment.id);
        landingUrl = `/apartment/${landingId}`;
      }
      
      const audioBuf = await synthesizeSpeech(result.response);
      sendEvent('audio', audioBuf.toString('base64'));
      sendEvent('done', JSON.stringify({ 
        response: result.response, 
        action: result.action,
        apartment: result.apartment,
        landingUrl,
        params: context.params,
      }));
      return res.end();
    }

    // Parse finalResponse JSON and apply dialogue logic
    console.log(`[STREAM] Raw finalResponse: "${finalResponse?.substring(0, 200) || ''}..."`);
    let parsed: any = undefined;
    try {
      parsed = JSON.parse(finalResponse || '');
    } catch {
      console.log(`[STREAM] Failed to parse JSON directly, trying regex match...`);
      const jsonMatch = (finalResponse || '').match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(`[STREAM] Found JSON match: "${jsonMatch[0].substring(0, 150)}..."`);
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          console.log(`[STREAM] Failed to parse JSON match`);
          parsed = undefined;
        }
      }
    }
    console.log(`[STREAM] Parsed result:`, parsed);

    let textToSpeak = '';
    let action = 'none';
    let apartment: any = undefined;
    let landingUrl: string | undefined;

    if (parsed) {
      action = parsed.action || 'none';
      const paramsUpdate = parsed.params_update || {};

      console.log(`[STREAM] Parsed action: ${action}`);
      console.log(`[STREAM] Params update from LLM:`, JSON.stringify(paramsUpdate));
      console.log(`[STREAM] Context params before update:`, JSON.stringify(context.params));

      // Apply params update
      Object.entries(paramsUpdate).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          (context.params as Record<string, unknown>)[key] = value;
        }
      });

      console.log(`[STREAM] Context params after update:`, JSON.stringify(context.params));

      // Handle actions
      if (action === 'confirm_interest') {
        console.log(`[STREAM] CONFIRM_INTEREST detected`);
        console.log(`[STREAM] Shown apartments:`, context.shownApartments);
        const lastShownApartmentId = context.shownApartments[context.shownApartments.length - 1];
        console.log(`[STREAM] Last shown apartment ID:`, lastShownApartmentId);
        if (lastShownApartmentId) {
          apartment = getApartmentById(lastShownApartmentId);
          console.log(`[STREAM] Got apartment by ID:`, apartment?.id, apartment?.district);
        } else {
          const results = searchApartments(context.params, context.shownApartments);
          if (results.length > 0) {
            apartment = results[0];
          } else {
            action = 'none';
            textToSpeak = 'Я пока не нашёл подходящую квартиру. Уточните параметры.';
          }
        }

        if (apartment && !textToSpeak) {
          console.log(`[STREAM] Generating landing for apartment:`, apartment.id);
          textToSpeak = 'Отлично! Я создаю для вас персональную страницу с подробной информацией. Ссылка появится на экране.';
          const landingId = apartment.id; // Use apartment ID directly
          console.log(`[STREAM] Landing ID (apartment.id):`, landingId);
          console.log(`[STREAM] Landing stored, landingUrl:`, `/apartment/${landingId}`);
          context.selectedApartment = apartment.id;
          markLandingGenerated(sessionId, apartment.id);
          landingUrl = `/apartment/${landingId}`;
          console.log(`[STREAM] Landing URL ready for SSE:`, landingUrl);
        } else {
          console.log(`[STREAM] confirm_interest but apartment is null or textToSpeak already set`);
        }
      } else if (action === 'search' || action === 'next') {
        console.log(`[STREAM] Searching with params:`, JSON.stringify(context.params));
        console.log(`[STREAM] Already shown apartments:`, context.shownApartments);
        const results = searchApartments(context.params, context.shownApartments);
        console.log(`[STREAM] Search returned ${results.length} apartments`);
        if (results.length > 0) {
          apartment = results[0];
          console.log(`[STREAM] Selected apartment:`, apartment.id, apartment.district);
          if (!context.shownApartments.includes(apartment.id)) {
            context.shownApartments.push(apartment.id);
          }
          textToSpeak = `Вот вариант: ${formatApartmentForVoice(apartment)} Нравится?`;
        } else {
          action = 'none';
          textToSpeak = 'По этим параметрам нет вариантов. Что изменим?';
        }
      } else {
        textToSpeak = parsed.response || '';
      }
    } else {
      textToSpeak = finalResponse || 'Извините, ошибка.';
    }

    // Now stream the processed text to TTS in phrases
    console.log(`[STREAM] Final text to speak: "${textToSpeak.substring(0, 100)}..."`);
    let ttsBuffer = textToSpeak;
    
    while (ttsBuffer.length > 0) {
      const phraseMatch = ttsBuffer.match(phraseRegex);
      if (phraseMatch) {
        const endIdx = ttsBuffer.indexOf(phraseMatch[0]) + phraseMatch[0].length;
        const phrase = ttsBuffer.substring(0, endIdx);
        ttsBuffer = ttsBuffer.substring(endIdx);
        await synthesizeAndEmit(phrase);
      } else if (ttsBuffer.length >= MAX_BUFFER_LEN) {
        const lastSpace = ttsBuffer.lastIndexOf(' ', MAX_BUFFER_LEN);
        const cutPoint = lastSpace > MAX_BUFFER_LEN / 2 ? lastSpace : MAX_BUFFER_LEN;
        const phrase = ttsBuffer.substring(0, cutPoint);
        ttsBuffer = ttsBuffer.substring(cutPoint).trim();
        await synthesizeAndEmit(phrase);
      } else {
        await synthesizeAndEmit(ttsBuffer);
        break;
      }
    }

    // Update context
    context.messageHistory.push({ role: 'assistant', content: textToSpeak });
    updateSession(context);

    // Send done
    sendEvent('done', JSON.stringify({
      response: textToSpeak,
      action,
      apartment,
      landingUrl,
      params: context.params,
    }));

    return res.end();
  } catch (error) {
    console.error('Error processing voice stream:', error);
    res.status(500).json({ error: 'Failed to process voice stream' });
  }
});

// Получить данные квартиры для лендинга
app.get('/api/apartment/:landingId', (req, res) => {
  // landingId теперь это и есть apartmentId
  const apartmentId = req.params.landingId;
  const apartment = getApartmentById(apartmentId);
  
  if (!apartment) {
    return res.status(404).json({ error: 'Apartment not found' });
  }

  res.json(apartment);
});

// Отправить презентацию в WhatsApp
app.post('/api/send-presentation', async (req, res) => {
  try {
    const { apartmentId, phoneNumber } = req.body;

    if (!apartmentId || !phoneNumber) {
      return res.status(400).json({ error: 'apartmentId and phoneNumber are required' });
    }

    console.log(`[Presentation] Request for apartment ${apartmentId} to ${phoneNumber}`);

    const apartment = getApartmentById(apartmentId);
    if (!apartment) {
      return res.status(404).json({ error: 'Apartment not found' });
    }

    // Генерируем простой PDF (без рендера лендинга для скорости)
    const { generateSimplePDF } = await import('./services/pdfService.js');
    const pdfBuffer = await generateSimplePDF(apartment);

    // Сохраняем временно PDF
    const fs = await import('fs/promises');
    const path = await import('path');
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const pdfFileName = `presentation_${apartmentId}_${Date.now()}.pdf`;
    const pdfPath = path.join(tempDir, pdfFileName);
    await fs.writeFile(pdfPath, pdfBuffer);

    // Создаем публичный URL для PDF (нужен для Green API)
    const pdfUrl = `${process.env.BACKEND_URL || `http://localhost:${PORT}`}/temp/${pdfFileName}`;

    // Отправляем в WhatsApp
    const { sendWhatsAppFile } = await import('./services/whatsappService.js');
    const result = await sendWhatsAppFile(
      phoneNumber,
      pdfUrl,
      `🏠 Презентация: ${apartment.name}\n${apartment.district}, ${new Intl.NumberFormat('ru-RU').format(apartment.price)} AED`
    );

    // Удаляем файл через 5 минут
    setTimeout(async () => {
      try {
        await fs.unlink(pdfPath);
        console.log(`[Presentation] Deleted temp file: ${pdfFileName}`);
      } catch (err) {
        console.error('[Presentation] Error deleting temp file:', err);
      }
    }, 5 * 60 * 1000);

    if (result.success) {
      res.json({ success: true, message: 'Презентация отправлена в WhatsApp' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    console.error('[Presentation] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Завершить сессию
app.post('/api/session/end', (req, res) => {
  const { sessionId } = req.body;
  const analytics = endSession(sessionId);
  dialogueContexts.delete(sessionId);
  
  res.json({ success: true, analytics });
});

// Получить аналитику (для админа)
app.get('/api/analytics', (_req, res) => {
  res.json(getAllSessions());
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Analytics available at http://localhost:${PORT}/api/analytics`);
});
