
'use server';
/**
 * @fileOverview An AI agent that provides a summary of stock changes for a product.
 *
 * - stockValuationSummary - A function that handles generating the stock change summary.
 * - StockValuationSummaryInput - The input type for the stockValuationSummary function.
 * - StockValuationSummaryOutput - The return type for the stockValuationSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {getProductById as getProductDetails} from '@/lib/product-data-access'; // Assuming a utility function
import { OUTFLOW_REASONS_WITH_LABELS, TIMESCALE_OPTIONS } from '@/lib/types';


const StockValuationSummaryInputSchema = z.object({
  productId: z.string().describe("The ID of the product to analyze."),
  timeScale: z.string().describe('The time scale to filter the data by (e.g., LAST_7_DAYS, LAST_30_DAYS).'),
  outflowReason: z.string().describe("The reason for the stock outflow to filter the data by (e.g., SALE, SPOILAGE, ALL)."),
});
export type StockValuationSummaryInput = z.infer<typeof StockValuationSummaryInputSchema>;

const StockValuationSummaryOutputSchema = z.object({
  summary: z.string().describe('A summary of the stock quantity and value changes based on the provided filters.'),
});
export type StockValuationSummaryOutput = z.infer<typeof StockValuationSummaryOutputSchema>;

// Dummy function to simulate fetching product details from a data source
// In a real app, this would fetch from InventoryContext or a database
async function getProductById(productId: string): Promise<{ id: string; name: string; unit: string } | null> {
  // This is a placeholder. In a real scenario, you'd fetch this from your data source.
  // For the prompt, we only need the name.
  // We can't directly use useInventory() hook here as this is a server-side flow.
  // This function would need to be adapted to fetch data on the server.
  // For now, let's make a simplified assumption or pass productName directly.
  // To avoid complex data fetching here, we'll expect productName to be part of the input or fetch it abstractly.
  // For this iteration, we'll try to pass it as a property to the prompt.
  // A better approach would be for the calling code to resolve product name and pass it.
  // Let's assume the caller (StockValuationForm) will enhance the input or we fetch it within the flow.
  
  // Placeholder - this should be replaced with actual data fetching if the AI needs product specific details not in the name.
  // For the prompt provided, just having productName is sufficient.
  return { id: productId, name: "所选产品", unit: "单位" }; // Fallback
}


export async function stockValuationSummary(input: StockValuationSummaryInput): Promise<StockValuationSummaryOutput> {
  // In a real app, you'd fetch product details here to get the name for the prompt.
  // For now, we'll construct a generic name or rely on the AI to understand "the selected product".
  // Or, ideally, the calling component (StockValuationForm) would resolve the product name.
  // Let's assume we can get product name.
  
  // This is a simplified way to get product name. In a real app, this fetch needs to be robust.
  // This function is NOT available on the server in this context. We need a server-side data access layer.
  // For the purpose of this exercise, we'll pass a generic product name, or enhance the input schema later if needed.
  // For now, we will construct it in the flow.
  
  // Simulate fetching product name (in a real app, use a proper data access function)
  const product = await getProductDetails(input.productId); // This function needs to be implemented server-side
  const productName = product ? product.name : "所选产品";

  const timeScaleLabel = TIMESCALE_OPTIONS.find(ts => ts.value === input.timeScale)?.label || input.timeScale;
  let outflowReasonLabel = "所有原因";
  if (input.outflowReason !== "ALL") {
    outflowReasonLabel = OUTFLOW_REASONS_WITH_LABELS.find(or => or.value === input.outflowReason)?.label || input.outflowReason;
  }


  const enrichedInput = {
    ...input,
    productName,
    timeScaleLabel,
    outflowReasonLabel
  };

  return stockValuationSummaryFlow(enrichedInput);
}

const prompt = ai.definePrompt({
  name: 'stockValuationSummaryPrompt',
  input: {schema: StockValuationSummaryInputSchema.extend({
    productName: z.string(),
    timeScaleLabel: z.string(),
    outflowReasonLabel: z.string()
  })},
  output: {schema: StockValuationSummaryOutputSchema},
  prompt: `您是一位专业的咖啡店库存分析师。

我们正在分析产品：“{{productName}}”。
分析的时间范围是：“{{timeScaleLabel}}”。
出库原因筛选条件为：“{{outflowReasonLabel}}”。

请根据这些信息，提供一个简洁的摘要，重点关注以下几点：
1.  “{{productName}}”库存总数量的变化情况。
2.  “{{productName}}”库存总价值（根据入库成本计算）的变化情况。

描述任何显著的趋势，例如数量或价值的显著增加或减少。
如果选择了具体的出库原因（而非“所有原因”），请尝试推断该原因如何导致了观察到的变化。

请勿编造具体的数字，除非它们是普遍认知的事实或被明确要求估算。重点描述基于筛选条件的质性趋势和模式。
例如，如果时间范围是“过去7天”，出库原因是“销售”，您可以说：“在过去7天里，由于销售，{{productName}}的库存数量可能有所下降，相应的总价值也随之减少。请留意是否有任何急剧下降，这可能表明销售额较高。”

生成一份摘要。
`,
});

const stockValuationSummaryFlow = ai.defineFlow(
  {
    name: 'stockValuationSummaryFlow',
    inputSchema: StockValuationSummaryInputSchema.extend({ // Ensure flow input matches prompt input schema
        productName: z.string(),
        timeScaleLabel: z.string(),
        outflowReasonLabel: z.string()
    }),
    outputSchema: StockValuationSummaryOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);

