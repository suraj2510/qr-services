import React, { useState } from 'react';
import './App.css';

const App = () => {
  const [receiptData, setReceiptData] = useState({
    pos_id: 'POS123',
    store_id: 'StoreA',
    items: [{ sku: '', name: '', qty: 1, price: 0 }],
    discount: 0,
    tax: 0,
    payment_mode: 'UPI',
    customer_contact: ''
  });
  
  const [qrCode, setQrCode] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Add new item
  const addItem = () => {
    setReceiptData({
      ...receiptData,
      items: [...receiptData.items, { sku: '', name: '', qty: 1, price: 0 }]
    });
  };

  // Remove item
  const removeItem = (index) => {
    const newItems = receiptData.items.filter((_, i) => i !== index);
    setReceiptData({ ...receiptData, items: newItems });
  };

  // Update item
  const updateItem = (index, field, value) => {
    const newItems = [...receiptData.items];
    newItems[index] = { ...newItems[index], [field]: field === 'qty' || field === 'price' ? Number(value) : value };
    setReceiptData({ ...receiptData, items: newItems });
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = receiptData.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const total = subtotal - receiptData.discount + receiptData.tax;
    return { subtotal, total };
  };

  // Generate receipt and QR code
  const generateReceipt = async () => {
    setLoading(true);
    setError('');
    
    try {
      const { total } = calculateTotals();
      const payload = {
        ...receiptData,
        timestamp: new Date().toISOString(),
        total_amount: total
      };

      const response = await fetch('http://localhost:5000/api/generate-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to generate receipt'); 
      }

      const result = await response.json();
      
      setQrCode(result.qr_code);
      setDownloadUrl(result.download_url);
      setShortUrl(result.short_url);
      
    } catch (err) {
      setError('Failed to generate receipt: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, total } = calculateTotals();

  return (
    <div className="app">
      <div className="container">
        <h1>Digital Receipt Generator</h1>
        
        {error && <div className="error">{error}</div>}
        
        <div className="form-section">
          <h2>Store Information</h2>
          <div className="form-row">
            <input
              type="text"
              placeholder="POS ID"
              value={receiptData.pos_id}
              onChange={(e) => setReceiptData({...receiptData, pos_id: e.target.value})}
            />
            <input
              type="text"
              placeholder="Store ID"
              value={receiptData.store_id}
              onChange={(e) => setReceiptData({...receiptData, store_id: e.target.value})}
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Items</h2>
          {receiptData.items.map((item, index) => (
            <div key={index} className="item-row">
              <input
                type="text"
                placeholder="SKU"
                value={item.sku}
                onChange={(e) => updateItem(index, 'sku', e.target.value)}
              />
              <input
                type="text"
                placeholder="Item Name"
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
              />
              <input
                type="number"
                placeholder="Quantity"
                min="1"
                value={item.qty}
                onChange={(e) => updateItem(index, 'qty', e.target.value)}
              />
              <input
                type="number"
                placeholder="Price (₹)"
                min="0"
                step="0.01"
                value={item.price}
                onChange={(e) => updateItem(index, 'price', e.target.value)}
              />
              <span className="item-total">₹{(item.qty * item.price).toFixed(2)}</span>
              {receiptData.items.length > 1 && (
                <button type="button" onClick={() => removeItem(index)} className="remove-btn">
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addItem} className="add-btn">
            + Add Item
          </button>
        </div>

        <div className="form-section">
          <h2>Payment Details</h2>
          <div className="form-row">
            <input
              type="number"
              placeholder="Discount(₹)"
              min="0"
              value={receiptData.discount}
              onChange={(e) => setReceiptData({...receiptData, discount: Number(e.target.value)})}
            />
            <input
              type="number"
              placeholder="Tax (₹)"
              min="0"
              value={receiptData.tax}
              onChange={(e) => setReceiptData({...receiptData, tax: Number(e.target.value)})}
            />
          </div>
          <div className="form-row">
            <select
              value={receiptData.payment_mode}
              onChange={(e) => setReceiptData({...receiptData, payment_mode: e.target.value})}
            >
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Net Banking">Net Banking</option>
            </select>
            <input
              type="tel"
              placeholder="Customer Contact (Optional)"
              value={receiptData.customer_contact}
              onChange={(e) => setReceiptData({...receiptData, customer_contact: e.target.value})}
            />
          </div>
        </div>

        <div className="summary">
          <h3>Summary</h3>
          <div className="summary-row">
            <span>Subtotal: ₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Discount: -₹{receiptData.discount.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Tax: ₹{receiptData.tax.toFixed(2)}</span>
          </div>
          <div className="summary-row total">
            <span>Total: ₹{total.toFixed(2)}</span>
          </div>
        </div>

        <button 
          onClick={generateReceipt} 
          disabled={loading || receiptData.items.some(item => !item.name || !item.sku)}
          className="generate-btn"
        >
          {loading ? 'Generating...' : 'Generate QR Code'}
        </button>
        

        {qrCode && (
          <div className="qr-section">
            <h2>QR Code Generated!</h2>
            <div className="qr-container">
              <img src={qrCode} alt="QR Code" className="qr-code" />
              <div className="qr-info">
                <p><strong>Short URL:</strong> <a href={shortUrl} target="_blank" rel="noopener noreferrer">{shortUrl}</a></p>
                <p><strong>Download URL:</strong> <a href={downloadUrl} target="_blank" rel="noopener noreferrer">Direct PDF Download</a></p>
                <div className="instructions">
                  <h4>Instructions:</h4>
                  <ol>
                    <li>Scan the QR code with your phone's camera</li>
                    <li>Your phone will open the short URL</li>
                    <li>The PDF receipt will automatically download</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;