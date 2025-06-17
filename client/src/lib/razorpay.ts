interface RazorpayOptions {
  orderId: string;
  amount: number;
  currency: string;
  key: string;
  analysisId: number;
  onSuccess: (sessionId: string) => void;
  onError: (error: string) => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const initiateRazorpayPayment = async (options: RazorpayOptions) => {
  if (!window.Razorpay) {
    throw new Error('Razorpay SDK not loaded');
  }

  const razorpayOptions = {
    key: options.key,
    amount: options.amount,
    currency: options.currency,
    name: 'PlotterAI',
    description: 'Property Investment Analysis',
    order_id: options.orderId,
    theme: {
      color: '#FF5A5F',
    },
    modal: {
      ondismiss: () => {
        options.onError('Payment cancelled by user');
      },
    },
    handler: async (response: any) => {
      try {
        // Verify payment on server
        const verifyResponse = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
            analysisId: options.analysisId,
          }),
        });

        const result = await verifyResponse.json();
        
        if (result.success) {
          options.onSuccess(result.sessionId);
        } else {
          options.onError(result.error || 'Payment verification failed');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        options.onError('Payment verification failed');
      }
    },
  };

  const razorpay = new window.Razorpay(razorpayOptions);
  razorpay.open();
};
