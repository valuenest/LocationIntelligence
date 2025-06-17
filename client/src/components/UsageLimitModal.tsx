import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Zap, Star, Crown } from "lucide-react";

interface UsageLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (plan: string) => void;
  freeUsageCount: number;
}

export default function UsageLimitModal({ isOpen, onClose, onSelectPlan, freeUsageCount }: UsageLimitModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl border-0 p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-red-50 to-orange-50 p-8">
          <DialogHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <Zap className="w-8 h-8 text-red-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Free Analysis Limit Reached
            </DialogTitle>
            <p className="text-gray-600 text-lg">
              You've used all {freeUsageCount} free analyses today. Upgrade to continue with unlimited property insights.
            </p>
          </DialogHeader>

          <div className="mt-8 grid md:grid-cols-2 gap-6">
            {/* Paid Plan */}
            <div className="bg-white rounded-xl p-6 border-2 border-blue-200 relative">
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 hover:bg-blue-600">
                Most Popular
              </Badge>
              <div className="text-center mb-6">
                <Star className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h3 className="text-xl font-bold text-gray-900">Paid Report</h3>
                <div className="text-3xl font-bold text-blue-600">₹99</div>
                <p className="text-gray-500">Per analysis</p>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                  Complete location analysis
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                  Growth potential insights
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                  Nearby amenities mapping
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                  Distance calculations
                </li>
              </ul>
              <Button 
                onClick={() => onSelectPlan('paid')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold"
              >
                Get Paid Analysis
              </Button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-xl p-6 border-2 border-purple-200 relative">
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-600 hover:bg-purple-600">
                Premium
              </Badge>
              <div className="text-center mb-6">
                <Crown className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <h3 className="text-xl font-bold text-gray-900">Pro Report</h3>
                <div className="text-3xl font-bold text-purple-600">₹199</div>
                <p className="text-gray-500">Per analysis</p>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-purple-600 rounded-full mr-3"></div>
                  Everything in Paid
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-purple-600 rounded-full mr-3"></div>
                  AI investment recommendations
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-purple-600 rounded-full mr-3"></div>
                  Market timing insights
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-purple-600 rounded-full mr-3"></div>
                  Property-specific analysis
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-purple-600 rounded-full mr-3"></div>
                  Downloadable PDF report
                </li>
              </ul>
              <Button 
                onClick={() => onSelectPlan('pro')}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold"
              >
                Get Pro Analysis
              </Button>
            </div>
          </div>

          <div className="text-center mt-6">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}