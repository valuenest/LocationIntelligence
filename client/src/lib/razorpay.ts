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
    console.error('Razorpay SDK not loaded');
    throw new Error('Razorpay SDK not loaded');
  }

  console.log('Initiating Razorpay payment with options:', {
    key: options.key,
    amount: options.amount,
    currency: options.currency,
    orderId: options.orderId,
    analysisId: options.analysisId
  });

  const razorpayOptions = {
    key: options.key,
    amount: options.amount,
    currency: options.currency,
    name: 'Value Next AI',
    description: 'Property Investment Analysis Report',
    order_id: options.orderId,
    theme: {
      color: '#FF5A5F',
    },
    modal: {
      ondismiss: () => {
        console.log('Payment modal dismissed by user');
        options.onError('Payment cancelled by user');
      },
    },
    handler: async (response: any) => {
      console.log('Payment successful, response:', response);
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
        console.log('Payment verification result:', result);
        
        if (result.success) {
          options.onSuccess(result.sessionId);
        } else {
          console.error('Payment verification failed:', result.error);
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
