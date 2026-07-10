import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, UploadCloud, Trash2, Image as ImageIcon, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getSystemSettings, updateSystemSettings } from '@/services/settingsService';
import { uploadLogo, uploadPdfLetterheadImage, deleteStoredAsset } from '@/services/logoUploadService';

const SystemConfigTab = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);
    const headerInputRef = useRef(null);
    const footerInputRef = useRef(null);

    const [config, setConfig] = useState({
        developed_by: '',
        copyright_text: '',
        logo_url: '',
        logo_file_path: '',
        pdf_header_url: '',
        pdf_header_file_path: '',
        pdf_footer_url: '',
        pdf_footer_file_path: '',
    });
    const [uploadingHeader, setUploadingHeader] = useState(false);
    const [uploadingFooter, setUploadingFooter] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await getSystemSettings();
            if (data) {
                setConfig({
                    developed_by: data.developed_by || '',
                    copyright_text: data.copyright_text || '',
                    logo_url: data.logo_url || '',
                    logo_file_path: data.logo_file_path || '',
                    pdf_header_url: data.pdf_header_url || '',
                    pdf_header_file_path: data.pdf_header_file_path || '',
                    pdf_footer_url: data.pdf_footer_url || '',
                    pdf_footer_file_path: data.pdf_footer_file_path || '',
                });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to load system settings" });
        } finally {
            setLoading(false);
        }
    };

    const handleTextChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveText = async () => {
        try {
            setSaving(true);
            await updateSystemSettings({
                developed_by: config.developed_by,
                copyright_text: config.copyright_text,
            });
            toast({ 
                title: "Settings Saved", 
                description: "System configuration updated successfully.",
                className: "bg-green-600 text-white"
            });
        } catch (error) {
            toast({ variant: "destructive", title: "Save Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleFile = async (file) => {
        if (!file) return;

        try {
            setUploading(true);
            
            // 1. Delete old logo if exists
            if (config.logo_file_path) {
                await deleteStoredAsset(config.logo_file_path);
            }

            // 2. Upload new logo
            const { publicUrl, filePath } = await uploadLogo(file);

            // 3. Update DB
            await updateSystemSettings({
                logo_url: publicUrl,
                logo_file_path: filePath
            });

            setConfig(prev => ({
                ...prev,
                logo_url: publicUrl,
                logo_file_path: filePath
            }));

            toast({ title: "Logo Updated", description: "New system logo uploaded successfully." });
        } catch (error) {
            toast({ variant: "destructive", title: "Upload Failed", description: error.message });
        } finally {
            setUploading(false);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleRemoveLogo = async () => {
        if (!window.confirm("Are you sure you want to remove the system logo?")) return;
        
        try {
            setUploading(true);
            if (config.logo_file_path) {
                await deleteStoredAsset(config.logo_file_path);
            }
            
            await updateSystemSettings({
                logo_url: null,
                logo_file_path: null
            });
            
            setConfig(prev => ({ ...prev, logo_url: '', logo_file_path: '' }));
            toast({ title: "Logo Removed", description: "System logo has been removed." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setUploading(false);
        }
    };

    const handleLetterheadUpload = async (file, type) => {
        if (!file) return;

        const setUploadingState = type === 'header' ? setUploadingHeader : setUploadingFooter;
        const urlKey = type === 'header' ? 'pdf_header_url' : 'pdf_footer_url';
        const pathKey = type === 'header' ? 'pdf_header_file_path' : 'pdf_footer_file_path';

        try {
            setUploadingState(true);

            if (config[pathKey]) {
                await deleteStoredAsset(config[pathKey]);
            }

            const { publicUrl, filePath } = await uploadPdfLetterheadImage(file, type);

            await updateSystemSettings({
                [urlKey]: publicUrl,
                [pathKey]: filePath,
            });

            setConfig((prev) => ({
                ...prev,
                [urlKey]: publicUrl,
                [pathKey]: filePath,
            }));

            toast({
                title: `${type === 'header' ? 'Header' : 'Footer'} Updated`,
                description: `PDF ${type} image uploaded successfully.`,
            });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        } finally {
            setUploadingState(false);
        }
    };

    const handleRemoveLetterhead = async (type) => {
        const label = type === 'header' ? 'header' : 'footer';
        if (!window.confirm(`Remove the PDF ${label} image?`)) return;

        const urlKey = type === 'header' ? 'pdf_header_url' : 'pdf_footer_url';
        const pathKey = type === 'header' ? 'pdf_header_file_path' : 'pdf_footer_file_path';
        const setUploadingState = type === 'header' ? setUploadingHeader : setUploadingFooter;

        try {
            setUploadingState(true);
            if (config[pathKey]) {
                await deleteStoredAsset(config[pathKey]);
            }

            await updateSystemSettings({
                [urlKey]: null,
                [pathKey]: null,
            });

            setConfig((prev) => ({ ...prev, [urlKey]: '', [pathKey]: '' }));
            toast({ title: 'Removed', description: `PDF ${label} image removed.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setUploadingState(false);
        }
    };

    const renderLetterheadUpload = (type, label, inputRef, imageUrl, isUploading) => (
        <div className="space-y-3">
            <Label>{label}</Label>
            <input
                type="file"
                ref={inputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/webp, image/svg+xml"
                onChange={(e) => handleLetterheadUpload(e.target.files?.[0], type)}
            />
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center min-h-[180px] bg-gray-50/50">
                {isUploading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                ) : imageUrl ? (
                    <div className="w-full flex flex-col items-center gap-3">
                        <div className="w-full bg-white rounded-lg border p-2 flex items-center justify-center">
                            <img src={imageUrl} alt={label} className="max-w-full max-h-28 object-contain" />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                                Replace
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleRemoveLetterhead(type)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-3">
                        <UploadCloud className="w-8 h-8 text-blue-600 mx-auto" />
                        <p className="text-sm text-gray-600">Upload {label.toLowerCase()} image</p>
                        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                            Select Image
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Branding Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-blue-600" />
                            System Branding
                        </CardTitle>
                        <CardDescription>Upload your organization's logo (PNG, JPG, SVG).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div 
                            className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all duration-200 ${
                                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                            }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/png, image/jpeg, image/webp, image/svg+xml"
                                onChange={(e) => handleFile(e.target.files[0])}
                            />

                            {uploading ? (
                                <div className="flex flex-col items-center">
                                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-2" />
                                    <p className="text-sm text-gray-500">Uploading...</p>
                                </div>
                            ) : config.logo_url ? (
                                <div className="relative group w-full flex flex-col items-center">
                                    <div className="relative w-48 h-32 flex items-center justify-center bg-white rounded-lg shadow-sm border p-2 mb-4">
                                        <img 
                                            src={config.logo_url} 
                                            alt="System Logo" 
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                            Replace
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={handleRemoveLogo}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="bg-blue-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                                        <UploadCloud className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <p className="font-medium text-gray-900">Click to upload or drag and drop</p>
                                    <p className="text-sm text-gray-500 mt-1">SVG, PNG, JPG or WebP (max 5MB)</p>
                                    <Button 
                                        variant="outline" 
                                        className="mt-4"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        Select File
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Info Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>General Information</CardTitle>
                        <CardDescription>Set footer credits and copyright information.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="developed_by">Developed By Text</Label>
                            <Input 
                                id="developed_by"
                                name="developed_by"
                                value={config.developed_by}
                                onChange={handleTextChange}
                                placeholder="e.g. Alpha Bridge"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="copyright_text">Copyright Text</Label>
                            <Input 
                                id="copyright_text"
                                name="copyright_text"
                                value={config.copyright_text}
                                onChange={handleTextChange}
                                placeholder="e.g. All rights reserved"
                            />
                            <p className="text-xs text-gray-500">
                                The year will be automatically appended (e.g., © 2024 Your Text).
                            </p>
                        </div>

                        <div className="pt-4">
                            <Button onClick={handleSaveText} disabled={saving} className="w-full bg-[#003D82]">
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" /> Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>PDF Header &amp; Footer</CardTitle>
                    <CardDescription>
                        Upload header and footer images applied to all generated PDF documents (agreements, announcements, messages).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {renderLetterheadUpload('header', 'PDF Header Image', headerInputRef, config.pdf_header_url, uploadingHeader)}
                        {renderLetterheadUpload('footer', 'PDF Footer Image', footerInputRef, config.pdf_footer_url, uploadingFooter)}
                    </div>
                    <p className="text-xs text-gray-500 mt-4">
                        Use PNG or JPG letterhead artwork. Recommended width: 800–1200px. Logo watermark uses the system logo above.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default SystemConfigTab;