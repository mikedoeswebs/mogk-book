import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreditReason } from '@/lib/db/types';

export async function getCreditBalance(
  supabase: SupabaseClient,
  parentId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('parent_credit_balance', {
    p_parent_id: parentId,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

type LedgerEntry = {
  parent_id: string;
  amount_pence: number;
  reason: CreditReason;
  booking_id?: string | null;
  note?: string | null;
};

export async function writeCreditEntry(
  supabase: SupabaseClient,
  entry: LedgerEntry,
): Promise<void> {
  const { error } = await supabase.from('credits').insert(entry);
  if (error) throw error;
}

/**
 * Auto-apply available credit up to the session price.
 * Returns the breakdown: how much credit to consume, how much still owed.
 */
export function applyCredit(
  pricePence: number,
  balancePence: number,
): { creditApplied: number; amountToCharge: number } {
  const creditApplied = Math.max(0, Math.min(pricePence, balancePence));
  return {
    creditApplied,
    amountToCharge: pricePence - creditApplied,
  };
}
