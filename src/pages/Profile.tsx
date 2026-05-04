import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { User, Save, Camera } from "lucide-react";
import { toast } from "sonner";
import ImageCropper from "@/components/ImageCropper";
import TronWalletSimple from "@/components/TronWalletSimple";
import TransactionHistory from "@/components/TransactionHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// API base URL (using proxy)
const API_BASE_URL = '/api';
const TOKEN_KEY = 'skycrash_token';

const Profile = () => {
  const { user, updateUser } = useAuth();
  if (!user) {
    // Add authentication check, you can redirect to login page or show an error message
    return <div>You need to be authenticated to access this page</div>;
  }

  const [username, setUsername] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [tronWalletAddress, setTronWalletAddress] = useState(user?.tron_wallet_address || '');

  // Refresh user balance on mount
  useEffect(() => {
    const refreshBalance = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem(TOKEN_KEY)}`
          }
        });
        
        if (response.ok) {
          const freshUser = await response.json();
          updateUser(freshUser);
        }
      } catch (error) {
        console.error('Failed to refresh balance:', error);
      }
    };

    refreshBalance();
  }, [updateUser]);

  const handleWalletConnect = (address: string) => {
    setTronWalletAddress(address);
    if (user) {
      updateUser({ ...user, tron_wallet_address: address });
    }
  };

  const handleWalletDisconnect = () => {
    setTronWalletAddress('');
    if (user) {
      updateUser({ ...user, tron_wallet_address: null });
    }
  };

  const handleDepositSuccess = async () => {
    try {
      // Fetch fresh user data to update balance
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem(TOKEN_KEY)}`
        }
      });
      
      if (response.ok) {
        const freshUser = await response.json();
        updateUser(freshUser);
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  const validateUsername = (username: string) => {
    const usernameRegex = /^[a-z0-9_\-!@#$%^&*()+=<>?]+$/;
    return usernameRegex.test(username);
  };

  const handleProfileUpdate = async () => {
    if (!username.trim()) {
      toast.error('Username cannot be empty');
      return;
    }

    if (!validateUsername(username)) {
      toast.error('Username can only contain lowercase letters, numbers, and special characters');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(TOKEN_KEY)}`
        },
        body: JSON.stringify({
          username,
          avatar_url: avatarUrl
        })
      });

      if (response.ok) {
        const updatedUser = await response.json();
        updateUser(updatedUser);
        toast.success('Profile updated successfully');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update profile');
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    setShowCropper(true);
  };

  const handleCropComplete = async (croppedFile: File) => {
    setShowCropper(false);
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('avatar', croppedFile);

      const response = await fetch(`${API_BASE_URL}/auth/upload-avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem(TOKEN_KEY)}`
        },
        body: formData
      });

      if (response.ok) {
        const { avatar_url } = await response.json();
        setAvatarUrl(avatar_url);
        toast.success('Avatar uploaded successfully');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to upload avatar');
      }
    } catch (error) {
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setSelectedFile(null);
  };

  const getAvatarUrl = () => {
    if (avatarUrl) {
      if (avatarUrl.startsWith('/uploads/')) {
        return avatarUrl;
      }
      if (avatarUrl.startsWith('http')) {
        return avatarUrl;
      }
      return `/${avatarUrl}`;
    }
    
    if (user?.avatar_url) {
      if (user.avatar_url.startsWith('/uploads/')) {
        return user.avatar_url;
      }
      if (user.avatar_url.startsWith('http')) {
        return user.avatar_url;
      }
      return `/${user.avatar_url}`;
    }
    
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const colorIndex = (user?.username?.length || 0) % colors.length;
    return `https://ui-avatars.com/api/?name=${username || 'User'}&background=${colors[colorIndex].replace('#', '')}&color=fff&size=128`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-xs text-muted-foreground">Manage your account and personal information</p>
      </header>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="wallet">TRON Wallet</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="flex flex-col gap-6 border-border/60 bg-card/60 p-6 shadow-card backdrop-blur md:flex-row md:items-center">
            <div className="flex flex-col items-center md:items-start">
              <div className="relative">
                <img
                  src={getAvatarUrl()}
                  alt="Profile Avatar"
                  className="h-24 w-24 rounded-full shadow-glow-primary border-4 border-primary/20"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute bottom-0 right-0 rounded-full bg-primary text-primary-foreground p-2 shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="mt-3 text-center md:text-left">
                <h2 className="text-lg font-semibold">{username || 'User'}</h2>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="grid gap-4 md:grid-cols-1">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs uppercase tracking-widest text-muted-foreground">
                    Username (ID)
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="flex-1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lowercase, numbers, and special characters only
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleProfileUpdate} disabled={isUpdating}>
                  <Save className="mr-2 h-4 w-4" />
                  Update Profile
                </Button>
              </div>
            </div>
          </Card>

          {/* Account Info */}
          <Card className="border-border/60 bg-card/60 p-6 shadow-card backdrop-blur">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Account Information</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Current Balance</Label>
                <div className="text-2xl font-bold text-primary">
                  ${user?.balance?.toFixed(2) || '0.00'}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Account Type</Label>
                <div className="text-lg font-semibold">
                  {user?.google_id ? 'Google Account' : 'Email Account'}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Member Since</Label>
                <div className="text-lg font-semibold">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Today'}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-6">
          <TronWalletSimple onDepositSuccess={handleDepositSuccess} />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <TransactionHistory 
            userId={user?.id || ''}
            type="all"
          />
        </TabsContent>
      </Tabs>

      {/* Image Cropper */}
      {showCropper && selectedFile && (
        <ImageCropper
          imageFile={selectedFile}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
};

export default Profile;