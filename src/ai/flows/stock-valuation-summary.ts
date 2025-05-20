'use server';
/**
 * @fileOverview A stock valuation summary AI agent.
 *
 * - stockValuationSummary - A function that handles the stock valuation process.
 * - StockValuationSummaryInput - The input type for the stockValuationSummary function.
 * - StockValuationSummaryOutput - The return type for the stockValuationSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StockValuationSummaryInputSchema = z.object({
  timeScale: z.string().describe('The time scale to filter the data by (e.g., last week, last month, last year).'),
  outflowReason: z.string().describe('The reason for the stock outflow to filter the data by (e.g., sales, spoilage, internal use).'),
});
export type StockValuationSummaryInput = z.infer<typeof StockValuationSummaryInputSchema>;

const StockValuationSummaryOutputSchema = z.object({
  summary: z.string().describe('A summary of the stock valuation based on the provided filters.'),
});
export type StockValuationSummaryOutput = z.infer<typeof StockValuationSummaryOutputSchema>;

export async function stockValuationSummary(input: StockValuationSummaryInput): Promise<StockValuationSummaryOutput> {
  return stockValuationSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'stockValuationSummaryPrompt',
  input: {schema: StockValuationSummaryInputSchema},
  output: {schema: StockValuationSummaryOutputSchema},
  prompt: `You are an expert financial analyst specializing in stock valuation for coffee shops.

You will use the provided filters to generate a summary of the stock valuation.

Timescale: {{{timeScale}}}
Outflow Reason: {{{outflowReason}}}

Generate a concise and informative summary of the stock valuation based on these parameters. Consider all the product costs and outflow reasons when calculating the summary.
`,
});

const stockValuationSummaryFlow = ai.defineFlow(
  {
    name: 'stockValuationSummaryFlow',
    inputSchema: StockValuationSummaryInputSchema,
    outputSchema: StockValuationSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
