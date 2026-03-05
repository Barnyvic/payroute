import { PaymentForm } from '../components/PaymentForm';

export function NewPayment() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Payment</h1>
        <p className="text-sm text-gray-500 mt-1">
          Send a cross-border payment. Funds are debited immediately; settlement is confirmed via provider webhook.
        </p>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <PaymentForm />
      </div>
    </div>
  );
}
