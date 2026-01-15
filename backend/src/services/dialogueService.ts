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

const SYSTEM_PROMPT = `You are a concise Russian-speaking real estate consultant in Dubai. Reply ONLY with valid JSON (no markdown, no text outside JSON).

JSON FORMAT (exact keys):
{"response": "1-2 sentences max, Russian", "params_update": {"district": null, "price_min": null, "price_max": null, "area_min": null, "area_max": null, "floor_min": null, "floor_max": null}, "action": "none"}

PARAM EXTRACTION:
- Extract only when user clearly mentions it; otherwise leave null
- price_* in AED; area in m²; district from list: Dubai Marina, Downtown Dubai, Palm Jumeirah, JBR, Business Bay, Dubai Hills, Creek Harbour, JVC, DIFC
- DISTRICT RECOGNITION: Accept variations like "Пальмс/Палмс/Palms Джумейра" → Palm Jumeirah; "Марина" → Dubai Marina; "ДжиБиАр/GBR" → JBR; "Даунтаун" → Downtown Dubai
- CRITICAL: When user says "увеличим/изменим/поменяем бюджет до X" → EXTRACT price_max: X and trigger "search"
- Examples: "увеличим до 3 млн" → price_max: 3000000; "изменим на 5 миллионов" → price_max: 5000000; "уменьшим до 1.5 млн" → price_max: 1500000
- ALWAYS overwrite parameter when user explicitly changes it ("увеличим", "изменим", "поменяем", "теперь", "другой")

ACTION RULES:
- "search": if (user changes ANY parameter like "увеличим бюджет", "другой район") OR (user has 2+ params and wants to see: "покажи", "ищи", "давай")
- "next": only when user rejects current option ("другую", "следующую", "не подходит")
- "confirm_interest": only after an apartment was shown and user agrees ("да", "эта", "нравится", "беру", "хочу эту")
- "none": default continue dialog
- "end": farewell

RESPONSE STYLE:
- 1-2 sentences, no repetition of user’s words
- If parameters are enough for search → propose action "search" and confirm what will be shown
- If info is missing → ask for ONE useful missing thing (district or budget), but only one question
- Be proactive: do not delay search when user is ready`;

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

  // Check for budget/parameter change requests
  if (/(давай|поменяй|измен|уменьш|увелич|другой|изменим|поменяем).*(бюджет|цен|цену|цен|параметр)/i.test(lowerMsg) || /^(другой бюджет|изменить цену|уменьшить|увеличить).*/i.test(lowerMsg)) {
    return {
      response: 'Понятно, давайте подберём для вас подходящий вариант с новым бюджетом. Какая сумма вас интересует?',
      paramsUpdate: {},
      action: 'none',
    };
  }

  // Check for district changes in local message (expanded patterns for all districts)
  const districtMatch = lowerMsg.match(/\b(джибиар|джи би ар|джей би ар|gbr|jbr|дубай марина|дубаи марина|марина|marina|палм джумейра|пальм джумейра|пальмс джумейра|палмс джумейра|palm jumeirah|palms|даунтаун|downtown|бизнес бей|бизнес бэй|business bay|дубай хиллс|дубаи хиллс|dubai hills|hills|джей ви си|jvc|крик харбур|крик харбор|creek harbour|creek|дифс|difc)\b/i);
  let detectedDistrict: string | null = null;
  if (districtMatch) {
    const raw = districtMatch[1].toLowerCase();
    if (/джибиар|джи би ар|джей би ар|gbr|jbr/.test(raw)) detectedDistrict = 'JBR';
    else if (/дубай марина|дубаи марина|марина|marina/.test(raw)) detectedDistrict = 'Dubai Marina';
    else if (/палм|пальм|palms?/.test(raw)) detectedDistrict = 'Palm Jumeirah';
    else if (/даунтаун|downtown/.test(raw)) detectedDistrict = 'Downtown Dubai';
    else if (/бизнес бей|бизнес бэй|business bay/.test(raw)) detectedDistrict = 'Business Bay';
    else if (/дубай хиллс|дубаи хиллс|dubai hills|hills/.test(raw)) detectedDistrict = 'Dubai Hills';
    else if (/джей ви си|jvc/.test(raw)) detectedDistrict = 'JVC';
    else if (/крик|creek/.test(raw)) detectedDistrict = 'Creek Harbour';
    else if (/difc/.test(raw)) detectedDistrict = 'DIFC';
  }

  // Check for "start search now" when user has at least one parameter
  const hasParams = Object.keys(context.params).length > 0;
  
  // If user just says a district name when params exist, auto-search
  if (hasParams && detectedDistrict && lowerMsg.split(/\s+/).length <= 4) {
    const searchParams = { ...context.params, district: detectedDistrict };
    const availableApartments = searchApartments(searchParams, context.shownApartments);
    if (availableApartments.length > 0) {
      const apartment = availableApartments[0];
      return {
        response: `Вот вариант: ${formatApartmentForVoice(apartment)} Нравится?`,
        paramsUpdate: { district: detectedDistrict },
        action: 'search',
        apartment,
      };
    } else {
      return {
        response: 'По этим параметрам нет вариантов. Уточните запрос.',
        paramsUpdate: { district: detectedDistrict },
        action: 'none',
      };
    }
  }
  
  if (hasParams && /^(нет|всё|начинай|начни|ищи|покажи|давай|поехали|го|поиск|варианты|показать|посмотрим)[,.\s!]?/i.test(lowerMsg)) {
    // Apply detected district change
    const searchParams = detectedDistrict ? { ...context.params, district: detectedDistrict } : context.params;
    const availableApartments = searchApartments(searchParams, context.shownApartments);
    if (availableApartments.length > 0) {
      const apartment = availableApartments[0];
      return {
        response: `Вот вариант: ${formatApartmentForVoice(apartment)} Нравится?`,
        paramsUpdate: detectedDistrict ? { district: detectedDistrict } : {},
        action: 'search',
        apartment,
      };
    } else {
      return {
        response: 'По этим параметрам нет вариантов. Уточните запрос.',
        paramsUpdate: detectedDistrict ? { district: detectedDistrict } : {},
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
    model: 'gpt-4o',
    messages,
    temperature: 0.3,
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
      model: 'gpt-4o',
      messages,
      temperature: 0.3,
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
