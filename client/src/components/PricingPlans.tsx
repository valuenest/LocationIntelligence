import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, TrendingUp, Brain, Check, X } from "lucide-react";

interface PricingPlansProps {
  onPlanSelect: (plan: string) => void;
  canUseFree: boolean;
  freeUsageCount: number;
  isFormValid: boolean;
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Basic Location Info',
    icon: Eye,
    color: 'gray',
    features: [
      { text: 'Location verification', included: true },
      { text: 'Complete address details', included: true },
      { text: 'Distance to 3 key landmarks', included: true },
      { text: 'Investment analysis', included: false },
      { text: 'Growth predictions', included: false },
      { text: 'AI recommendations', included: false },
    ],
    limitation: '3 uses per day',
  },
  {
    id: 'paid',
    name: 'Paid',
    price: 99,
    description: 'Complete Analysis',
    icon: TrendingUp,
    color: 'red',
    popular: true,
    features: [
      { text: 'Everything in Free', included: true },
      { text: 'Full investment analysis', included: true },
      { text: 'Growth prediction %', included: true },
      { text: 'Nearby developments', included: true },
      { text: 'Street View imagery', included: true },
      { text: 'AI recommendations', included: false },
    ],
    limitation: 'Unlimited usage',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 199,
    description: 'AI-Powered Insights',
    icon: Brain,
    color: 'orange',
    features: [
      { text: 'Everything in Paid', included: true },
      { text: 'AI investment recommendations', included: true },
      { text: 'Top 3 nearby opportunities', included: true },
      { text: 'Detailed reasoning report', included: true },
      { text: 'Downloadable PDF report', included: true },
    ],
    limitation: 'Unlimited + AI insights',
  },
];

export default function PricingPlans({ onPlanSelect, canUseFree, freeUsageCount, isFormValid }: PricingPlansProps) {
  const getButtonText = (plan: typeof plans[0]) => {
    if (plan.id === 'free') {
      return canUseFree ? 'Get Free Report' : `Free Limit Reached (${freeUsageCount}/3)`;
    }
    return `${plan.name === 'Paid' ? 'Unlock Full Report' : 'Get Investment Suggestions'} - ₹${plan.price}`;
  };

  const getButtonClass = (plan: typeof plans[0]) => {
    const baseClass = "w-full py-4 rounded-xl font-semibold transition-colors duration-200";

    if (plan.id === 'free') {
      return canUseFree && isFormValid 
        ? `${baseClass} bg-gray-100 text-gray-700 hover:bg-gray-200` 
        : `${baseClass} bg-gray-100 text-gray-400 cursor-not-allowed`;
    }

    if (plan.color === 'red') {
      return isFormValid 
        ? `${baseClass} bg-[#FF5A5F] text-white hover:bg-[#e54852]`
        : `${baseClass} bg-gray-300 text-gray-500 cursor-not-allowed`;
    }

    if (plan.color === 'orange') {
      return isFormValid 
        ? `${baseClass} bg-[#FC642D] text-white hover:bg-[#e55a29]`
        : `${baseClass} bg-gray-300 text-gray-500 cursor-not-allowed`;
    }

    return `${baseClass} bg-gray-100 text-gray-700 hover:bg-gray-200`;
  };

  const isButtonDisabled = (plan: typeof plans[0]) => {
    if (!isFormValid) return true;
    if (plan.id === 'free' && !canUseFree) return true;
    return false;
  };

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const IconComponent = plan.icon;
            const iconColor = plan.color === 'red' ? '#FF5A5F' : plan.color === 'orange' ? '#FC642D' : '#6B7280';

            return (
              <Card 
                key={plan.id}
                className={`relative hover:shadow-xl transition-shadow duration-300 ${
                  plan.popular ? 'border-2 border-[#FF5A5F] airbnb-shadow-lg' : 'border border-gray-200 airbnb-shadow'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-[#FF5A5F] text-white px-6 py-2 rounded-full text-sm font-semibold">
                      POPULAR
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                       style={{ backgroundColor: `${iconColor}20` }}>
                    <IconComponent size={32} color={iconColor} />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</CardTitle>
                  <p className="text-4xl font-bold" style={{ color: iconColor }}>₹{plan.price}</p>
                  <p className="text-gray-600 mt-2">{plan.description}</p>
                </CardHeader>

                <CardContent className="pt-4">
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center">
                        {feature.included ? (
                          <Check className="text-green-500 mr-3 h-5 w-5 flex-shrink-0" />
                        ) : (
                          <X className="text-gray-400 mr-3 h-5 w-5 flex-shrink-0" />
                        )}
                        <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => onPlanSelect(plan.id)}
                    disabled={isButtonDisabled(plan)}
                    className={getButtonClass(plan)}
                  >
                    {getButtonText(plan)}
                  </Button>

                  <p className="text-sm text-gray-500 text-center mt-4">{plan.limitation}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}