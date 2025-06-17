import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, TrendingUp, Lightbulb, Star } from "lucide-react";

const sampleData = [
  {
    id: 'location',
    title: 'Location Score',
    icon: MapPin,
    color: 'blue',
    score: 4.5,
    description: 'Excellent connectivity with metro station 2.1 km away, schools within 1 km radius.',
    details: [
      { label: 'Metro Station', value: '2.1 km' },
      { label: 'Hospital', value: '1.8 km' },
      { label: 'School', value: '0.9 km' },
    ],
  },
  {
    id: 'growth',
    title: 'Growth Potential',
    icon: TrendingUp,
    color: 'green',
    percentage: 18,
    description: 'Expected appreciation in 3 years',
    currentValue: 4500000,
    projectedValue: 5310000,
  },
  {
    id: 'ai',
    title: 'AI Recommendations',
    icon: Lightbulb,
    color: 'purple',
    recommendations: [
      {
        title: 'Better Alternative',
        description: 'Plot in Sector 21, 3 km away',
        highlight: '12% lower price, same amenities',
      },
      {
        title: 'Investment Tip',
        description: 'New metro line planned for 2025 will boost property values by 25%',
      },
    ],
  },
];

export default function SampleAnalysis() {
  const renderStars = (score: number) => {
    const fullStars = Math.floor(score);
    const hasHalfStar = score % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center mb-4">
        <div className="flex text-yellow-400 text-2xl mr-3">
          {[...Array(fullStars)].map((_, i) => (
            <Star key={i} className="h-6 w-6 fill-current" />
          ))}
          {hasHalfStar && <Star className="h-6 w-6 fill-current opacity-50" />}
          {[...Array(emptyStars)].map((_, i) => (
            <Star key={i} className="h-6 w-6 text-gray-300" />
          ))}
        </div>
        <span className="text-xl font-semibold text-gray-900">{score}/5</span>
      </div>
    );
  };

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">See What You'll Get</h2>
          <p className="text-xl text-gray-600">Sample analysis reports to help you understand our insights</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {sampleData.map((item) => {
            const IconComponent = item.icon;
            const bgColor = item.color === 'blue' ? 'from-blue-50 to-blue-100' : 
                           item.color === 'green' ? 'from-green-50 to-green-100' : 
                           'from-purple-50 to-purple-100';
            const iconBg = item.color === 'blue' ? '#3B82F6' : 
                          item.color === 'green' ? '#10B981' : 
                          '#8B5CF6';
            const borderColor = item.color === 'blue' ? 'border-blue-200' : 
                               item.color === 'green' ? 'border-green-200' : 
                               'border-purple-200';

            return (
              <Card key={item.id} className={`bg-gradient-to-br ${bgColor} ${borderColor} border airbnb-shadow hover:shadow-lg transition-shadow duration-300`}>
                <CardHeader>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                       style={{ backgroundColor: iconBg }}>
                    <IconComponent className="text-white" size={32} />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900 mb-4">{item.title}</CardTitle>
                </CardHeader>
                
                <CardContent>
                  {item.id === 'location' && (
                    <>
                      {renderStars(item.score)}
                      <p className="text-gray-700 mb-4">{item.description}</p>
                      <div className="space-y-2">
                        {item.details?.map((detail, index) => (
                          <div key={index} className="flex justify-between">
                            <span className="text-gray-600">{detail.label}</span>
                            <span className="font-semibold text-gray-900">{detail.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {item.id === 'growth' && (
                    <>
                      <div className="text-center mb-4">
                        <span className="text-4xl font-bold text-green-600">+{item.percentage}%</span>
                        <p className="text-gray-600">{item.description}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600">Current Value</span>
                          <span className="font-semibold">₹{item.currentValue?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Projected Value</span>
                          <span className="font-semibold text-green-600">₹{item.projectedValue?.toLocaleString()}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">Based on nearby developments and market trends</p>
                    </>
                  )}

                  {item.id === 'ai' && (
                    <div className="space-y-4">
                      {item.recommendations?.map((rec, index) => (
                        <div key={index} className="bg-white rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900 mb-2">{rec.title}</h4>
                          <p className="text-sm text-gray-600 mb-1">{rec.description}</p>
                          {rec.highlight && (
                            <p className="text-sm font-semibold text-purple-600">{rec.highlight}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
