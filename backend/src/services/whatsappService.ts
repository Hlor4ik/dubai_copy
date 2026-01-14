import axios from 'axios';

const GREEN_API_URL = process.env.GREEN_API_URL || '';
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN || '';

/**
 * Отправляет файл (PDF) в WhatsApp через Green API
 * @param phoneNumber - Номер телефона в международном формате (например: 79991234567)
 * @param fileUrl - Публичный URL файла для отправки
 * @param caption - Подпись к файлу
 */
export async function sendWhatsAppFile(
  phoneNumber: string,
  fileUrl: string,
  caption: string = ''
): Promise<{ success: boolean; error?: string }> {
  try {
    // Форматируем номер (Green API требует формат: 79991234567@c.us)
    const formattedPhone = phoneNumber.replace(/\D/g, ''); // убираем все не-цифры
    const chatId = `${formattedPhone}@c.us`;

    console.log(`[WhatsApp] Sending file to ${chatId}`);

    const response = await axios.post(
      `${GREEN_API_URL}/sendFileByUrl`,
      {
        chatId,
        urlFile: fileUrl,
        fileName: 'presentation.pdf',
        caption,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GREEN_API_TOKEN}`,
        },
        timeout: 30000,
      }
    );

    if (response.data && response.data.idMessage) {
      console.log(`[WhatsApp] File sent successfully, message ID: ${response.data.idMessage}`);
      return { success: true };
    } else {
      console.error('[WhatsApp] Unexpected response:', response.data);
      return { success: false, error: 'Unexpected response from Green API' };
    }
  } catch (error: any) {
    console.error('[WhatsApp] Error sending file:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Отправляет текстовое сообщение в WhatsApp
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    const chatId = `${formattedPhone}@c.us`;

    console.log(`[WhatsApp] Sending message to ${chatId}`);

    const response = await axios.post(
      `${GREEN_API_URL}/sendMessage`,
      {
        chatId,
        message,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GREEN_API_TOKEN}`,
        },
        timeout: 10000,
      }
    );

    if (response.data && response.data.idMessage) {
      console.log(`[WhatsApp] Message sent successfully`);
      return { success: true };
    } else {
      return { success: false, error: 'Unexpected response' };
    }
  } catch (error: any) {
    console.error('[WhatsApp] Error sending message:', error.message);
    return { success: false, error: error.message };
  }
}
