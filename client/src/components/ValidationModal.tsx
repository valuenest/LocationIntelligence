import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, XCircle, CheckCircle, Lightbulb } from "lucide-react";

interface ValidationResult {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
}

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  validation: ValidationResult | null;
  isLoading: boolean;
}

export default function ValidationModal({ 
  isOpen, 
  onClose, 
  onProceed, 
  validation, 
  isLoading 
}: ValidationModalProps) {
  if (!validation) return null;

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return <XCircle className="h-6 w-6 text-red-500" />;
      case 'medium': return <AlertTriangle className="h-6 w-6 text-orange-500" />;
      default: return <CheckCircle className="h-6 w-6 text-green-500" />;
    }
  };

  const canProceed = validation.isValid || validation.riskLevel !== 'high';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getRiskIcon(validation.riskLevel)}
            Input Validation Check
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Quick verification of your inputs before generating the detailed analysis report
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Risk Level Overview */}
          <Card className={`border-2 ${getRiskColor(validation.riskLevel)}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">
                  {validation.riskLevel === 'high' ? 'High Risk Detected' : 
                   validation.riskLevel === 'medium' ? 'Medium Risk Analysis' : 
                   'Low Risk - Good to Go'}
                </h3>
                <span className="text-sm font-medium">
                  {validation.confidence}% Confidence
                </span>
              </div>
              <p className="text-sm">
                {validation.riskLevel === 'high' ? 
                  'Property type and location compatibility issues detected.' :
                  validation.riskLevel === 'medium' ?
                  'Some property type or location concerns identified.' :
                  'Property type and location appear compatible for analysis.'}
              </p>
            </CardContent>
          </Card>

          {/* Issues Section */}
          {validation.issues.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Issues Detected ({validation.issues.length})
              </h4>
              <div className="space-y-2">
                {validation.issues.map((issue, index) => (
                  <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">{issue}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note for issues */}
          {validation.issues.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                <strong>Location Issue:</strong> The location you entered appears to be unbuildable or restricted (ocean, river, forest, government area). 
                Please select a different location suitable for property development.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Go Back & Edit
            </Button>
            
            {canProceed && (
              <Button
                onClick={onProceed}
                className={`flex-1 ${
                  validation.riskLevel === 'high' ? 'bg-red-600 hover:bg-red-700' :
                  validation.riskLevel === 'medium' ? 'bg-orange-600 hover:bg-orange-700' :
                  'bg-green-600 hover:bg-green-700'
                }`}
                disabled={isLoading}
              >
                {isLoading ? 'Generating Analysis Report...' : 
                 validation.riskLevel === 'high' ? 'Continue to Analysis (Not Recommended)' :
                 validation.riskLevel === 'medium' ? 'Continue to Analysis' :
                 'Continue to Analysis'}
              </Button>
            )}
          </div>

          {/* Disclaimer for high risk */}
          {validation.riskLevel === 'high' && canProceed && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                <strong>Disclaimer:</strong> Proceeding with high-risk inputs may result in 
                inaccurate analysis results. We recommend addressing the issues above for 
                better investment insights.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}