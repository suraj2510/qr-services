const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for receipts (use database in production)
const receipts = new Map();
const shortUrls = new Map();

// Generate short URL
function generateShortUrl() {
  return Math.random().toString(36).substring(2, 8);
}

// Create receipt and generate QR code
app.post('/api/generate-receipt', async (req, res) => {
  try {
    const receiptData = req.body;
    
    // Validate required fields
    if (!receiptData.pos_id || !receiptData.items || !Array.isArray(receiptData.items)) {
      return res.status(400).json({ error: 'Invalid receipt data' });
    }

    // Generate unique receipt ID
    const receiptId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Store receipt data
    const fullReceiptData = {
      ...receiptData,
      receipt_id: receiptId,
      generated_at: timestamp
    };
    
    receipts.set(receiptId, fullReceiptData);
    
    // Generate short URL
    const shortCode = generateShortUrl();
    const baseUrl = req.protocol + '://' + req.get('host');
    const downloadUrl = `${baseUrl}/download/${receiptId}`;
    const shortUrl = `${baseUrl}/s/${shortCode}`;
    
    // Map short URL to receipt ID
    shortUrls.set(shortCode, receiptId);
    
    // Generate QR code with short URL
    const qrCodeDataURL = await QRCode.toDataURL(shortUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    res.json({
      success: true,
      receipt_id: receiptId,
      qr_code: qrCodeDataURL,
      download_url: downloadUrl,
      short_url: shortUrl
    });
    
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ error: 'Failed to generate receipt' });
  }
});

// Redirect short URL to download
app.get('/s/:shortCode', (req, res) => {
  const { shortCode } = req.params;
  const receiptId = shortUrls.get(shortCode);
  
  if (!receiptId) {
    return res.status(404).json({ error: 'Short URL not found' });
  }
  
  res.redirect(`/download/${receiptId}`);
});

// Download PDF receipt
app.get('/download/:receiptId', (req, res) => {
  const { receiptId } = req.params;
  const receiptData = receipts.get(receiptId);
  
  if (!receiptData) {
    return res.status(404).json({ error: 'Receipt not found' });
  }
  
  try {
    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receiptId}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add content to PDF
    doc.fontSize(20).text('DIGITAL RECEIPT', { align: 'center' });
    doc.moveDown();
    
    // Store and receipt info
    doc.fontSize(12);
    doc.text(`Store ID: ${receiptData.store_id}`);
    doc.text(`POS ID: ${receiptData.pos_id}`);
    doc.text(`Receipt ID: ${receiptData.receipt_id}`);
    doc.text(`Date: ${new Date(receiptData.timestamp).toLocaleString()}`);
    doc.text(`Generated: ${new Date(receiptData.generated_at).toLocaleString()}`);
    doc.moveDown();
    
    // Items header
    doc.fontSize(14).text('ITEMS:', { underline: true });
    doc.moveDown(0.5);
    
    // Items table header
    doc.fontSize(10);
    doc.text('SKU', 50, doc.y, { width: 80 });
    doc.text('Name', 130, doc.y, { width: 150 });
    doc.text('Qty', 280, doc.y, { width: 50 });
    doc.text('Price', 330, doc.y, { width: 80 });
    doc.text('Total', 410, doc.y, { width: 80 });
    doc.moveDown();
    
    // Draw line
    doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
    doc.moveDown(0.5);
    
    // Items
    let subtotal = 0;
    receiptData.items.forEach(item => {
      const itemTotal = item.qty * item.price;
      subtotal += itemTotal;
      
      doc.text(item.sku, 50, doc.y, { width: 80 });
      doc.text(item.name, 130, doc.y, { width: 150 });
      doc.text(item.qty.toString(), 280, doc.y, { width: 50 });
      doc.text(`₹${item.price}`, 330, doc.y, { width: 80 });
      doc.text(`₹${itemTotal}`, 410, doc.y, { width: 80 });
      doc.moveDown();
    });
    
    // Summary
    doc.moveDown();
    doc.moveTo(300, doc.y).lineTo(500, doc.y).stroke();
    doc.moveDown(0.5);
    
    doc.fontSize(12);
    doc.text(`Subtotal: ₹${subtotal}`, 350, doc.y);
    doc.text(`Discount: -₹${receiptData.discount || 0}`, 350, doc.y);
    doc.text(`Tax: ₹${receiptData.tax || 0}`, 350, doc.y);
    doc.moveDown(0.5);
    
    doc.fontSize(14).text(`TOTAL: ₹${receiptData.total_amount}`, 350, doc.y, { 
      underline: true 
    });
    
    doc.moveDown();
    doc.fontSize(12).text(`Payment Mode: ${receiptData.payment_mode}`);
    
    if (receiptData.customer_contact) {
      doc.text(`Customer Contact: ${receiptData.customer_contact}`);
    }
    
    // Footer
    doc.moveDown(2);
    doc.fontSize(10).text('Thank you for your purchase!', { align: 'center' });
    doc.text('This is a digitally generated receipt.', { align: 'center' });
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Get receipt data (for preview)
app.get('/api/receipt/:receiptId', (req, res) => {
  const { receiptId } = req.params;
  const receiptData = receipts.get(receiptId);
  
  if (!receiptData) {
    return res.status(404).json({ error: 'Receipt not found' });
  }
  
  res.json(receiptData);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(5000, '0.0.0.0', () => {
  console.log('Server is running on port 5000'); 
});











// server.js
// const express = require('express');
// const cors = require('cors');
// const QRCode = require('qrcode');
// const PDFDocument = require('pdfkit');
// const { v4: uuidv4 } = require('uuid');
// const path = require('path');
// const fs = require('fs');

// const app = express();
// const PORT = process.env.PORT || 5000;

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use('/receipts', express.static('receipts'));

// // Ensure receipts directory exists
// if (!fs.existsSync('receipts')) {
//   fs.mkdirSync('receipts');
// }

// // Store receipts in memory (in production, use a database)
// const receipts = new Map();

// // Generate QR Code endpoint
// app.post('/api/generate-qr', async (req, res) => {
//   try {
//     const receiptData = req.body;
    
//     // Validate required fields
//     if (!receiptData.pos_id || !receiptData.items || !Array.isArray(receiptData.items)) {
//       return res.status(400).json({ error: 'Invalid receipt data' });
//     }

//     // Add timestamp if not provided
//     if (!receiptData.timestamp) {
//       receiptData.timestamp = new Date().toISOString();
//     }

//     // Generate unique receipt ID
//     const receiptId = uuidv4();
    
//     // Store receipt data
//     receipts.set(receiptId, receiptData);

//     // Create QR code data (URL to download PDF)
//     const qrData = `${req.protocol}://${req.get('host')}/api/download-pdf/${receiptId}`;
    
//     // Generate QR code
//     const qrCodeDataURL = await QRCode.toDataURL(qrData, {
//       width: 300,
//       margin: 2,
//       color: {
//         dark: '#000000',
//         light: '#FFFFFF'
//       }
//     });

//     res.json({
//       success: true,
//       receiptId,
//       qrCode: qrCodeDataURL,
//       downloadUrl: qrData,
//       receiptData
//     });

//   } catch (error) {
//     console.error('Error generating QR code:', error);
//     res.status(500).json({ error: 'Failed to generate QR code' });
//   }
// });

// // Download PDF endpoint
// app.get('/api/download-pdf/:receiptId', async (req, res) => {
//   try {
//     const { receiptId } = req.params;
//     const receiptData = receipts.get(receiptId);

//     if (!receiptData) {
//       return res.status(404).json({ error: 'Receipt not found' });
//     }

//     // Generate PDF
//     const doc = new PDFDocument({ margin: 50 });
//     const filename = `receipt_${receiptId}.pdf`;
//     const filepath = path.join(__dirname, 'receipts', filename);

//     // Pipe PDF to file and response
//     doc.pipe(fs.createWriteStream(filepath));
//     doc.pipe(res);

//     // Set response headers
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

//     // PDF Content
//     doc.fontSize(20).text('DIGITAL RECEIPT', 50, 50, { align: 'center' });
//     doc.moveDown();

//     // Store and POS info
//     doc.fontSize(12)
//        .text(`Store ID: ${receiptData.store_id || 'N/A'}`, 50, 100)
//        .text(`POS ID: ${receiptData.pos_id}`, 50, 115)
//        .text(`Date: ${new Date(receiptData.timestamp).toLocaleString()}`, 50, 130);

//     // Draw line
//     doc.moveTo(50, 150).lineTo(550, 150).stroke();

//     // Items header
//     doc.fontSize(14).text('ITEMS', 50, 170);
//     doc.fontSize(10)
//        .text('SKU', 50, 190)
//        .text('Name', 120, 190)
//        .text('Qty', 350, 190)
//        .text('Price', 400, 190)
//        .text('Total', 480, 190);

//     // Draw line under header
//     doc.moveTo(50, 205).lineTo(550, 205).stroke();

//     // Items
//     let yPosition = 220;
//     receiptData.items.forEach((item, index) => {
//       const itemTotal = item.qty * item.price;
//       doc.fontSize(10)
//          .text(item.sku, 50, yPosition)
//          .text(item.name, 120, yPosition)
//          .text(item.qty.toString(), 350, yPosition)
//          .text(`₹${item.price}`, 400, yPosition)
//          .text(`₹${itemTotal}`, 480, yPosition);
//       yPosition += 15;
//     });

//     // Draw line before totals
//     yPosition += 10;
//     doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
//     yPosition += 20;

//     // Calculate subtotal
//     const subtotal = receiptData.items.reduce((sum, item) => sum + (item.qty * item.price), 0);

//     // Totals
//     doc.fontSize(12)
//        .text(`Subtotal: ₹${subtotal}`, 400, yPosition)
//        .text(`Discount: ₹${receiptData.discount || 0}`, 400, yPosition + 20)
//        .text(`Tax: ₹${receiptData.tax || 0}`, 400, yPosition + 40)
//        .text(`Total Amount: ₹${receiptData.total_amount}`, 400, yPosition + 60);

//     // Payment info
//     yPosition += 100;
//     doc.text(`Payment Mode: ${receiptData.payment_mode || 'N/A'}`, 50, yPosition);
//     if (receiptData.customer_contact) {
//       doc.text(`Customer Contact: ${receiptData.customer_contact}`, 50, yPosition + 20);
//     }

//     // Footer
//     doc.fontSize(8)
//        .text('Thank you for your business!', 50, yPosition + 60, { align: 'center' })
//        .text(`Receipt ID: ${receiptId}`, 50, yPosition + 80, { align: 'center' });

//     doc.end();

//   } catch (error) {
//     console.error('Error generating PDF:', error);
//     res.status(500).json({ error: 'Failed to generate PDF' });
//   }
// });

// // Get receipt data endpoint (for testing)
// app.get('/api/receipt/:receiptId', (req, res) => {
//   const { receiptId } = req.params;
//   const receiptData = receipts.get(receiptId);

//   if (!receiptData) {
//     return res.status(404).json({ error: 'Receipt not found' });
//   }

//   res.json({ receiptId, data: receiptData });
// });

// // Health check
// app.get('/api/health', (req, res) => {
//   res.json({ status: 'OK', timestamp: new Date().toISOString() });
// });

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// module.exports = app;





























// const app = require('./app');

// const PORT = process.env.PORT || 3001;

// app.listen(PORT, () => {
//   console.log(`🚀 QR Service running on port ${PORT}`);
//   console.log(`📊 Health: http://localhost:${PORT}/health`);
//   console.log(`🔗 Generate QR: POST http://localhost:${PORT}/api/qr/generate`);
// });