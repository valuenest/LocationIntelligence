
interface CurrencyRate {
  code: string;
  name: string;
  symbol: string;
  rate: number; // Rate relative to INR (base currency)
}

interface Country {
  code: string;
  name: string;
  currency: CurrencyRate;
}

// Exchange rates relative to INR (Indian Rupee as base)
export const currencyRates: Record<string, CurrencyRate> = {
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', rate: 1.0 },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', rate: 0.012 }, // 1 USD = ~83 INR
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.011 }, // 1 EUR = ~90 INR
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.0095 }, // 1 GBP = ~105 INR
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', rate: 0.016 }, // 1 CAD = ~62 INR
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rate: 0.018 }, // 1 AUD = ~55 INR
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', rate: 0.016 }, // 1 SGD = ~62 INR
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rate: 0.044 }, // 1 AED = ~23 INR
  SAR: { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', rate: 0.045 }, // 1 SAR = ~22 INR
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rate: 1.8 }, // 1 JPY = ~0.55 INR
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rate: 0.085 }, // 1 CNY = ~12 INR
  KRW: { code: 'KRW', name: 'South Korean Won', symbol: '₩', rate: 16 }, // 1 KRW = ~0.06 INR
  THB: { code: 'THB', name: 'Thai Baht', symbol: '฿', rate: 0.42 }, // 1 THB = ~2.4 INR
  MYR: { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', rate: 0.053 }, // 1 MYR = ~19 INR
  IDR: { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', rate: 190 }, // 1 IDR = ~0.005 INR
  PHP: { code: 'PHP', name: 'Philippine Peso', symbol: '₱', rate: 0.67 }, // 1 PHP = ~1.5 INR
  VND: { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', rate: 290 }, // 1 VND = ~0.003 INR
  BDT: { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', rate: 1.4 }, // 1 BDT = ~0.7 INR
  PKR: { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', rate: 3.3 }, // 1 PKR = ~0.3 INR
  LKR: { code: 'LKR', name: 'Sri Lankan Rupee', symbol: '₨', rate: 3.6 }, // 1 LKR = ~0.28 INR
  NPR: { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨', rate: 1.6 }, // 1 NPR = ~0.62 INR
  ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R', rate: 0.22 }, // 1 ZAR = ~4.5 INR
  EGP: { code: 'EGP', name: 'Egyptian Pound', symbol: '£', rate: 0.58 }, // 1 EGP = ~1.7 INR
  NGN: { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', rate: 18 }, // 1 NGN = ~0.055 INR
  KES: { code: 'KES', name: 'Kenyan Shilling', symbol: 'Sh', rate: 1.6 }, // 1 KES = ~0.62 INR
  BRL: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', rate: 0.061 }, // 1 BRL = ~16 INR
  MXN: { code: 'MXN', name: 'Mexican Peso', symbol: '$', rate: 0.25 }, // 1 MXN = ~4 INR
  CLP: { code: 'CLP', name: 'Chilean Peso', symbol: '$', rate: 11.5 }, // 1 CLP = ~0.087 INR
  COP: { code: 'COP', name: 'Colombian Peso', symbol: '$', rate: 50 }, // 1 COP = ~0.02 INR
  PEN: { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', rate: 0.045 }, // 1 PEN = ~22 INR
  RUB: { code: 'RUB', name: 'Russian Ruble', symbol: '₽', rate: 1.1 }, // 1 RUB = ~0.9 INR
  TRY: { code: 'TRY', name: 'Turkish Lira', symbol: '₺', rate: 0.4 }, // 1 TRY = ~2.5 INR
  ILS: { code: 'ILS', name: 'Israeli Shekel', symbol: '₪', rate: 0.044 }, // 1 ILS = ~23 INR
};

export const countryToCurrency: Record<string, string> = {
  // Major markets
  'US': 'USD', 'United States': 'USD',
  'GB': 'GBP', 'United Kingdom': 'GBP', 'UK': 'GBP',
  'DE': 'EUR', 'Germany': 'EUR',
  'FR': 'EUR', 'France': 'EUR',
  'IT': 'EUR', 'Italy': 'EUR',
  'ES': 'EUR', 'Spain': 'EUR',
  'NL': 'EUR', 'Netherlands': 'EUR',
  'BE': 'EUR', 'Belgium': 'EUR',
  'AT': 'EUR', 'Austria': 'EUR',
  'PT': 'EUR', 'Portugal': 'EUR',
  'IE': 'EUR', 'Ireland': 'EUR',
  'FI': 'EUR', 'Finland': 'EUR',
  'GR': 'EUR', 'Greece': 'EUR',
  'CA': 'CAD', 'Canada': 'CAD',
  'AU': 'AUD', 'Australia': 'AUD',
  'SG': 'SGD', 'Singapore': 'SGD',
  'AE': 'AED', 'United Arab Emirates': 'AED', 'UAE': 'AED',
  'SA': 'SAR', 'Saudi Arabia': 'SAR',
  'JP': 'JPY', 'Japan': 'JPY',
  'CN': 'CNY', 'China': 'CNY',
  'KR': 'KRW', 'South Korea': 'KRW',
  'TH': 'THB', 'Thailand': 'THB',
  'MY': 'MYR', 'Malaysia': 'MYR',
  'ID': 'IDR', 'Indonesia': 'IDR',
  'PH': 'PHP', 'Philippines': 'PHP',
  'VN': 'VND', 'Vietnam': 'VND',
  'BD': 'BDT', 'Bangladesh': 'BDT',
  'PK': 'PKR', 'Pakistan': 'PKR',
  'LK': 'LKR', 'Sri Lanka': 'LKR',
  'NP': 'NPR', 'Nepal': 'NPR',
  'ZA': 'ZAR', 'South Africa': 'ZAR',
  'EG': 'EGP', 'Egypt': 'EGP',
  'NG': 'NGN', 'Nigeria': 'NGN',
  'KE': 'KES', 'Kenya': 'KES',
  'BR': 'BRL', 'Brazil': 'BRL',
  'MX': 'MXN', 'Mexico': 'MXN',
  'CL': 'CLP', 'Chile': 'CLP',
  'CO': 'COP', 'Colombia': 'COP',
  'PE': 'PEN', 'Peru': 'PEN',
  'RU': 'RUB', 'Russia': 'RUB',
  'TR': 'TRY', 'Turkey': 'TRY',
  'IL': 'ILS', 'Israel': 'ILS',
  // Default to INR for India and unlisted countries
  'IN': 'INR', 'India': 'INR',
};

// Base prices in INR
export const basePrices = {
  free: 0,
  paid: 99,
  pro: 199
};

export interface ConvertedPrice {
  amount: number;
  currency: CurrencyRate;
  formatted: string;
}

export function convertPrice(amountInINR: number, targetCurrencyCode: string): ConvertedPrice {
  const targetCurrency = currencyRates[targetCurrencyCode] || currencyRates.INR;
  const convertedAmount = Math.round(amountInINR * targetCurrency.rate);
  
  // For some currencies, we need minimum viable amounts
  let finalAmount = convertedAmount;
  if (targetCurrencyCode === 'USD' && convertedAmount < 1) finalAmount = 1;
  if (targetCurrencyCode === 'EUR' && convertedAmount < 1) finalAmount = 1;
  if (targetCurrencyCode === 'GBP' && convertedAmount < 1) finalAmount = 1;
  
  return {
    amount: finalAmount,
    currency: targetCurrency,
    formatted: `${targetCurrency.symbol}${finalAmount}`
  };
}

export function getConvertedPrices(userCountryCode: string) {
  const currencyCode = countryToCurrency[userCountryCode] || 'INR';
  
  return {
    free: convertPrice(basePrices.free, currencyCode),
    paid: convertPrice(basePrices.paid, currencyCode),
    pro: convertPrice(basePrices.pro, currencyCode),
    currencyCode
  };
}

export async function detectUserCountry(): Promise<string> {
  try {
    // Try multiple fallback methods for country detection
    
    // Method 1: Try timezone-based detection first (works offline)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      if (timezone.includes('Kolkata') || timezone.includes('Mumbai')) return 'IN';
      if (timezone.includes('New_York') || timezone.includes('Chicago')) return 'US';
      if (timezone.includes('London')) return 'GB';
      if (timezone.includes('Dubai')) return 'AE';
      if (timezone.includes('Singapore')) return 'SG';
    }

    // Method 2: Try locale-based detection
    const locale = navigator.language || navigator.languages?.[0];
    if (locale) {
      if (locale.includes('en-IN') || locale.includes('hi')) return 'IN';
      if (locale.includes('en-US')) return 'US';
      if (locale.includes('en-GB')) return 'GB';
    }

    // Method 3: Try external API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return data.country_code || 'IN';
    }
    
    throw new Error('API response not ok');
  } catch (error) {
    console.log('Country detection failed, using default (India)');
    return 'IN'; // Default to India
  }
}
