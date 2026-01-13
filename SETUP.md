# Dubai AI Consultant - Инструкция по запуску

## Требования

- Node.js 18+ 
- npm или yarn
- API ключи:
  - OpenAI API Key (для Whisper STT и GPT-4o-mini)
  - ElevenLabs API Key (для TTS)

## Быстрый старт

### 1. Установка зависимостей

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Настройка API ключей

Создайте файл `backend/.env`:

```env
OPENAI_API_KEY=sk-your-openai-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB
PORT=3001
```

**Где взять ключи:**
- OpenAI: https://platform.openai.com/api-keys
- ElevenLabs: https://elevenlabs.io/app/settings/api-keys

**Выбор голоса ElevenLabs:**
По умолчанию используется голос "Adam" (ID: pNInz6obpgDQGcFmaJgB).
Другие русскоязычные голоса можно найти в библиотеке ElevenLabs.

### 3. Запуск

**Терминал 1 - Backend:**
```bash
cd backend
npm run dev
```

**Терминал 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 4. Открыть в браузере

http://localhost:3000

## Использование

1. Нажмите **"Начать звонок"**
2. Дождитесь приветствия ИИ-консультанта
3. **Удерживайте кнопку микрофона** и говорите
4. Отпустите для отправки
5. Дождитесь ответа

### Примеры запросов:
- "Ищу квартиру в Dubai Marina до 3 миллионов"
- "Покажи варианты площадью от 80 квадратов"
- "Хочу высокий этаж с видом на море"
- "Покажи следующий вариант"
- "Мне нравится, хочу узнать больше"

## Структура проекта

```
dubai_demo/
├── backend/
│   ├── src/
│   │   ├── data/
│   │   │   └── apartments.json    # База квартир
│   │   ├── services/
│   │   │   ├── sttService.ts      # OpenAI Whisper
│   │   │   ├── ttsService.ts      # ElevenLabs
│   │   │   ├── dialogueService.ts # GPT-4o-mini
│   │   │   ├── apartmentService.ts
│   │   │   └── analyticsService.ts
│   │   ├── types/
│   │   └── index.ts               # Express сервер
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── styles/
│   └── package.json
└── SETUP.md
```

## API Endpoints

| Метод | URL | Описание |
|-------|-----|----------|
| POST | /api/session/start | Начать сессию |
| POST | /api/chat/voice | Отправить голосовое сообщение |
| GET | /api/apartment/:id | Получить данные квартиры |
| POST | /api/session/end | Завершить сессию |
| GET | /api/analytics | Получить аналитику |

## Аналитика

Все данные сессий логируются в консоль backend и доступны по адресу:
http://localhost:3001/api/analytics

## Troubleshooting

**Микрофон не работает:**
- Разрешите доступ к микрофону в браузере
- Используйте HTTPS или localhost

**Ошибка API:**
- Проверьте правильность API ключей
- Убедитесь, что на аккаунтах есть баланс

**Нет звука:**
- Проверьте громкость
- Разрешите автовоспроизведение аудио в браузере

