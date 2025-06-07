// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// require('dotenv').config();

// const app = express();

// // Middleware
// app.use(helmet());
// app.use(cors());
// app.use(morgan('combined'));
// app.use(express.json());

// // Simple in-memory storage (for now)
// const qrStorage = new Map();
// const urlStorage = new Map();

// // Health check
// app.get('/health', (req, res) => {
//   res.json({
//     status: 'healthy',
//     service: 'TGT-QR-Service',
//     timestamp: new Date().toISOString()
//   });
// });

// // QR Generation endpoint
// app.post('/api/qr/generate', async (req, res) => {
//   try {
//     const QRCode = require('qrcode');
//     const shortid = require('shortid');
    
//     const { receipt_url } = req.body;
    
//     if (!receipt_url) {
//       return res.status(400).json({ error: 'receipt_url is required' });
//     }
    
//     // Generate IDs
//     const qr_id = shortid.generate();
//     const short_id = shortid.generate();
//     const short_url = `${process.env.BASE_URL}/r/${short_id}`;
    
//     // Generate QR code
//     const qrCode = await QRCode.toDataURL(short_url, {
//       width: 256,
//       margin: 1
//     });
    
//     // Store data
//     const qrData = {
//       qr_id,
//       receipt_url,
//       short_url,
//       short_id,
//       qr_code: qrCode,
//       created_at: new Date().toISOString(),
//       scan_count: 0
//     };
    
//     qrStorage.set(qr_id, qrData);
//     urlStorage.set(short_id, receipt_url);
    
//     // Response
//     res.json({
//       success: true,
//       qr_id,
//       receipt_url,
//       short_url,
//       qr_code: qrCode,
//       qr_image_url: `http://localhost:${process.env.PORT}/api/qr/${qr_id}/image`
//     });
    
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Get QR code as image
// app.get('/api/qr/:qr_id/image', (req, res) => {
//   const qrData = qrStorage.get(req.params.qr_id);
  
//   if (!qrData) {
//     return res.status(404).json({ error: 'QR code not found' });
//   }
  
//   // Convert base64 to buffer
//   const base64Data = qrData.qr_code.replace(/^data:image\/png;base64,/, '');
//   const buffer = Buffer.from(base64Data, 'base64');
  
//   res.set('Content-Type', 'image/png');
//   res.send(buffer);
// });

// // Short URL redirect
// app.get('/r/:short_id', (req, res) => {
//   const originalUrl = urlStorage.get(req.params.short_id);
  
//   if (!originalUrl) {
//     return res.status(404).json({ error: 'Short URL not found' });
//   }
  
//   // Record scan
//   for (let [qr_id, qrData] of qrStorage) {
//     if (qrData.short_id === req.params.short_id) {
//       qrData.scan_count++;
//       qrStorage.set(qr_id, qrData);
//       break;
//     }
//   }
  
//   res.redirect(originalUrl);
// });

// // Get analytics
// app.get('/api/qr/analytics', (req, res) => {
//   const allQRs = Array.from(qrStorage.values());
  
//   res.json({
//     total_qr_codes: allQRs.length,
//     total_scans: allQRs.reduce((sum, qr) => sum + qr.scan_count, 0),
//     qr_codes: allQRs.map(qr => ({
//       qr_id: qr.qr_id,
//       created_at: qr.created_at,
//       scan_count: qr.scan_count
//     }))
//   });
// });

// module.exports = app;