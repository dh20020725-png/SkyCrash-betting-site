import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowDownCircle, ArrowUpCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  transaction_type: 'deposit' | 'withdrawal';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  transaction_hash?: string;
  created_at: string;
  completed_at?: string;
}

interface TransactionHistoryProps {
  userId: string;
  type: 'deposit' | 'withdrawal' | 'all';
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ userId, type }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, [userId, type]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/transactions${type !== 'all' ? `?type=${type}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('skycrash_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Sort transactions by date (newest first)
        const sortedTransactions = (data.transactions || []).sort((a: Transaction, b: Transaction) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setTransactions(sortedTransactions);
      } else {
        toast.error('Failed to fetch transactions');
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAmount = (amount: number, transactionType: string) => {
    const prefix = transactionType === 'deposit' ? '+' : '-';
    return `${prefix}${Math.abs(amount).toFixed(2)} USDT`;
  };

  const calculateTotal = () => {
    return transactions.reduce((total, transaction) => {
      if (transaction.transaction_type === 'deposit') {
        return total + transaction.amount;
      } else {
        return total - transaction.amount;
      }
    }, 0);
  };

  const viewOnTronScan = (hash: string) => {
    window.open(`https://tronscan.org/transaction/${hash}`, '_blank');
  };

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/60 p-6 shadow-card backdrop-blur">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/60 p-6 shadow-card backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {type === 'deposit' ? 'Deposit History' : type === 'withdrawal' ? 'Withdrawal History' : 'Transaction History'}
        </h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchTransactions}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Total Amount Display */}
      {transactions.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
            <span className={`text-lg font-semibold ${
              calculateTotal() >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {calculateTotal() >= 0 ? '+' : ''}{calculateTotal().toFixed(2)} USDT
            </span>
          </div>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {type === 'deposit' ? 'No deposits found' : 
           type === 'withdrawal' ? 'No withdrawals found' : 
           'No transactions found'}
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div 
              key={transaction.id} 
              className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-secondary/20"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  transaction.transaction_type === 'deposit' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {transaction.transaction_type === 'deposit' ? (
                    <ArrowDownCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowUpCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div>
                  <div className="font-medium">
                    {formatAmount(transaction.amount, transaction.transaction_type)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(transaction.created_at)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(transaction.status)}>
                  {getStatusText(transaction.status)}
                </Badge>
                
                {transaction.transaction_hash && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => viewOnTronScan(transaction.transaction_hash)}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default TransactionHistory;
