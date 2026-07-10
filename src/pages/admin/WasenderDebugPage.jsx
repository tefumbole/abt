import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { sendWhatsAppMessage, maskKey } from '@/services/wasenderapiService';
import { CheckCircle2, XCircle, Send, Phone, KeyRound, Server } from 'lucide-react';

const WasenderDebugPage = () => {
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('Hello! This is a test message from Alpha Bridge system diagnostics.');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
      keyStatus: false,
      maskedKey: '',
      apiUrl: '',
      devicePhone: ''
  });

  useEffect(() => {
      // Load and safely log configuration
      const key = import.meta.env.VITE_WASENDER_API_KEY;
      const url =
        import.meta.env.VITE_WASENDER_BASE_URL ||
        import.meta.env.VITE_WASENDER_API_URL ||
        'https://wasenderapi.com/api';
      const country = import.meta.env.VITE_DEFAULT_PHONE_COUNTRY || 'RW';

      setConfig({
          keyStatus: !!key,
          maskedKey: maskKey(key),
          apiUrl: url,
          devicePhone: `Default country: ${country}`,
      });
  }, []);

  const handleTestSend = async () => {
      if(!testPhone) return;
      setLoading(true);
      setStatus(null);
      
      try {
          const result = await sendWhatsAppMessage(testPhone, testMsg);
          setStatus({
              success: result.success,
              message: result.success ? "Message dispatched successfully." : `Failed: ${result.error}`,
              raw: result
          });
      } catch (err) {
          setStatus({
              success: false,
              message: err.message,
              raw: err
          });
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <h1 className="text-3xl font-bold text-[#003D82] mb-8">Wasender Diagnostic Portal</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-gray-500" />
                    Environment Config
                  </CardTitle>
                  <CardDescription>Current loaded environment variables</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-gray-500" />
                          <span className="font-semibold text-sm">API Key Status</span>
                      </div>
                      <Badge variant={config.keyStatus ? "default" : "destructive"}>
                          {config.keyStatus ? "LOADED" : "MISSING"}
                      </Badge>
                  </div>
                  
                  <div className="space-y-1">
                      <span className="text-xs text-gray-500 font-medium uppercase">Masked API Key</span>
                      <div className="font-mono text-sm bg-gray-100 p-2 rounded text-gray-800 break-all">
                          {config.maskedKey}
                      </div>
                  </div>

                  <div className="space-y-1">
                      <span className="text-xs text-gray-500 font-medium uppercase">API URL</span>
                      <div className="font-mono text-sm bg-gray-100 p-2 rounded text-gray-800 break-all">
                          {config.apiUrl}
                      </div>
                  </div>

                  <div className="space-y-1">
                      <span className="text-xs text-gray-500 font-medium uppercase">Sender Device (From)</span>
                      <div className="flex items-center gap-2 font-mono text-sm bg-gray-100 p-2 rounded text-gray-800">
                          <Phone className="w-3 h-3" />
                          {config.devicePhone}
                      </div>
                  </div>
              </CardContent>
          </Card>

          <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <Send className="w-5 h-5 text-[#003D82]" />
                      Live Dispatch Test
                  </CardTitle>
                  <CardDescription>Send a real test message using the configured gateway</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="space-y-2">
                      <Label>Recipient Phone (+250...)</Label>
                      <Input 
                          placeholder="+250XXXXXXXXX" 
                          value={testPhone} 
                          onChange={e => setTestPhone(e.target.value)} 
                      />
                  </div>
                  
                  <div className="space-y-2">
                      <Label>Test Payload</Label>
                      <Input 
                          value={testMsg} 
                          onChange={e => setTestMsg(e.target.value)} 
                      />
                  </div>

                  <Button 
                      onClick={handleTestSend} 
                      disabled={loading || !testPhone}
                      className="w-full bg-[#003D82] hover:bg-[#002855]"
                  >
                      {loading ? "Dispatching Payload..." : "Execute Test"}
                  </Button>

                  {status && (
                      <div className={`p-4 mt-4 rounded-lg flex items-start gap-3 ${status.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                          {status.success ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <XCircle className="w-5 h-5 mt-0.5" />}
                          <div>
                              <p className="font-semibold">{status.message}</p>
                              {!status.success && <p className="text-xs mt-1 font-mono">{JSON.stringify(status.raw?.error || status.raw)}</p>}
                          </div>
                      </div>
                  )}
              </CardContent>
          </Card>
      </div>
    </div>
  );
};

export default WasenderDebugPage;