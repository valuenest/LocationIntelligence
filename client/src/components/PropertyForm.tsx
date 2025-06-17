import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { IndianRupee, Home, Globe } from "lucide-react";

interface PropertyFormData {
  amount: number;
  propertyType: string;
  currency: string;
  country: string;
}

interface PropertyFormProps {
  onSubmit: (data: PropertyFormData) => void;
}

interface Country {
  code: string;
  name: string;
  currency: string;
  symbol: string;
}

const countries: Country[] = [
  { code: 'IN', name: 'India', currency: 'INR', symbol: '₹' },
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£' },
  { code: 'EU', name: 'European Union', currency: 'EUR', symbol: '€' },
  { code: 'CA', name: 'Canada', currency: 'CAD', symbol: 'C$' },
  { code: 'AU', name: 'Australia', currency: 'AUD', symbol: 'A$' },
  { code: 'JP', name: 'Japan', currency: 'JPY', symbol: '¥' },
  { code: 'CN', name: 'China', currency: 'CNY', symbol: '¥' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', symbol: 'S$' },
  { code: 'AE', name: 'UAE', currency: 'AED', symbol: 'د.إ' },
];

export default function PropertyForm({ onSubmit }: PropertyFormProps) {
  const [amount, setAmount] = useState<string>('');
  const [propertyType, setPropertyType] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]); // Default to India

  // Auto-detect country based on user's location
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const countryCode = data.country_code;
        
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

  const handleCountryChange = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    if (country) {
      setSelectedCountry(country);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !propertyType) {
      alert('Please fill in all fields');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    onSubmit({
      amount: numericAmount,
      propertyType,
      currency: selectedCountry.currency,
      country: selectedCountry.name,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Country/Currency Selection */}
      <div>
        <Label htmlFor="country" className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <Globe className="text-[#FC642D] mr-2" />
          Country & Currency
        </Label>
        <Select value={selectedCountry.code} onValueChange={handleCountryChange}>
          <SelectTrigger id="country" className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FC642D] focus:border-transparent">
            <SelectValue placeholder="Select your country..." />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <div className="flex items-center justify-between w-full">
                  <span>{country.name}</span>
                  <span className="ml-2 text-gray-500">({country.symbol} {country.currency})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Amount Input */}
      <div>
        <Label htmlFor="amount" className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <IndianRupee className="text-[#FC642D] mr-2" />
          Amount You're Paying
        </Label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">
            {selectedCountry.symbol}
          </span>
          <Input
            id="amount"
            type="number"
            placeholder={`Enter amount in ${selectedCountry.currency}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FC642D] focus:border-transparent"
            min="0"
            step="1000"
          />
        </div>
      </div>

      {/* Property Type */}
      <div>
        <Label htmlFor="propertyType" className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <Home className="text-[#00A699] mr-2" />
          Property Type
        </Label>
        <Select value={propertyType} onValueChange={setPropertyType}>
          <SelectTrigger id="propertyType" className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00A699] focus:border-transparent">
            <SelectValue placeholder="Select property type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plot">Residential Plot</SelectItem>
            <SelectItem value="farmland">Farm Land</SelectItem>
            <SelectItem value="house">Independent House</SelectItem>
            <SelectItem value="apartment">Apartment</SelectItem>
            <SelectItem value="commercial">Commercial Space</SelectItem>
            <SelectItem value="warehouse">Warehouse</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full bg-[#FF5A5F] hover:bg-[#e54852] text-white py-4 rounded-xl font-semibold text-lg transition-colors duration-200"
      >
        Save Property Details
      </Button>
    </form>
  );
}
