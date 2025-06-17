import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Shield, Clock } from "lucide-react";
import { initiateRazorpayPayment } from "@/lib/razorpay";

interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

interface PropertyFormData {
  amount: number;
  propertyType: string;
  currency: string;
  country: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: string | null;
  location: LocationData | null;
  propertyData: PropertyFormData | null;
}

const planDetails = {
  paid: {
    name: 'Paid Plan',
    price: 99,
    description: 'Complete Analysis',
    features: [
      'Full investment analysis',
      'Growth prediction percentage',
      'Nearby developments',
      'Street View imagery',
      'Unlimited usage',
    ],
  },
  pro: {
    name: 'Pro Plan',
    price: 199,
    description: 'AI-Powered Insights',
    features: [
      'Everything in Paid Plan',
      'AI investment recommendations',
      'Top 3 nearby opportunities',
      'Detailed reasoning report',
      'Downloadable PDF report',
    ],
  },
};

export default function PaymentModal({ isOpen, onClose, selectedPlan, location, propertyData }: PaymentModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!selectedPlan || !planDetails[selectedPlan as keyof typeof planDetails]) {
    return null;
  }

  const plan = planDetails[selectedPlan as keyof typeof planDetails];

  const handlePayment = async () => {
    if (!location || !propertyData) {
      alert('Please select a location and enter property details first');
      return;
    }

    setIsLoading(true);
    
    try {
      // First, create an analysis request to get the analysis ID
      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location,
          amount: propertyData.amount,
          propertyType: propertyData.propertyType,
          planType: selectedPlan,
        }),
      });

      const analysisResult = await analysisResponse.json();
      if (!analysisResult.success) {
        throw new Error(analysisResult.error || 'Failed to create analysis');
      }

      // Create payment order
      const orderResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: plan.price,
          planType: selectedPlan,
          analysisId: analysisResult.analysisId,
        }),
      });

      const orderResult = await orderResponse.json();
      if (!orderResult.success) {
        throw new Error(orderResult.error || 'Failed to create payment order');
      }

      // Initiate Razorpay payment
      await initiateRazorpayPayment({
        orderId: orderResult.orderId,
        amount: orderResult.amount,
        currency: orderResult.currency,
        key: orderResult.key,
        analysisId: analysisResult.analysisId,
        onSuccess: (sessionId: string) => {
          onClose();
          window.location.href = `/results/${sessionId}`;
        },
        onError: (error: string) => {
          alert(`Payment failed: ${error}`);
        },
      });

    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Upgrade to {plan.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Plan Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-gray-600">{plan.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#FF5A5F]">₹{plan.price}</div>
                  <div className="text-sm text-gray-500">one-time</div>
                </div>
              </div>
              
              <Separator className="mb-4" />
              
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">What's included:</h4>
                <ul className="space-y-1">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-center">
                      <div className="w-1.5 h-1.5 bg-[#FF5A5F] rounded-full mr-2"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Property Summary */}
          {location && propertyData && (
            <Card className="bg-gray-50">
              <CardContent className="pt-6">
                <h4 className="font-medium text-gray-900 mb-3">Property Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Location:</span>
                    <span className="text-gray-900 text-right max-w-xs truncate">
                      {location.address}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Investment Amount:</span>
                    <span className="text-gray-900">₹{propertyData.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Property Type:</span>
                    <span className="text-gray-900 capitalize">
                      {propertyData.propertyType.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Features */}
          <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center">
              <Shield className="h-4 w-4 mr-1" />
              <span>Secure Payment</span>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>Instant Access</span>
            </div>
            <div className="flex items-center">
              <CreditCard className="h-4 w-4 mr-1" />
              <span>Razorpay Protected</span>
            </div>
          </div>

          {/* Payment Button */}
          <Button
            onClick={handlePayment}
            disabled={isLoading}
            className="w-full bg-[#FF5A5F] hover:bg-[#e54852] text-white py-3 text-lg font-semibold"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              `Pay ₹${plan.price} & Get Analysis`
            )}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            By proceeding, you agree to our Terms of Service and Privacy Policy. 
            Payment is processed securely through Razorpay.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
