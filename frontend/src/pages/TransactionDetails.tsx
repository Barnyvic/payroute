import { useParams } from 'react-router-dom';
import { TransactionDetail } from '../components/TransactionDetail';

export function TransactionDetails() {
  const { id } = useParams<{ id: string }>();

  if (!id) return <div className="text-red-500">Invalid transaction ID</div>;

  return <TransactionDetail id={id} />;
}
