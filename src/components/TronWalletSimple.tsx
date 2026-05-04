import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Copy, LogOut } from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    tronLink: any;
    tronWeb: any;
  }
}

interface TronWalletSimpleProps {
  onDepositSuccess?: () => void;
}

const TronWalletSimple = ({ onDepositSuccess }: TronWalletSimpleProps) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState('deposit');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const connectWallet = async () => {
    setIsConnecting(true);
    
    try {
      if (!window.tronLink) {
        toast.error('Please install TronLink wallet extension');
        window.open('https://www.tronlink.org/', '_blank');
        return;
      }

      const tronWeb = window.tronLink.tronWeb;
      if (!tronWeb) {
        toast.error('Please unlock your TronLink wallet');
        return;
      }

      const address = tronWeb.defaultAddress.base58;
      if (!address) {
        toast.error('No wallet address found');
        return;
      }

      setWalletAddress(address);
      toast.success('Wallet connected successfully');
      setActiveTab('deposit');
    } catch (error) {
      console.error('Wallet connection error:', error);
      toast.error('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress('');
    toast.success('Wallet disconnected');
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast.success('Address copied to clipboard');
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid deposit amount');
      return;
    }

    if (!walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    try {
      // Get private key from TronLink wallet
      if (!window.tronLink || !window.tronLink.tronWeb) {
        toast.error('TronLink wallet not connected properly');
        return;
      }

      // Get private key from TronLink (this requires user permission)
      let privateKey: string = '';
      
      // Try to get private key from TronLink
      const tronWeb = window.tronLink.tronWeb;
      if (tronWeb.defaultAddress && tronWeb.defaultAddress.privateKey) {
        privateKey = tronWeb.defaultAddress.privateKey;
      }
      
      // If private key is not directly accessible, ask the user to enter it
      if (!privateKey) {
        privateKey = prompt('Please enter your private key for blockchain transaction (for testing only):');
        if (!privateKey) {
          toast.error('Private key is required for blockchain transaction');
          return;
        }
      }

      const token = localStorage.getItem('skycrash_token');
      const requestBody = {
        amount: parseFloat(depositAmount),
        user_wallet_address: walletAddress,
        private_key: privateKey
      };
      
      console.log('Sending deposit request:', {
        amount: parseFloat(depositAmount),
        user_wallet_address: walletAddress,
        has_private_key: !!privateKey,
        private_key_length: privateKey ? privateKey.length : 0
      });
      
      const response = await fetch('/api/tron-wallet/direct-deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        // Safely extract transaction hash string
        let txHash = result.transaction_hash;
        if (typeof txHash === 'object' && txHash !== null) {
          txHash = txHash.txid || txHash.transaction || txHash.hash || JSON.stringify(txHash);
        }
        if (typeof txHash !== 'string') {
          txHash = String(txHash);
        }
        
        toast.success(`Deposit of ${depositAmount} USDT processed successfully! Transaction: ${txHash.slice(0, 10)}...`);
        setDepositAmount('');
        
        // Update user balance in the UI
        console.log('New balance:', result.new_balance);
        console.log('Blockchain transaction:', result.transaction_hash);
        
        // Call the callback to refresh user data in parent component
        if (onDepositSuccess) {
          onDepositSuccess();
        }
      } else {
        const errorText = await response.text();
        console.error('Deposit error response:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        toast.error(error.error || 'Deposit failed');
      }
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error('Deposit failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Please enter a valid withdrawal amount');
      return;
    }

    if (!withdrawAddress) {
      toast.error('Please enter a withdrawal address');
      return;
    }

    // Validate TRON address
    const tronAddressRegex = /^T[A-Za-z1-9]{33}$/;
    if (!tronAddressRegex.test(withdrawAddress)) {
      toast.error('Invalid TRON wallet address');
      return;
    }

    setIsProcessing(true);
    try {
      const token = localStorage.getItem('skycrash_token');
      const response = await fetch('/api/tron-wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          token_amount: parseFloat(withdrawAmount),
          withdrawal_address: withdrawAddress
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Withdrawal of ${withdrawAmount} USDT processed successfully! Transaction: ${result.transaction_hash?.slice(0, 10)}...`);
        setWithdrawAmount('');
        setWithdrawAddress('');
        
        // Update user balance in parent component if callback provided
        if (onDepositSuccess) {
          onDepositSuccess();
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Withdrawal failed');
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      toast.error('Withdrawal failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/60 p-6 shadow-card backdrop-blur">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">TRON Wallet</h3>
      </div>

      {!walletAddress ? (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Connect your TRON wallet to deposit and withdraw USDT.
          </div>
          <Button 
            onClick={connectWallet} 
            disabled={isConnecting}
            className="w-full"
          >
            {isConnecting ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Connecting...
              </div>
            ) : (
              'Connect TRON Wallet'
            )}
          </Button>
          <div className="text-xs text-muted-foreground">
            Don't have TronLink?{' '}
            <a 
              href="https://www.tronlink.org/" 
              target="_blank" 
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Download here
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="font-mono text-sm">{formatAddress(walletAddress)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={copyAddress}
                className="h-8 w-8 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={disconnectWallet}
                className="h-8 px-2"
              >
                <LogOut className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit" className="space-y-4">
          {!walletAddress ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Please connect your wallet to deposit USDT</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deposit-amount">Deposit Amount (USDT)</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>
              
              <Button 
                onClick={handleDeposit} 
                disabled={isProcessing || !depositAmount}
                className="w-full"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Processing...
                  </div>
                ) : (
                  'Deposit USDT'
                )}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="withdraw" className="space-y-4">
          {!walletAddress ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Please connect your wallet to withdraw USDT</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount">Withdraw Amount (USDT)</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdraw-address">Withdrawal Address</Label>
                <Input
                  id="withdraw-address"
                  placeholder="T..."
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleWithdraw} 
                disabled={isProcessing || !withdrawAmount || !withdrawAddress}
                className="w-full"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Processing...
                  </div>
                ) : (
                  'Withdraw USDT'
                )}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default TronWalletSimple;
