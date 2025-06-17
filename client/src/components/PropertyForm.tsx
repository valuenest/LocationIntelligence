import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { IndianRupee, Home } from "lucide-react";

interface PropertyFormData {
  amount: number;
  propertyType: string;
}

interface PropertyFormProps {
  onSubmit: (data: PropertyFormData) => void;
}

export default function PropertyForm({ onSubmit }: PropertyFormProps) {
  const [amount, setAmount] = useState<string>('');
  const [propertyType, setPropertyType] = useState<string>('');

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
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Amount Input */}
      <div>
        <Label htmlFor="amount" className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <IndianRupee className="text-[#FC642D] mr-2" />
          Amount You're Paying
        </Label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">₹</span>
          <Input
            id="amount"
            type="number"
            placeholder="Enter amount in rupees"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-10 pr-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FC642D] focus:border-transparent"
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
