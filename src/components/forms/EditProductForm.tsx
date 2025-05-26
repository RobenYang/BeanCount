
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import type { Product } from "@/lib/types";
import { Image as ImageIcon, Camera, XCircle, UploadCloud, Save } from "lucide-react";
import React, { useState, useRef, useEffect, useCallback } from "react";
import NextImage from "next/image";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription as AlertDesc } from "@/components/ui/alert";
import { useInventory } from "@/contexts/InventoryContext";

// lowStockThreshold removed from schema
const editProductFormSchema = z.object({
  name: z.string().min(2, "产品名称至少需要2个字符。"),
  unit: z.string().min(1, "单位为必填项 (例如: kg, liter, pcs)。"),
  shelfLifeDays: z.coerce.number().int().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  // Refinement logic for shelfLifeDays handled based on actual product.category in onSubmit
});

type EditProductFormValues = z.infer<typeof editProductFormSchema>;

interface EditProductFormProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditProductForm({ product, isOpen, onClose }: EditProductFormProps) {
  const { editProduct } = useInventory();
  const { toast } = useToast();

  const form = useForm<EditProductFormValues>({
    resolver: zodResolver(editProductFormSchema),
  });

  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product && isOpen) { // Ensure reset only when modal opens with a product
      form.reset({
        name: product.name,
        unit: product.unit,
        shelfLifeDays: product.category === "INGREDIENT" ? product.shelfLifeDays : null,
        // lowStockThreshold: product.lowStockThreshold, // Removed
        imageUrl: product.imageUrl || null,
      });
      setImageDataUri(product.imageUrl || null);
    }
  }, [product, form, isOpen]);

  useEffect(() => {
    form.setValue("imageUrl", imageDataUri);
  }, [imageDataUri, form]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ variant: "destructive", title: "图片太大", description: "请上传小于2MB的图片文件。" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => { setImageDataUri(reader.result as string); setShowCamera(false); };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setHasCameraPermission(true); setShowCamera(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false); setShowCamera(false);
        toast({ variant: 'destructive', title: '相机访问被拒绝', description: '请在浏览器设置中允许相机访问。' });
      }
    } else {
      toast({ variant: 'destructive', title: '相机不可用', description: '您的设备或浏览器不支持相机功能。' });
    }
  };

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  }, []);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current; const canvas = canvasRef.current;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg');
        setImageDataUri(dataUri);
      }
      stopCamera();
    }
  };

  useEffect(() => { return () => { stopCamera(); }; }, [stopCamera]);

  function onSubmit(data: EditProductFormValues) {
    if (!product) return;

    const productDataToUpdate: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>> = {
      name: data.name,
      unit: data.unit,
      shelfLifeDays: product.category === "INGREDIENT" ? (data.shelfLifeDays || 0) : null,
      // lowStockThreshold: data.lowStockThreshold, // Removed
      imageUrl: imageDataUri,
    };

    if (product.category === "INGREDIENT" && (!productDataToUpdate.shelfLifeDays || productDataToUpdate.shelfLifeDays <=0) ) {
        form.setError("shelfLifeDays", {message: "食材的保质期必须是正整数天数。"});
        return;
    }

    editProduct(product.id, productDataToUpdate);
    onClose();
  }

  if (!isOpen || !product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑产品: {product.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>产品名称</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
                <FormLabel>产品类别 (不可修改)</FormLabel>
                <Input value={product.category === "INGREDIENT" ? "食材" : "非食材"} readOnly disabled />
            </FormItem>

            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>计量单位</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {product.category === "INGREDIENT" && (
              <FormField
                control={form.control}
                name="shelfLifeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>标准保质期 (天)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value === undefined || field.value === null ? '' : String(field.value)}
                        onChange={(e) => {
                            const val = e.target.value;
                            field.onChange(val === '' ? undefined : parseInt(val, 10));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* lowStockThreshold field removed */}

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>产品图片 (可选)</FormLabel>
                  <FormDescription>上传或拍摄产品图片。推荐使用1:1比例的图片。最大2MB。</FormDescription>
                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-full h-48 border-2 border-dashed rounded-lg bg-muted/50">
                      {imageDataUri ? (
                        <div className="relative w-full h-full">
                           <NextImage src={imageDataUri} alt="产品预览" layout="fill" objectFit="contain" className="rounded-md" />
                           <Button variant="ghost" size="icon" type="button" className="absolute top-1 right-1 bg-background/50 hover:bg-destructive/80 hover:text-destructive-foreground rounded-full"
                            onClick={() => { setImageDataUri(null); if (fileInputRef.current) fileInputRef.current.value = ""; stopCamera(); }}>
                             <XCircle className="h-5 w-5" />
                           </Button>
                        </div>
                      ) : (
                        <div className="text-center p-4"><ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">图片预览区</p></div>
                      )}
                    </div>
                    {!showCamera && (
                       <div className="flex gap-2">
                         <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1"><UploadCloud className="mr-2 h-4 w-4" /> 上传图片</Button>
                         <Input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                         <Button type="button" variant="outline" onClick={startCamera} className="flex-1"><Camera className="mr-2 h-4 w-4" /> 打开相机</Button>
                       </div>
                    )}
                    {showCamera && hasCameraPermission === true && (
                        <div className="space-y-2">
                            <video ref={videoRef} className="w-full aspect-video rounded-md bg-black" autoPlay playsInline muted />
                            <div className="flex gap-2">
                                <Button type="button" onClick={takePhoto} className="flex-1">拍摄照片</Button>
                                <Button type="button" variant="outline" onClick={stopCamera} className="flex-1">关闭相机</Button>
                            </div>
                        </div>
                    )}
                    {hasCameraPermission === false && (
                        <Alert variant="destructive"><Camera className="h-4 w-4" /><AlertTitle>相机访问被拒绝</AlertTitle><AlertDesc>请在浏览器设置中允许相机访问以使用此功能。</AlertDesc></Alert>
                    )}
                  </div>
                  <FormMessage />
                  <canvas ref={canvasRef} className="hidden"></canvas>
                </FormItem>
              )}
            />
             <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="outline">取消</Button>
                </DialogClose>
                <Button type="submit">
                    <Save className="mr-2 h-4 w-4" /> 保存更改
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
