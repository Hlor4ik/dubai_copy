import OpenAI from 'openai';
import { DialogueContext, SearchParams, Apartment } from '../types/index.js';
import { searchApartments, formatApartmentForVoice, formatApartmentShort } from './apartmentService.js';

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

const SYSTEM_PROMPT = `⚠️ CRITICAL: You MUST respond with ONLY valid JSON. NO text before or after JSON. NO explanations. NO markdown. ONLY JSON object.

JSON FORMAT (always 3 keys exactly):
{
  "response": "1-2 sentence reply in Russian for the user (conversational, natural)",
  "params_update": {"district": value or null, "price_min": value or null, "price_max": value or null, "area_min": value or null, "area_max": value or null, "floor_min": value or null, "floor_max": value or null},
  "action": "none" | "search" | "next" | "confirm_interest" | "end"
}

EXAMPLE RESPONSE (copy this format exactly):
{"response": "Отлично! Бюджет до 2 миллионов. Хотите указать район или сразу покажу варианты?", "params_update": {"price_max": 2000000}, "action": "none"}

DIALOGUE EXAMPLES:
1. User: "Хочу квартиру до 2 миллионов"
   {"response": "Отлично! Бюджет до 2 миллионов. Хотите указать район или начинаем поиск?", "params_update": {"price_max": 2000000}, "action": "none"}

2. User: "Нет, начинай" (after previous response)
   {"response": "Начинаю поиск квартир до 2 миллионов.", "params_update": {}, "action": "search"}

3. User: "В Dubai Marina до 3 млн"
   {"response": "Понял, Dubai Marina до 3 миллионов. Ищу варианты.", "params_update": {"district": "Dubai Marina", "price_max": 3000000}, "action": "search"}

⚠️ REMEMBER: Response must be VALID JSON ONLY. No other text allowed!

---

You are a voice AI real estate consultant in Dubai. Help clients find apartments.

KEY RULES:
1. Listen carefully to what client says
2. Extract ALL mentioned parameters: district, price, area, floor
3. If parameter was already set and client doesn't change it — DON'T change it
4. Ask max 1 question per turn
5. Keep replies very short: 1-2 sentences max
6. Act like professional realtor

DISTRICTS: Dubai Marina, Downtown Dubai, Palm Jumeirah, JBR, Business Bay, Dubai Hills, Creek Harbour, JVC, DIFC

PARAMETERS:
- district: Extract from "near sea" → JBR, "center" → Downtown, "luxury" → Palm Jumeirah, "quiet" → Dubai Hills, etc.
- price_min, price_max: Budget in AED. Examples: "up to 2 million" → price_max: 2000000, "1 to 3 million" → price_min: 1000000, price_max: 3000000
- area_min, area_max: Size in sq meters. Examples: "studio" → 30, "1 bedroom" → 50, "2 bedrooms" → 80, "large" → 150
- floor_min, floor_max: Floor level. Examples: "higher" → floor_min: 15, "middle floors" → floor_min: 5, floor_max: 20

EXTRACTION RULES:
✓ If client didn't mention a parameter → leave it null
✓ If parameter was already set and client mentions it → update it
✓ If client says "from X to Y" → set both _min and _max
✓ If only "from X" → set _min only, _max = null
✓ If only "up to X" → set _max only, _min = null

ACTIONS:
- "none": Continue dialogue, optionally suggest parameters client can add (but don't require them!)
- "search": Start searching apartments. Use when:
  * Client has at least ONE parameter (price OR district OR area OR floor)
  * Client says "начни поиск", "покажи варианты", "ищи", "давай", "нет, всё" after you suggested optional params
  * Client clearly wants to see results (don't delay unnecessarily!)
- "next": Show next apartment - ONLY when client says "show another", "no, next one", "not this one"
- "confirm_interest": Client wants THIS specific apartment shown. Use when:
  * After showing apartment, client says: "yes", "да", "да покажи", "I like it", "show me", "interested", "this one"
  * Client asks for details: "tell me more", "расскажите подробнее"
  * Client ready to proceed: "take it", "беру", "хочу эту"
  **CRITICAL**: "да" or "yes" after showing apartment = confirm_interest, NOT next!
- "end": Exit (client says "goodbye", "no thanks", "that's all")

DIALOGUE STYLE:
- When client provides 1-2 params, optionally suggest ONE more (e.g. "Хотите указать район?")
- If client says "нет", "всё", "начинай", "покажи" → start search immediately (action: "search")
- Don't force them to specify everything! Search works with ANY parameters.

CRITICAL: Response MUST be ONLY the JSON object. Nothing else. No markdown, no explanation, no extra text.`;

export async function processDialogue(
  userMessage: string,
  context: DialogueContext
): Promise<{
  response: string;
  paramsUpdate: Partial<SearchParams>;
  action: string;
  apartment?: Apartment;
}> {
  // Quick local intent detection for common phrases (no LLM latency)
  const lowerMsg = userMessage.toLowerCase().trim();
  
  // Check for "what can you do" / capabilities question
  if (/(что.*умеешь|что.*можешь|что.*делаешь|как.*работаешь|как.*помочь|расскажи.*себе|кто.*ты)/i.test(lowerMsg)) {
    return {
      response: 'Я помогаю подобрать квартиру в Дубае. Скажите бюджет, район или размер — и я найду варианты. Могу показать детали и отправить презентацию.',
      paramsUpdate: {},
      action: 'none',
    };
  }

  // Check for "start search now" when user has at least one parameter
  const hasParams = Object.keys(context.params).length > 0;
  if (hasParams && /^(нет|всё|начинай|начни|ищи|покажи|давай|поехали|го|поиск|варианты|показать)[,.\s!]?/i.test(lowerMsg)) {
    const availableApartments = searchApartments(context.params, context.shownApartments);
    if (availableApartments.length > 0) {
      const apartment = availableApartments[0];
      return {
        response: `Вот вариант: ${formatApartmentForVoice(apartment)} Нравится?`,
        paramsUpdate: {},
        action: 'search',
        apartment,
      };
    } else {
      return {
        response: 'По этим параметрам нет вариантов. Уточните запрос.',
        paramsUpdate: {},
        action: 'none',
      };
    }
  }

  // Check for confirm_interest (THIS is the one they want) - must come BEFORE "next" check
  // Catches: "да", "эта нравится", "покажи мне", "покажи её", "это подходит", "расскажи", "информацию", etc.
  if (/^да(\s|$)|^(ну )?да[,!\.]?$|^хорошо|^отлично|^супер|^нравит|^подходит|(эта|это|её|нее).*нравит|подход|интерес|беру|готов|хочу.*эту|хочу.*эту|расскажи|информац|покажи.*мне|покажи.*её|покажи.*эту|покажи.*это|отправь|пришли|подробнее|благодар/i.test(lowerMsg) || /^(покажи её|покажи это|вот эта|эта да)(\s|$)/i.test(lowerMsg)) {
    const lastShownApartmentId = context.shownApartments[context.shownApartments.length - 1];
    if (lastShownApartmentId) {
      const { getApartmentById } = await import('./apartmentService.js');
      const apartment = getApartmentById(lastShownApartmentId);
      if (apartment) {
        return {
          response: 'Отлично! Я создаю для вас персональную страницу с подробной информацией об этой квартире. Ссылка появится на экране.',
          paramsUpdate: {},
          action: 'confirm_interest',
          apartment,
        };
      }
    }
  }

  // Check for "show next" - AFTER confirm_interest check
  if ((/^(покажи другую|показать другую|далее|следующую|next|ещё|еще|другую)(\s|$)|^(нет|не подходит|не нравится)(\s|$)/i.test(lowerMsg))) {
    const availableApartments = searchApartments(context.params, context.shownApartments);
    if (availableApartments.length > 0) {
      const apartment = availableApartments[0];
      return {
        response: `Вот вариант: ${formatApartmentForVoice(apartment)} Нравится?`,
        paramsUpdate: {},
        action: 'next',
        apartment,
      };
    }
  }

  // Check for exit
  if (/^(спасибо|до свидания|пока|выход|exit|bye|не надо|всё|конец|хватит)/i.test(lowerMsg)) {
    return {
      response: 'Спасибо! Удачи в поиске!',
      paramsUpdate: {},
      action: 'end',
    };
  }

  // Otherwise, use full LLM flow
  const availableApartments = searchApartments(context.params, context.shownApartments);
  
  // Получаем последнюю показанную квартиру
  const lastShownApartmentId = context.shownApartments[context.shownApartments.length - 1];
  
  let contextInfo = `\n\nКОНТЕКСТ ДИАЛОГА:`;
  contextInfo += `\nТекущие параметры: ${JSON.stringify(context.params)}`;
  contextInfo += `\nПоказано квартир: ${context.shownApartments.length}`;
  if (lastShownApartmentId) {
    contextInfo += `\nПоследняя показанная квартира ID: ${lastShownApartmentId}`;
  }
  contextInfo += `\nДоступно ещё квартир: ${availableApartments.length}`;
  
  if (availableApartments.length > 0) {
    contextInfo += `\nСледующая квартира для показа: ${formatApartmentShort(availableApartments[0])}`;
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT + contextInfo },
    ...context.messageHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const responseText = completion.choices[0]?.message?.content || '';
  
  try {
    // Парсим JSON ответ
    const parsed = JSON.parse(responseText);
    
    let apartment: Apartment | undefined;
    let finalResponse = parsed.response || '';
    
    console.log(`[LLM] Parsed action: ${parsed.action}`);
    
    // Если клиент подтвердил интерес — пытаемся найти конкретную квартиру
    if (parsed.action === 'confirm_interest') {
      if (lastShownApartmentId) {
        const { getApartmentById } = await import('./apartmentService.js');
        apartment = getApartmentById(lastShownApartmentId);
        console.log(`[LLM] Confirm interest for apartment: ${apartment?.id}`);
      } else {
        // Попытка подобрать квартиру по обновлённым параметрам (если LLM их вернул)
        const mergedParams = { ...context.params };
        if (parsed.params_update) {
          Object.entries(parsed.params_update).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              (mergedParams as Record<string, unknown>)[key] = value;
            }
          });
        }

        const results = searchApartments(mergedParams, context.shownApartments);
        if (results.length > 0) {
          apartment = results[0];
          console.log(`[LLM] Confirm interest matched apartment from search: ${apartment.id}`);
        } else {
          // Нечего подтверждать — просим уточнить вместо генерации лендинга
          parsed.action = 'none';
          finalResponse = 'Я пока не нашёл подходящую квартиру. Уточните, пожалуйста, район или другие предпочтения.';
          console.log('[LLM] Confirm interest but no apartment found — asking for clarification');
        }
      }

      // Если квартира найдена — стандартное сообщение подтверждения
      if (apartment) {
        finalResponse = 'Отлично! Я создаю для вас персональную страницу с подробной информацией об этой квартире. Ссылка появится на экране.';
      }
    }
    // Если нужно показать квартиру
    else if (parsed.action === 'search' || parsed.action === 'next') {
      const mergedParams = { ...context.params };
      if (parsed.params_update) {
        Object.entries(parsed.params_update).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            (mergedParams as Record<string, unknown>)[key] = value;
          }
        });
      }
      
      const results = searchApartments(mergedParams, context.shownApartments);
      if (results.length > 0) {
        apartment = results[0];
        // Короткое описание квартиры
        finalResponse = `Вот вариант: ${formatApartmentForVoice(apartment)} Нравится или показать другую?`;
      } else {
        finalResponse = 'По этим параметрам больше нет вариантов. Что изменим?';
        parsed.action = 'none';
      }
    }

    console.log(`[LLM] Final response for TTS: ${finalResponse.substring(0, 100)}...`);

    return {
      response: finalResponse,
      paramsUpdate: parsed.params_update || {},
      action: parsed.action || 'none',
      apartment,
    };
  } catch (e) {
    console.error('[LLM] Failed to parse JSON:', e);
    console.error('[LLM] Raw response:', responseText);
    
    // Пытаемся извлечь текст из ответа
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          response: parsed.response || 'Извините, произошла ошибка. Повторите, пожалуйста.',
          paramsUpdate: parsed.params_update || {},
          action: parsed.action || 'none',
        };
      } catch {
        // ignore
      }
    }
    
    return {
      response: 'Извините, я не расслышал. Пожалуйста, повторите ваш вопрос.',
      paramsUpdate: {},
      action: 'none',
    };
  }
}

// Stream tokens from OpenAI and call `onToken` for each token received.
// Falls back to returning the full response if streaming isn't available.
export async function streamProcessDialogue(
  userMessage: string,
  context: DialogueContext,
  onToken: (token: string) => Promise<void>
): Promise<{ finalResponse?: string; error?: string }> {
  const availableApartments = searchApartments(context.params, context.shownApartments);

  const lastShownApartmentId = context.shownApartments[context.shownApartments.length - 1];
  let contextInfo = `\n\nКОНТЕКСТ ДИАЛОГА:`;
  contextInfo += `\nТекущие параметры: ${JSON.stringify(context.params)}`;
  contextInfo += `\nПоказано квартир: ${context.shownApartments.length}`;
  if (lastShownApartmentId) {
    contextInfo += `\nПоследняя показанная квартира ID: ${lastShownApartmentId}`;
  }
  contextInfo += `\nДоступно ещё квартир: ${availableApartments.length}`;
  if (availableApartments.length > 0) {
    contextInfo += `\nСледующая квартира для показа: ${formatApartmentShort(availableApartments[0])}`;
  }

  // Keep only last 4 messages to significantly reduce LLM latency
  const recentHistory = context.messageHistory.slice(-4);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT + contextInfo },
    ...recentHistory.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content })),
    { role: 'user', content: userMessage },
  ];

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.5,
      max_tokens: 300,
      stream: true,
    });

    let buffer = '';

    for await (const part of completion) {
      const delta = part.choices?.[0]?.delta?.content;
      if (!delta) continue;
      // Send token to caller
      buffer += delta;
      await onToken(delta);
    }

    return { finalResponse: buffer };
  } catch (err: any) {
    console.error('[LLM STREAM] Streaming failed, error:', err?.message || err);
    return { error: err?.message || 'stream_failed' };
  }
}

export function createInitialGreeting(): string {
  return 'Здравствуйте! Я консультант по недвижимости в Дубае. Какую квартиру ищете?';
}
