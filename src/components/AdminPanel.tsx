import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, ExternalLink, User, DollarSign } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface Withdrawal {
  id: string;
  user_id: string;
  email: string;
  username: string;
  amount: number;
  withdrawal_address: string;
  status: string;
  created_at: string;
  completed_at?: string;
}

const AdminPanel: React.FC = () => {
  const [pendingWithdrawals, setPendingWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const { user } = useAuth();
  const getToken = () => localStorage.getItem('skycrash_token');

  useEffect(() => {
    fetchPendingWithdrawals();
  }, []);

  const fetchPendingWithdrawals = async () => {
    try {
      const response = await fetch('/api/admin/withdrawals/pending', {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingWithdrawals(data.pending_withdrawals || []);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to fetch withdrawals');
      }
    } catch (error) {
      console.error('Fetch withdrawals error:', error);
      toast.error('Failed to fetch withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const approveWithdrawal = async (withdrawalId: string, sendRealUsdt: boolean = false) => {
    setProcessing(withdrawalId);
    try {
      const response = await fetch('/api/admin/withdrawals/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          withdrawal_id: withdrawalId,
          send_real_usdt: sendRealUsdt
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        fetchPendingWithdrawals(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to approve withdrawal');
      }
    } catch (error) {
      console.error('Approve withdrawal error:', error);
      toast.error('Failed to approve withdrawal');
    } finally {
      setProcessing(null);
    }
  };

  const rejectWithdrawal = async (withdrawalId: string, reason: string = 'Rejected by admin') => {
    setProcessing(withdrawalId);
    try {
      const response = await fetch('/api/admin/withdrawals/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          withdrawal_id: withdrawalId,
          reason: reason
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        fetchPendingWithdrawals(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to reject withdrawal');
      }
    } catch (error) {
      console.error('Reject withdrawal error:', error);
      toast.error('Failed to reject withdrawal');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/60 p-6 shadow-card backdrop-blur">
        <div className="flex items-center justify-center h-32">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/60 p-6 shadow-card backdrop-blur">
      <div className="flex items-center gap-2 mb-6">
        <User className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Admin Panel - Withdrawal Management</h3>
      </div>

      {pendingWithdrawals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No pending withdrawals</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingWithdrawals.map((withdrawal) => (
            <Card key={withdrawal.id} className="border-border/40 bg-card/40 p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{withdrawal.username || withdrawal.email}</span>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-mono">{withdrawal.amount} USDT</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-mono">{formatAddress(withdrawal.withdrawal_address)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(`https://nile.tronscan.org/address/${withdrawal.withdrawal_address}`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Requested: {formatDate(withdrawal.created_at)}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => approveWithdrawal(withdrawal.id, false)}
                    disabled={processing === withdrawal.id}
                    className="text-green-600 hover:text-green-700"
                  >
                    {processing === withdrawal.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span className="ml-1">Test</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => approveWithdrawal(withdrawal.id, true)}
                    disabled={processing === withdrawal.id}
                    className="text-green-600 hover:text-green-700"
                  >
                    {processing === withdrawal.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span className="ml-1">Pay</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectWithdrawal(withdrawal.id)}
                    disabled={processing === withdrawal.id}
                    className="text-red-600 hover:text-red-700"
                  >
                    {processing === withdrawal.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <span className="ml-1">Reject</span>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
};

export default AdminPanel;
