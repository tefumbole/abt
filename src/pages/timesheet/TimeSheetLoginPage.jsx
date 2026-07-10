import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Clock, Lock, User, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const TimeSheetLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginWithCredentials } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // For demo purposes, we will accept any email but enforce a password check via the context mock
    // In a real app, loginWithCredentials would handle this. 
    // Since current context mocks "admin"/"system", let's suggest those in the UI hint or allow user to try.
    
    try {
        await loginWithCredentials(email, password);
        toast({
            title: "Welcome to TimeSheet",
            description: "Login successful. Redirecting to dashboard...",
            className: "bg-green-600 text-white border-none"
        });
        navigate('/timesheet/monthly-summary');
    } catch (error) {
        toast({
            title: "Login Failed",
            description: "Invalid credentials. Try (admin / system) for demo.",
            variant: "destructive"
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center bg-[#003D82] text-white rounded-t-lg py-8">
            <div className="mx-auto bg-white/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-2">
                <Clock className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <CardTitle className="text-2xl font-bold">Employee Time Sheet</CardTitle>
            <p className="text-blue-200 text-sm">Alpha Bridge</p>
        </CardHeader>
        <CardContent className="pt-8">
            <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Username / Email</Label>
                    <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input 
                            id="email" 
                            type="text" 
                            placeholder="username" 
                            className="pl-10"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input 
                            id="password" 
                            type="password" 
                            placeholder="••••••••" 
                            className="pl-10"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                </div>
                
                <div className="pt-4">
                    <Button 
                        type="submit" 
                        className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-[#003D82] font-bold"
                        disabled={loading}
                    >
                        {loading ? "Verifying..." : "Access Time Sheet"}
                    </Button>
                </div>
            </form>
        </CardContent>
        <CardFooter className="justify-center border-t py-4">
             <Link to="/" className="text-sm text-gray-500 hover:text-[#003D82] flex items-center gap-1">
                 <ArrowLeft className="w-3 h-3" /> Back to Website
             </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default TimeSheetLoginPage;