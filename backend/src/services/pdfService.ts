import puppeteer from 'puppeteer';
import { Apartment } from '../types/index.js';

/**
 * Генерирует PDF презентацию квартиры
 * @param apartment - Данные о квартире
 * @param landingUrl - URL лендинга квартиры
 * @returns Buffer с PDF файлом
 */
export async function generateApartmentPDF(
  apartment: Apartment,
  landingUrl: string
): Promise<Buffer> {
  let browser;
  try {
    console.log(`[PDF] Starting PDF generation for apartment ${apartment.id}`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    
    // Рендерим лендинг в PDF
    await page.goto(landingUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Генерируем PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    console.log(`[PDF] PDF generated successfully, size: ${pdf.length} bytes`);
    return pdf;
  } catch (error: any) {
    console.error('[PDF] Error generating PDF:', error.message);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Альтернативный вариант: генерация простого HTML-based PDF без рендера лендинга
 */
export async function generateSimplePDF(apartment: Apartment): Promise<Buffer> {
  let browser;
  try {
    console.log(`[PDF] Generating simple PDF for apartment ${apartment.id}`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    
    // Создаем HTML контент напрямую
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 40px;
            background: #fff;
          }
          .header {
            border-bottom: 3px solid #d4af37;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          h1 {
            color: #1a1a1a;
            font-size: 32px;
            margin-bottom: 10px;
          }
          .location {
            color: #666;
            font-size: 18px;
          }
          .price {
            font-size: 36px;
            color: #d4af37;
            font-weight: bold;
            margin: 20px 0;
          }
          .details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 30px 0;
          }
          .detail-item {
            padding: 15px;
            background: #f5f5f5;
            border-radius: 8px;
          }
          .detail-label {
            color: #666;
            font-size: 14px;
            margin-bottom: 5px;
          }
          .detail-value {
            color: #1a1a1a;
            font-size: 18px;
            font-weight: 600;
          }
          .description {
            margin: 30px 0;
            line-height: 1.8;
            color: #444;
          }
          .features {
            margin: 30px 0;
          }
          .features h3 {
            margin-bottom: 15px;
            color: #1a1a1a;
          }
          .features ul {
            list-style: none;
          }
          .features li {
            padding: 8px 0;
            padding-left: 25px;
            position: relative;
            color: #444;
          }
          .features li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #d4af37;
            font-weight: bold;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${apartment.name || `Квартира ${apartment.id}`}</h1>
          <div class="location">${apartment.district}, Dubai</div>
        </div>

        <div class="price">${new Intl.NumberFormat('ru-RU').format(apartment.price)} AED</div>

        <div class="details">
          <div class="detail-item">
            <div class="detail-label">Площадь</div>
            <div class="detail-value">${apartment.area} м²</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Спален</div>
            <div class="detail-value">${apartment.bedrooms || 'N/A'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Ванных</div>
            <div class="detail-value">${apartment.bathrooms || 'N/A'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Этаж</div>
            <div class="detail-value">${apartment.floor}</div>
          </div>
        </div>

        <div class="description">
          <p>${apartment.description}</p>
        </div>

        ${apartment.features && apartment.features.length > 0 ? `
        <div class="features">
          <h3>Особенности:</h3>
          <ul>
            ${apartment.features.map((f: string) => `<li>${f}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <div class="footer">
          <p>Dubai AI Real Estate | Ваш персональный консультант по недвижимости</p>
        </div>
      </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    console.log(`[PDF] Simple PDF generated, size: ${pdf.length} bytes`);
    return pdf;
  } catch (error: any) {
    console.error('[PDF] Error generating simple PDF:', error.message);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
