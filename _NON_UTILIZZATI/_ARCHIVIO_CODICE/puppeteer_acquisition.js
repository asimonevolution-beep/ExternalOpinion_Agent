const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');

class PuppeteerAcquisition {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * Initializes Puppeteer browser instance
   */
  async init() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
      this.page = await this.browser.newPage();

      // Set user agent to avoid detection
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      logger.info('Puppeteer acquisition initialized');
    } catch (error) {
      logger.error('Failed to initialize Puppeteer:', error);
      throw error;
    }
  }

  /**
   * Downloads PDF from auction website using Puppeteer
   * @param {string} url - Auction URL
   * @param {string} outputPath - Path to save PDF
   * @returns {boolean} Success status
   */
  async downloadAuctionPDF(url, outputPath) {
    try {
      if (!this.page) await this.init();

      logger.info(`Navigating to auction URL: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for PDF download link to appear
      await this.page.waitForSelector('a[href*="pdf"], button[onclick*="pdf"]', { timeout: 10000 });

      // Find PDF download link
      const pdfLink = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="pdf"]'));
        return links.length > 0 ? links[0].href : null;
      });

      if (!pdfLink) {
        throw new Error('No PDF download link found on page');
      }

      // Download PDF
      const response = await this.page.goto(pdfLink, { waitUntil: 'networkidle2' });
      const buffer = await response.buffer();

      await fs.writeFile(outputPath, buffer);
      logger.info(`PDF downloaded successfully to: ${outputPath}`);

      return true;
    } catch (error) {
      logger.error('Failed to download PDF:', error);
      return false;
    }
  }

  /**
   * Extracts auction data from webpage
   * @param {string} url - Auction URL
   * @returns {Object} Extracted data
   */
  async extractAuctionData(url) {
    try {
      if (!this.page) await this.init();

      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      const data = await this.page.evaluate(() => {
        const extractText = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.textContent.trim() : null;
        };

        const extractNumber = (text) => {
          if (!text) return null;
          const match = text.match(/[\d.,]+/);
          return match ? parseFloat(match[0].replace(',', '.')) : null;
        };

        return {
          title: extractText('h1, .auction-title'),
          basePrice: extractNumber(extractText('.base-price, .starting-price')),
          area: extractNumber(extractText('.area, .surface')),
          location: extractText('.location, .address'),
          auctionDate: extractText('.auction-date, .date'),
          description: extractText('.description, .details'),
        };
      });

      logger.info('Auction data extracted:', data);
      return data;
    } catch (error) {
      logger.error('Failed to extract auction data:', error);
      return null;
    }
  }

  /**
   * Monitors auction website for new listings
   * @param {string} url - Base auction website URL
   * @param {Function} callback - Callback for new auctions
   */
  async monitorAuctions(url, callback) {
    try {
      if (!this.page) await this.init();

      // Set up monitoring loop
      setInterval(async () => {
        try {
          await this.page.goto(url, { waitUntil: 'networkidle2' });

          const newAuctions = await this.page.evaluate(() => {
            // Extract new auction listings (this would need to be customized per site)
            const auctions = Array.from(document.querySelectorAll('.auction-item, .listing'));
            return auctions.map(auction => ({
              title: auction.querySelector('.title')?.textContent?.trim(),
              url: auction.querySelector('a')?.href,
              price: auction.querySelector('.price')?.textContent?.trim(),
            })).filter(a => a.title && a.url);
          });

          if (newAuctions.length > 0) {
            logger.info(`Found ${newAuctions.length} new auctions`);
            callback(newAuctions);
          }
        } catch (error) {
          logger.error('Error during auction monitoring:', error);
        }
      }, 300000); // Check every 5 minutes

      logger.info('Auction monitoring started');
    } catch (error) {
      logger.error('Failed to start auction monitoring:', error);
    }
  }

  /**
   * Closes browser instance
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Puppeteer browser closed');
    }
  }
}

module.exports = new PuppeteerAcquisition();