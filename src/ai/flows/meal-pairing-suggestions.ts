// 'use server';
/**
 * @fileOverview Meal pairing suggestions AI agent.
 *
 * - getMealPairingSuggestions - A function that suggests meal pairings based on the current order.
 * - MealPairingSuggestionsInput - The input type for the getMealPairingSuggestions function.
 * - MealPairingSuggestionsOutput - The return type for the getMealPairingSuggestions function.
 */

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MealPairingSuggestionsInputSchema = z.object({
  orderItems: z
    .array(z.string())
    .describe('An array of items currently in the order.'),
});
export type MealPairingSuggestionsInput = z.infer<
  typeof MealPairingSuggestionsInputSchema
>;

const MealPairingSuggestionsOutputSchema = z.object({
  suggestions: z
    .array(z.string())
    .describe('An array of suggested meal pairings.'),
});
export type MealPairingSuggestionsOutput = z.infer<
  typeof MealPairingSuggestionsOutputSchema
>;

export async function getMealPairingSuggestions(
  input: MealPairingSuggestionsInput
): Promise<MealPairingSuggestionsOutput> {
  return mealPairingSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'mealPairingSuggestionsPrompt',
  input: {schema: MealPairingSuggestionsInputSchema},
  output: {schema: MealPairingSuggestionsOutputSchema},
  prompt: `You are a helpful assistant, expert at suggesting popular meal pairings.

  Based on the current order, suggest some popular meal pairings that would complement the existing items.
  The suggestions should be concise and appealing to the customer.

  Current Order: {{{orderItems}}}
  `,
});

const mealPairingSuggestionsFlow = ai.defineFlow(
  {
    name: 'mealPairingSuggestionsFlow',
    inputSchema: MealPairingSuggestionsInputSchema,
    outputSchema: MealPairingSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
