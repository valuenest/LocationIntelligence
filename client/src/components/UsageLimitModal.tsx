import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Crown } from "lucide-react";

interface UsageLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (plan: string) => void;
  freeUsageCount: number;
}

export default function UsageLimitModal({ isOpen, onClose, onSelectPlan, freeUsageCount }: UsageLimitModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <DialogTitle className="text-xl font-bold text-gray-900">
            Daily Free Limit Reached
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          <p className="text-gray-600">
            You've used all {freeUsageCount} free analyses for today. Upgrade to continue analyzing properties.
          </p>
          
          <div className="space-y-3">
            <Button
              onClick={() => {
                onSelectPlan('paid');
                onClose();
              }}
              className="w-full bg-[#FF5A5F] hover:bg-[#e54852] text-white"
            >
              Unlock Full Analysis - ₹99
            </Button>
            
            <Button
              onClick={() => {
                onSelectPlan('pro');
                onClose();
              }}
              className="w-full bg-[#FC642D] hover:bg-[#e55a29] text-white"
            >
              <Crown className="w-4 h-4 mr-2" />
              Get AI Insights - ₹199
            </Button>
            
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full"
            >
              Try Again Tomorrow
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}