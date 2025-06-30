const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// In-memory storage for receipts (use database in production)
const receipts = new Map();
const shortUrls = new Map();

// Generate short URL
function generateShortUrl() {
  return Math.random().toString(36).substring(2, 8);
}

// Create receipt and generate QR code
app.post("/api/generate-receipt", async (req, res) => {
  try {
    const receiptData = req.body;

    // Validate required fields
    if (
      !receiptData.pos_id ||
      !receiptData.items ||
      !Array.isArray(receiptData.items)
    ) {
      return res.status(400).json({ error: "Invalid receipt data" });
    }

    // Generate unique receipt ID
    const receiptId = uuidv4();
    const timestamp = new Date().toISOString();

    // Store receipt data
    const fullReceiptData = {
      ...receiptData,
      receipt_id: receiptId,
      generated_at: timestamp,
    };

    receipts.set(receiptId, fullReceiptData);

    // Generate short URL
    const shortCode = generateShortUrl();
    const baseUrl = req.protocol + "://" + req.get("host");
    const downloadUrl = `${baseUrl}/download/${receiptId}`;
    const shortUrl = `${baseUrl}/s/${shortCode}`;

    // Map short URL to receipt ID
    shortUrls.set(shortCode, receiptId);

    // Generate QR code with short URL
    const qrCodeDataURL = await QRCode.toDataURL(shortUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    res.json({
      success: true,
      receipt_id: receiptId,
      qr_code: qrCodeDataURL,
      download_url: downloadUrl,
      short_url: shortUrl,
    });
  } catch (error) {
    console.error("Error generating receipt:", error);
    res.status(500).json({ error: "Failed to generate receipt" });
  }
});

// Redirect short URL to download
app.get("/s/:shortCode", (req, res) => {
  const { shortCode } = req.params;
  const receiptId = shortUrls.get(shortCode);

  if (!receiptId) {
    return res.status(404).json({ error: "Short URL not found" });
  }

  res.redirect(`/download/${receiptId}`);
});

// Download PDF receipt
app.get("/download/:receiptId", (req, res) => {
  const { receiptId } = req.params;
  const receiptData = receipts.get(receiptId);

  if (!receiptData) {
    return res.status(404).json({ error: "Receipt not found" });
  }

  try {
    // Create PDF
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="receipt-${receiptId}.pdf"`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text("DIGITAL RECEIPT", { align: "center" });
    doc.moveDown();

    // Store and receipt info
    doc.fontSize(12);
    doc.text(`Store ID: ${receiptData.store_id}`);
    doc.text(`POS ID: ${receiptData.pos_id}`);
    doc.text(`Receipt ID: ${receiptData.receipt_id}`);
    doc.text(`Date: ${new Date(receiptData.timestamp).toLocaleString()}`);
    doc.text(
      `Generated: ${new Date(receiptData.generated_at).toLocaleString()}`
    );
    doc.moveDown();

    // Items header
    doc.fontSize(14).text("ITEMS:", { underline: true });
    doc.moveDown(0.5);

    // Items table header
    doc.fontSize(10);
    doc.text("SKU", 50, doc.y, { width: 80 });
    doc.text("Name", 130, doc.y, { width: 150 });
    doc.text("Qty", 280, doc.y, { width: 50 });
    doc.text("Price", 330, doc.y, { width: 80 });
    doc.text("Total", 410, doc.y, { width: 80 });
    doc.moveDown();

    // Draw line
    doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
    doc.moveDown(0.5);

    // Items
    let subtotal = 0;
    receiptData.items.forEach((item) => {
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
      underline: true,
    });

    doc.moveDown();
    doc.fontSize(12).text(`Payment Mode: ${receiptData.payment_mode}`);

    if (receiptData.customer_contact) {
      doc.text(`Customer Contact: ${receiptData.customer_contact}`);
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).text("Thank you for your purchase!", { align: "center" });
    doc.text("This is a digitally generated receipt.", { align: "center" });

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// Get receipt data (for preview)
app.get("/api/receipt/:receiptId", (req, res) => {
  const { receiptId } = req.params;
  const receiptData = receipts.get(receiptId);

  if (!receiptData) {
    return res.status(404).json({ error: "Receipt not found" });
  }

  res.json(receiptData);
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(5000, "0.0.0.0", () => {
  console.log("Server is running on port 5000");
});
