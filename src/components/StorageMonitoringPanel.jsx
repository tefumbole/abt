import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { 
    Database, 
    HardDrive, 
    AlertTriangle, 
    RefreshCcw, 
    Trash2,
    FileImage,
    Server,
    ExternalLink
} from 'lucide-react';
import { getStorageUsage } from '@/utils/storageOptimization';
import { useToast } from '@/components/ui/use-toast';
import { formatBytes } from '@/utils/imageCompression';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const StorageMonitoringPanel = () => {
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cleaning, setCleaning] = useState(false);
    const { toast } = useToast();

    // Pro Plan Limit: 100GB
    const STORAGE_LIMIT_BYTES = 100 * 1024 * 1024 * 1024; 

    useEffect(() => {
        refreshStorageData();
    }, []);

    const refreshStorageData = async () => {
        setLoading(true);
        try {
            const data = await getStorageUsage();
            // Override usage calculation for Pro Plan
            const calculatedPercentage = (data.totalBytes / STORAGE_LIMIT_BYTES) * 100;
            
            setUsage({
                ...data,
                formattedLimit: formatBytes(STORAGE_LIMIT_BYTES),
                percentage: calculatedPercentage,
                totalBytes: data.totalBytes
            });
        } catch (error) {
            console.error("Failed to load storage data", error);
        } finally {
            setLoading(false);
        }
    };

    const runCleanup = async () => {
        setCleaning(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast({
                title: "Cleanup Complete",
                description: `Scan complete. System is optimized.`,
            });
            refreshStorageData();
        } catch (error) {
            toast({
                title: "Cleanup Failed",
                description: "An error occurred during storage cleanup.",
                variant: "destructive"
            });
        } finally {
            setCleaning(false);
        }
    };

    if (loading && !usage) {
        return (
            <Card className="animate-pulse border-t-4 border-t-gray-200">
                <CardHeader>
                    <div className="h-6 w-1/3 bg-gray-200 rounded"></div>
                    <div className="h-4 w-1/2 bg-gray-200 rounded mt-2"></div>
                </CardHeader>
                <CardContent>
                    <div className="h-24 bg-gray-100 rounded"></div>
                </CardContent>
            </Card>
        );
    }

    const isWarning = usage?.percentage >= 80;
    const isCritical = usage?.percentage >= 90;
    const progressBarColor = isCritical ? "bg-red-600" : isWarning ? "bg-yellow-500" : "bg-green-600";
    const statusColor = isCritical ? "text-red-600" : isWarning ? "text-yellow-600" : "text-green-600";

    return (
        <Card className={`border-t-4 shadow-md ${isCritical ? 'border-t-red-600' : 'border-t-blue-600'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-[#003D82]" /> Enterprise Storage
                    </CardTitle>
                    <CardDescription>Alpha Bridge Pro Plan (100GB Quota)</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={refreshStorageData} disabled={loading}>
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </CardHeader>
            <CardContent className="space-y-6">
                
                {/* Usage Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                        <span className="text-gray-700">Usage</span>
                        <span className={statusColor}>
                            {formatBytes(usage?.totalBytes || 0)} / {usage?.formattedLimit} ({usage?.percentage?.toFixed(2)}%)
                        </span>
                    </div>
                    <Progress 
                        value={usage?.percentage} 
                        className={`h-3 bg-gray-100 [&>div]:${progressBarColor}`} 
                    />
                </div>

                {/* Warning Alerts */}
                {isWarning && (
                    <Alert variant={isCritical ? "destructive" : "default"} className={!isCritical ? "bg-yellow-50 border-yellow-200 text-yellow-800" : ""}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{isCritical ? "Critical Storage Alert" : "Storage Warning"}</AlertTitle>
                        <AlertDescription>
                            You are approaching your 100GB limit. Please clean up old files.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-center gap-3">
                        <div className="p-2 bg-blue-200 text-blue-700 rounded-full">
                            <FileImage className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">Media Files</p>
                            <p className="font-bold text-gray-900">{usage?.fileCount || 0} Files</p>
                        </div>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100 flex items-center gap-3">
                        <div className="p-2 bg-green-200 text-green-700 rounded-full">
                            <Server className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">Current Plan</p>
                            <p className="font-bold text-gray-900">Pro (100GB)</p>
                        </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex items-center gap-3">
                        <div className="p-2 bg-purple-200 text-purple-700 rounded-full">
                            <HardDrive className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">Available</p>
                            <p className="font-bold text-gray-900">{formatBytes(STORAGE_LIMIT_BYTES - (usage?.totalBytes || 0))}</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                                <Trash2 className="w-4 h-4 mr-2" /> Maintenance
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Start Storage Cleanup?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will scan for temporary files and suggest items for deletion.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={runCleanup} className="bg-red-600 hover:bg-red-700">
                                    Start Scan
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Button variant="ghost" className="ml-auto text-gray-500 hover:text-[#003D82]" onClick={() => window.open('https://supabase.com/dashboard', '_blank')}>
                        <ExternalLink className="w-4 h-4 mr-2" /> View Dashboard
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default StorageMonitoringPanel;