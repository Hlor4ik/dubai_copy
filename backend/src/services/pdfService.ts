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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    
    // Собираем только существующие детали
    const details = [
      { label: 'Площадь', value: `${apartment.area} м²` },
      { label: 'Этаж', value: apartment.floor },
    ];
    
    if (apartment.bedrooms) {
      details.push({ label: 'Спален', value: apartment.bedrooms });
    }
    if (apartment.bathrooms) {
      details.push({ label: 'Ванных', value: apartment.bathrooms });
    }
    
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
            background: #fff;
            color: #1a1a1a;
          }
          
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          
          .header {
            background: linear-gradient(135deg, #d4af37 0%, #c5a028 100%);
            color: white;
            padding: 40px;
            text-align: center;
          }
          
          .header h1 {
            font-size: 36px;
            margin-bottom: 10px;
            font-weight: 600;
          }
          
          .header .location {
            font-size: 18px;
            opacity: 0.9;
          }
          
          .price-section {
            background: #f8f8f8;
            padding: 30px 40px;
            text-align: center;
          }
          
          .price {
            font-size: 48px;
            color: #d4af37;
            font-weight: bold;
          }
          
          .price-label {
            color: #666;
            font-size: 14px;
            margin-top: 5px;
          }
          
          ${apartment.images && apartment.images.length > 0 ? `
          .gallery {
            padding: 40px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
          }
          
          .gallery img {
            width: 100%;
            height: 250px;
            object-fit: cover;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          
          .gallery img:first-child {
            grid-column: 1 / -1;
            height: 350px;
          }
          ` : ''}
          
          .details {
            padding: 40px;
            display: grid;
            grid-template-columns: repeat(${Math.min(details.length, 2)}, 1fr);
            gap: 20px;
          }
          
          .detail-card {
            background: #f8f8f8;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            border: 2px solid #e0e0e0;
          }
          
          .detail-label {
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          
          .detail-value {
            color: #1a1a1a;
            font-size: 24px;
            font-weight: 600;
          }
          
          .description-section {
            padding: 40px;
            background: white;
          }
          
          .section-title {
            font-size: 24px;
            margin-bottom: 20px;
            color: #1a1a1a;
            border-left: 4px solid #d4af37;
            padding-left: 15px;
          }
          
          .description {
            line-height: 1.8;
            color: #444;
            font-size: 16px;
          }
          
          .features-section {
            padding: 40px;
            background: #f8f8f8;
          }
          
          .features-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-top: 20px;
          }
          
          .feature-item {
            display: flex;
            align-items: center;
            padding: 12px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .feature-icon {
            color: #d4af37;
            font-weight: bold;
            font-size: 20px;
            margin-right: 12px;
          }
          
          .feature-text {
            color: #444;
            font-size: 14px;
          }
          
          .footer {
            background: #1a1a1a;
            color: white;
            padding: 30px 40px;
            text-align: center;
          }
          
          .footer-logo {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #d4af37;
          }
          
          .footer-text {
            color: #999;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1>${apartment.name || `Квартира в ${apartment.district}`}</h1>
            <div class="location">📍 ${apartment.district}, Dubai, UAE</div>
          </div>
          
          <!-- Price -->
          <div class="price-section">
            <div class="price">${new Intl.NumberFormat('ru-RU').format(apartment.price)} AED</div>
            <div class="price-label">≈ ${new Intl.NumberFormat('ru-RU').format(Math.round(apartment.price / 3.67))} USD</div>
          </div>
          
          ${apartment.images && apartment.images.length > 0 ? `
          <!-- Gallery -->
          <div class="gallery">
            ${apartment.images.slice(0, 3).map((img: string) => `
              <img src="${img}" alt="Property photo" />
            `).join('')}
          </div>
          ` : ''}
          
          <!-- Details -->
          <div class="details">
            ${details.map(detail => `
              <div class="detail-card">
                <div class="detail-label">${detail.label}</div>
                <div class="detail-value">${detail.value}</div>
              </div>
            `).join('')}
          </div>
          
          <!-- Description -->
          <div class="description-section">
            <h2 class="section-title">Описание</h2>
            <div class="description">${apartment.description}</div>
          </div>
          
          ${apartment.features && apartment.features.length > 0 ? `
          <!-- Features -->
          <div class="features-section">
            <h2 class="section-title">Особенности</h2>
            <div class="features-grid">
              ${apartment.features.map((f: string) => `
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">${f}</div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          <!-- Footer -->
          <div class="footer">
            <div class="footer-logo">◆ Dubai AI</div>
            <div class="footer-text">Ваш персональный AI-консультант по недвижимости в Дубае</div>
          </div>
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
