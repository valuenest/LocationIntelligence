import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, 
  TrendingUp, 
  Star, 
  Eye,
  ArrowLeft,
  Trash2,
  Calendar,
  Home as HomeIcon,
  Download
} from "lucide-react";
import { generatePDF } from "@/lib/pdfGenerator";
import { getAnalysisHistory, removeAnalysisFromHistory, clearAnalysisHistory } from "@/lib/historyStorage";

interface AnalysisHistory {
  sessionId: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  amount: number;
  propertyType: string;
  planType: string;
  analysisData: any;
  createdAt: string;
  id: number;
}

export default function History() {
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [browserKey, setBrowserKey] = useState<string>('');

  // Generate browser fingerprint without API calls
  useEffect(() => {
    const generateBrowserKey = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx!.textBaseline = 'top';
      ctx!.font = '14px Arial';
      ctx!.fillText('Browser fingerprint', 2, 2);
      
      const fingerprint = canvas.toDataURL() + 
                         navigator.userAgent + 
                         navigator.language + 
                         screen.width + 
                         screen.height + 
                         new Date().getTimezoneOffset();
      
      return btoa(fingerprint).slice(0, 16); // Short unique identifier
    };

    const key = generateBrowserKey();
    setBrowserKey(key);
    
    console.log('Loading history for browser:', key);
    const historyData = getAnalysisHistory(key);
    console.log('Retrieved history data:', historyData);
    setHistory(historyData);
  }, []);

  const clearHistory = () => {
    if (browserKey) {
      clearAnalysisHistory(browserKey);
      setHistory([]);
    }
  };

  const removeHistoryItem = (sessionId: string) => {
    if (browserKey) {
      removeAnalysisFromHistory(browserKey, sessionId);
      const updatedHistory = getAnalysisHistory(browserKey);
      setHistory(updatedHistory);
    }
  };

  const renderStars = (score: number) => {
    const fullStars = Math.floor(score);
    const hasHalfStar = score % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        ))}
        {hasHalfStar && <Star className="h-4 w-4 fill-yellow-400/50 text-yellow-400" />}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={i} className="h-4 w-4 text-gray-300" />
        ))}
        <span className="ml-2 text-sm text-gray-600">({score.toFixed(1)})</span>
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownloadPDF = (item: AnalysisHistory) => {
    generatePDF(item);
  };

  if (!browserKey) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5A5F] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analysis History</h1>
        {history.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearHistory}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>
        {history.length === 0 ? (
          <div className="text-center py-16">
            <HomeIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-medium text-gray-900 mb-2">No Analysis History</h2>
            <p className="text-gray-600 mb-8">
              You haven't performed any property analysis yet. Start by analyzing a location to build your history.
            </p>
            <Link href="/">
              <Button className="bg-[#FF5A5F] hover:bg-[#e54852]">
                <MapPin className="h-4 w-4 mr-2" />
                Start Analysis
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-gray-600">
                Showing {history.length} analysis report{history.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {history.map((item) => (
                <Card key={item.sessionId} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-2 mb-2">
                          {item.location.address}
                        </CardTitle>
                        <div className="flex items-center text-sm text-gray-500 mb-2">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(item.createdAt)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={item.planType === 'free' ? 'secondary' : 'default'}
                            className={item.planType === 'free' ? '' : 'bg-[#FF5A5F] hover:bg-[#e54852]'}
                          >
                            {item.planType === 'free' ? 'Free' : item.planType === 'paid' ? 'Enhanced' : 'Pro'}
                          </Badge>
                          <Badge variant="outline">
                            {item.propertyType}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHistoryItem(item.sessionId)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {/* Location Score */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Location Score</span>
                          <span className="text-sm text-gray-900">
                            {item.analysisData?.locationScore || 0}/5
                          </span>
                        </div>
                        {renderStars(item.analysisData?.locationScore || 0)}
                      </div>

                      {/* Investment Viability */}
                      {item.analysisData?.investmentViability && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">Investment Score</span>
                            <span className="text-sm text-gray-900">
                              {item.analysisData.investmentViability}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-[#FF5A5F] h-2 rounded-full transition-all"
                              style={{ width: `${item.analysisData.investmentViability}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Property Amount */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Budget</span>
                        <span className="text-sm text-gray-900">
                          ₹{(item.amount / 100000).toFixed(1)}L
                        </span>
                      </div>

                      <Separator />

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Link href={`/results/${item.sessionId}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <Eye className="h-4 w-4 mr-2" />
                            View Report
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDownloadPDF(item)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}