import fetch from 'node-fetch';

async function testAirQuality() {
  try {
    console.log('Testing Halugunda air quality and traffic data...');
    
    const response = await fetch('http://localhost:5000/api/result/session_1750316284506_zqet29xxm');
    const data = await response.json();
    
    if (data.success && data.result) {
      console.log('\n=== TRAFFIC DATA ===');
      console.log('Density:', data.result.trafficData?.density);
      console.log('Peak Hours:', data.result.trafficData?.peakHours);
      console.log('Connectivity:', data.result.trafficData?.connectivity);
      
      console.log('\n=== AIR QUALITY DATA ===');
      console.log('Level:', data.result.airQuality?.level);
      console.log('AQI:', data.result.airQuality?.aqi);
      console.log('Pollution Sources:', data.result.airQuality?.pollutionSources);
      
      console.log('\n=== LOCATION DETAILS ===');
      console.log('Address:', data.result.location?.address);
      console.log('Location Score:', data.result.locationScore);
      console.log('Investment Viability:', data.result.investmentViability + '%');
      
      if (data.result.aiIntelligence) {
        console.log('\n=== AI CLASSIFICATION ===');
        console.log('Location Type:', data.result.aiIntelligence.locationType);
        console.log('Area Classification:', data.result.aiIntelligence.areaClassification);
      }
    } else {
      console.log('No result data found or analysis still processing');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAirQuality();