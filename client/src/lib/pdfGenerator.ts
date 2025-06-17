interface AnalysisData {
  id: number;
  sessionId: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  amount: number;
  propertyType: string;
  planType: string;
  analysisData: {
    locationScore: number;
    growthPrediction: number;
    nearbyPlaces: Array<{
      name: string;
      vicinity: string;
      rating?: number;
      types: string[];
    }>;
    distances: Record<string, {
      distance: { text: string; value: number };
      duration: { text: string; value: number };
    }>;
    streetViewUrl?: string;
    aiRecommendations?: string[];
  };
  createdAt: string;
}

export const generatePDF = (analysis: AnalysisData) => {
  // Create a new window for the PDF content
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    alert('Please allow popups to download the PDF');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>PlotterAI - Property Analysis Report</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          line-height: 1.6;
          color: #333;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #FF5A5F;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #FF5A5F;
          margin-bottom: 10px;
        }
        .report-title {
          font-size: 20px;
          margin: 0;
        }
        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          color: #FF5A5F;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
          margin-bottom: 15px;
        }
        .property-details {
          background-color: #f9f9f9;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .detail-label {
          font-weight: bold;
          color: #666;
        }
        .score-container {
          text-align: center;
          background-color: #f0f9ff;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .score-value {
          font-size: 36px;
          font-weight: bold;
          color: #FF5A5F;
        }
        .growth-container {
          text-align: center;
          background-color: #f0fdf4;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .growth-value {
          font-size: 36px;
          font-weight: bold;
          color: #10b981;
        }
        .places-list {
          list-style: none;
          padding: 0;
        }
        .places-list li {
          background-color: #f9f9f9;
          padding: 10px;
          margin-bottom: 10px;
          border-radius: 5px;
          display: flex;
          justify-content: space-between;
        }
        .recommendation {
          background-color: #fef3c7;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 10px;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 12px;
        }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">PlotterAI</div>
        <h1 class="report-title">Property Investment Analysis Report</h1>
        <p>Generated on ${new Date(analysis.createdAt).toLocaleDateString()}</p>
      </div>

      <div class="section">
        <h2 class="section-title">Property Details</h2>
        <div class="property-details">
          <div class="detail-row">
            <span class="detail-label">Location:</span>
            <span>${analysis.location.address}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Investment Amount:</span>
            <span>₹${analysis.amount.toLocaleString()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Property Type:</span>
            <span>${analysis.propertyType.replace('_', ' ').toUpperCase()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Plan Type:</span>
            <span>${analysis.planType.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">Location Score</h2>
        <div class="score-container">
          <div class="score-value">${analysis.analysisData.locationScore.toFixed(1)}/5</div>
          <p>Excellent location with good connectivity to key amenities</p>
        </div>
        
        <h3>Distance to Key Places</h3>
        <ul class="places-list">
          ${Object.entries(analysis.analysisData.distances).map(([name, data]) => `
            <li>
              <span>${name}</span>
              <span>${data.distance.text}</span>
            </li>
          `).join('')}
        </ul>
      </div>

      ${analysis.planType !== 'free' ? `
        <div class="section">
          <h2 class="section-title">Growth Potential</h2>
          <div class="growth-container">
            <div class="growth-value">+${analysis.analysisData.growthPrediction}%</div>
            <p>Expected appreciation in 3 years</p>
          </div>
          
          <div class="property-details">
            <div class="detail-row">
              <span class="detail-label">Current Value:</span>
              <span>₹${analysis.amount.toLocaleString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Projected Value:</span>
              <span>₹${Math.round(analysis.amount * (1 + analysis.analysisData.growthPrediction / 100)).toLocaleString()}</span>
            </div>
          </div>
        </div>
      ` : ''}

      ${analysis.planType === 'pro' && analysis.analysisData.aiRecommendations ? `
        <div class="section">
          <h2 class="section-title">AI Recommendations</h2>
          ${analysis.analysisData.aiRecommendations.map(rec => `
            <div class="recommendation">
              <p>${rec}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="section">
        <h2 class="section-title">Nearby Places</h2>
        <ul class="places-list">
          ${analysis.analysisData.nearbyPlaces.slice(0, 10).map(place => `
            <li>
              <div>
                <strong>${place.name}</strong>
                <br>
                <small>${place.vicinity}</small>
              </div>
              ${place.rating ? `<span>★ ${place.rating}</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="footer">
        <p>This report was generated by PlotterAI - Real Estate Location Intelligence</p>
        <p>Report ID: ${analysis.sessionId}</p>
        <p>© 2024 PlotterAI. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };
};
