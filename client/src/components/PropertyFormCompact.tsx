import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currencyRates, countryToCurrency, detectUserCountry } from "@/lib/currencyConverter";

interface PropertyFormData {
  amount: number;
  propertyType: string;
  currency: string;
  country: string;
  propertySize: number;
  sizeUnit: string;
  propertyAge: string;
  bedrooms: number;
  furnished: string;
  floor: string;
  parkingSpaces: number;
}

interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

interface PropertyFormProps {
  onSubmit: (data: PropertyFormData) => void;
  selectedLocation?: LocationData | null;
}

interface Country {
  code: string;
  name: string;
  currency: string;
  symbol: string;
}

// Generate countries list from currency data
const countries: Country[] = Object.entries(countryToCurrency).map(([countryCode, currencyCode]) => {
  const currency = currencyRates[currencyCode];
  return {
    code: countryCode,
    name: countryCode === 'US' ? 'United States' : 
          countryCode === 'GB' ? 'United Kingdom' :
          countryCode === 'AE' ? 'UAE' :
          countryCode === 'DE' ? 'Germany' :
          countryCode === 'FR' ? 'France' :
          countryCode === 'IN' ? 'India' :
          countryCode === 'CA' ? 'Canada' :
          countryCode === 'AU' ? 'Australia' :
          countryCode === 'SG' ? 'Singapore' :
          countryCode === 'JP' ? 'Japan' :
          countryCode === 'CN' ? 'China' :
          countryCode === 'KR' ? 'South Korea' :
          countryCode === 'TH' ? 'Thailand' :
          countryCode === 'MY' ? 'Malaysia' :
          countryCode === 'ID' ? 'Indonesia' :
          countryCode === 'PH' ? 'Philippines' :
          countryCode === 'VN' ? 'Vietnam' :
          countryCode === 'BD' ? 'Bangladesh' :
          countryCode === 'PK' ? 'Pakistan' :
          countryCode === 'LK' ? 'Sri Lanka' :
          countryCode === 'NP' ? 'Nepal' :
          countryCode === 'ZA' ? 'South Africa' :
          countryCode === 'EG' ? 'Egypt' :
          countryCode === 'NG' ? 'Nigeria' :
          countryCode === 'KE' ? 'Kenya' :
          countryCode === 'BR' ? 'Brazil' :
          countryCode === 'MX' ? 'Mexico' :
          countryCode === 'CL' ? 'Chile' :
          countryCode === 'CO' ? 'Colombia' :
          countryCode === 'PE' ? 'Peru' :
          countryCode === 'RU' ? 'Russia' :
          countryCode === 'TR' ? 'Turkey' :
          countryCode === 'IL' ? 'Israel' :
          countryCode === 'SA' ? 'Saudi Arabia' :
          countryCode,
    currency: currencyCode,
    symbol: currency.symbol
  };
}).filter((country, index, self) => 
  // Remove duplicates and prioritize common countries
  index === self.findIndex(c => c.code === country.code)
).sort((a, b) => {
  // Prioritize common countries
  const priority = ['IN', 'US', 'GB', 'CA', 'AU', 'SG', 'AE', 'DE', 'FR', 'JP'];
  const aPriority = priority.indexOf(a.code);
  const bPriority = priority.indexOf(b.code);

  if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
  if (aPriority !== -1) return -1;
  if (bPriority !== -1) return 1;
  return a.name.localeCompare(b.name);
}).slice(0, 30); // Limit to top 30 countries

export default function PropertyFormCompact({ onSubmit, selectedLocation }: PropertyFormProps) {
  const [amount, setAmount] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [propertySize, setPropertySize] = useState('');
  const [sizeUnit, setSizeUnit] = useState('sqft');
  const [propertyAge, setPropertyAge] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [furnished, setFurnished] = useState('');
  const [floor, setFloor] = useState('');
  const [parkingSpaces, setParkingSpaces] = useState('0');

  const handleCountryChange = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    if (country) {
      setSelectedCountry(country);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLocation) {
      alert('Please select a location first');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!propertyType) {
      alert('Please select a property type');
      return;
    }

    const formData = {
      amount: numericAmount,
      propertyType,
      currency: selectedCountry.currency,
      country: selectedCountry.name,
      propertySize: parseFloat(propertySize) || 1000,
      sizeUnit,
      propertyAge: propertyAge || 'not-applicable',
      bedrooms: parseInt(bedrooms) || 0,
      furnished: furnished || 'not-applicable',
      floor: floor || 'not-applicable',
      parkingSpaces: parseInt(parkingSpaces) || 0,
    };

    onSubmit(formData);
  };

  // Auto-detect country based on user's location
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const countryCode = await detectUserCountry();
        const detectedCountry = countries.find(c => c.code === countryCode);
        if (detectedCountry) {
          setSelectedCountry(detectedCountry);
        }
      } catch (error) {
        // Fallback to India if detection fails
        console.log('Country detection failed, using default');
      }
    };

    detectCountry();
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Budget & Country Row */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label htmlFor="amount" className="text-base font-medium text-gray-700 mb-2 block">
            Budget ({selectedCountry.symbol})
          </Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-base font-medium">
              {selectedCountry.symbol}
            </span>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent"
              placeholder="Enter amount"
              required
            />
          </div>
        </div>
        <div>
          <Label className="text-base font-medium text-gray-700 mb-2 block">
            Country
          </Label>
          <Select value={selectedCountry.code} onValueChange={handleCountryChange}>
            <SelectTrigger className="w-full py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Property Type & Size Row */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label htmlFor="propertyType" className="text-base font-medium text-gray-700 mb-2 block">
            Property Type
          </Label>
          <Select value={propertyType} onValueChange={setPropertyType} required>
            <SelectTrigger className="w-full py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apartment">Apartment</SelectItem>
              <SelectItem value="house">House</SelectItem>
              <SelectItem value="villa">Villa</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="land">Land/Plot</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="propertySize" className="text-base font-medium text-gray-700 mb-2 block">
            Size ({sizeUnit})
          </Label>
          <div className="flex gap-3">
            <Input
              id="propertySize"
              type="number"
              value={propertySize}
              onChange={(e) => setPropertySize(e.target.value)}
              className="flex-1 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent"
              placeholder="1000"
            />
            <Select value={sizeUnit} onValueChange={setSizeUnit}>
              <SelectTrigger className="w-24 py-3 text-base border border-gray-300 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sqft">sqft</SelectItem>
                <SelectItem value="sqm">sqm</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Conditional Fields for Non-Land Properties */}
      {propertyType && propertyType !== 'land' && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <Label htmlFor="bedrooms" className="text-base font-medium text-gray-700 mb-2 block">
              Bedrooms
            </Label>
            <Select value={bedrooms} onValueChange={setBedrooms}>
              <SelectTrigger className="w-full py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Studio</SelectItem>
                <SelectItem value="1">1 BHK</SelectItem>
                <SelectItem value="2">2 BHK</SelectItem>
                <SelectItem value="3">3 BHK</SelectItem>
                <SelectItem value="4">4+ BHK</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="propertyAge" className="text-base font-medium text-gray-700 mb-2 block">
              Property Age
            </Label>
            <Select value={propertyAge} onValueChange={setPropertyAge}>
              <SelectTrigger className="w-full py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Under Construction</SelectItem>
                <SelectItem value="0-5">0-5 Years</SelectItem>
                <SelectItem value="5-10">5-10 Years</SelectItem>
                <SelectItem value="10-20">10-20 Years</SelectItem>
                <SelectItem value="20+">20+ Years</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-4">
        <Button
          type="submit"
          className="w-full bg-[#FF5A5F] hover:bg-[#e54852] text-white py-4 rounded-lg font-semibold text-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
        >
          Analyze Property Investment
        </Button>
      </div>
    </form>
  );
}
// Added currency conversion and auto-detection of country based on user location.