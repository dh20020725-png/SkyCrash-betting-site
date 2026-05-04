import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      const loginSuccess = searchParams.get('login');
      const error = searchParams.get('error');

      if (error) {
        toast.error('Google login failed');
        navigate('/auth');
        return;
      }

      if (token && loginSuccess === 'success') {
        try {
          // Use the auth context to set user with token
          await loginWithToken(token);
          
          toast.success('Logged in with Google successfully!');
          navigate('/');
        } catch (error) {
          console.error('Error processing Google callback:', error);
          toast.error('Google login failed');
          navigate('/auth');
        }
      } else {
        toast.error('Google login failed');
        navigate('/auth');
      }
    };

    handleCallback();
  }, [searchParams, navigate, loginWithToken]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-white">Completing Google sign-in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
