
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInventory } from "@/contexts/InventoryContext";
import type { ProductCategory } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Image as ImageIcon, Camera, XCircle, UploadCloud, AlertTriangle } from "lucide-react";
import React, { useState, useRef, useEffect, useCallback } from "react";
import NextImage from "next/image";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription as AlertDesc } from "@/components/ui/alert";


const productCategories: { value: ProductCategory; label: string }[] = [
  { value: "INGREDIENT", label: "食材 (有生产/保质期)" },
  { value: "NON_INGREDIENT", label: "非食材 (无生产/保质期)" },
];

const productFormSchema = z.object({
  name: z.string().min(2, "产品名称至少需要2个字符。"),
  category: z.enum(["INGREDIENT", "NON_INGREDIENT"], {
    required_error: "必须选择产品类别。",
  }),
  unit: z.string().min(1, "单位为必填项 (例如: kg, liter, pcs)。"),
  shelfLifeDays: z.coerce.number().int().optional(),
  // lowStockThreshold: z.coerce // Removed
  //   .number({ invalid_type_error: "预警阈值必须是数字。" })
  //   .int("预警阈值必须是整数。")
  //   .min(0, "预警阈值不能为负数。"),
  imageUrl: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.category === "INGREDIENT") {
    if (data.shelfLifeDays === undefined || data.shelfLifeDays === null || data.shelfLifeDays <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "食材的保质期必须是正整数天数。",
        path: ["shelfLifeDays"],
      });
    }
  }
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export function AddProductForm() {
  const { addProduct } = useInventory();
  const { toast } = useToast();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      category: undefined,
      unit: "",
      shelfLifeDays: undefined,
      // lowStockThreshold: 5, // Removed
      imageUrl: null,
    },
  });

  const selectedCategory = form.watch("category");
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    form.setValue("imageUrl", imageDataUri);
  }, [imageDataUri, form]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          variant: "destructive",
          title: "图片太大",
          description: "请上传小于2MB的图片文件。",
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Reset file input
        }
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageDataUri(reader.result as string);
        setShowCamera(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setHasCameraPermission(true);
        setShowCamera(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        setShowCamera(false);
        toast({
          variant: 'destructive',
          title: '相机访问被拒绝',
          description: '请在浏览器设置中允许相机访问。',
        });
      }
    } else {
        toast({
          variant: 'destructive',
          title: '相机不可用',
          description: '您的设备或浏览器不支持相机功能。',
        });
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
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg'); // Or image/png
        setImageDataUri(dataUri);
      }
      stopCamera();
    }
  };

  useEffect(() => {
    return () => { // Cleanup on unmount
      stopCamera();
    };
  }, [stopCamera]);


  async function onSubmit(data: ProductFormValues) {
    const productDataToAdd = {
      name: data.name,
      category: data.category as ProductCategory,
      unit: data.unit,
      shelfLifeDays: data.category === "INGREDIENT" ? data.shelfLifeDays! : null,
      // lowStockThreshold: data.lowStockThreshold, // Removed
      imageUrl: imageDataUri,
    };
    // Type assertion to satisfy addProduct's expectation, as lowStockThreshold is removed from the type Omit<Product, ...>
    const result = await addProduct(productDataToAdd as Omit<Product, 'id' | 'createdAt' | 'isArchived'>);
    if (result) {
      form.reset({
        name: "",
        category: undefined,
        unit: "",
        shelfLifeDays: undefined,
        // lowStockThreshold: 5, // Removed
        imageUrl: null,
      });
      setImageDataUri(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = "";
      }
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusCircle className="h-6 w-6" />
          添加新产品
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>产品名称</FormLabel>
                  <FormControl>
                    <Input placeholder="例如: 阿拉比卡咖啡豆" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>产品类别</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择一个类别" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {productCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>计量单位</FormLabel>
                  <FormControl>
                    <Input placeholder="例如: kg, 升, 个, 瓶" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedCategory === "INGREDIENT" && (
              <FormField
                control={form.control}
                name="shelfLifeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>标准保质期 (天)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="例如: 365 代表 1 年"
                        value={field.value === undefined ? '' : String(field.value)}
                        onChange={(e) => {
                            const val = e.target.value;
                            field.onChange(val === '' ? undefined : parseInt(val, 10));
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Removed lowStockThreshold FormField */}

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>产品图片 (可选)</FormLabel>
                  <FormDescription>
                    上传或拍摄产品图片。推荐使用1:1比例的图片。最大2MB。
                  </FormDescription>
                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-full h-48 border-2 border-dashed rounded-lg bg-muted/50">
                      {imageDataUri ? (
                        <div className="relative w-full h-full">
                           <NextImage src={imageDataUri} alt="产品预览" layout="fill" objectFit="contain" className="rounded-md" />
                           <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className="absolute top-1 right-1 bg-background/50 hover:bg-destructive/80 hover:text-destructive-foreground rounded-full"
                            onClick={() => {
                                setImageDataUri(null);
                                if (fileInputRef.current) fileInputRef.current.value = "";
                                stopCamera();
                            }}
                           >
                             <XCircle className="h-5 w-5" />
                           </Button>
                        </div>
                      ) : (
                        <div className="text-center p-4">
                           <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                           <p className="mt-2 text-sm text-muted-foreground">图片预览区</p>
                        </div>
                      )}
                    </div>

                    {!showCamera && (
                       <div className="flex gap-2">
                         <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1">
                           <UploadCloud className="mr-2 h-4 w-4" /> 上传图片
                         </Button>
                         <Input
                           type="file"
                           accept="image/*"
                           ref={fileInputRef}
                           onChange={handleImageUpload}
                           className="hidden"
                         />
                         <Button type="button" variant="outline" onClick={startCamera} className="flex-1">
                           <Camera className="mr-2 h-4 w-4" /> 打开相机
                         </Button>
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
                        <Alert variant="destructive">
                            <Camera className="h-4 w-4" />
                            <AlertTitle>相机访问被拒绝</AlertTitle>
                            <AlertDesc>
                                请在浏览器设置中允许相机访问以使用此功能。
                            </AlertDesc>
                        </Alert>
                    )}
                  </div>
                  <FormMessage />
                  <canvas ref={canvasRef} className="hidden"></canvas>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "正在添加..." : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" /> 添加产品
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
