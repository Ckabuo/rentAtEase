/** Allocated amount counts only when the payment has an issued receipt (or predates receipts). */
export function outstandingKoboOf(charge: {
  amountKobo: number;
  allocations: { amountKobo: number; payment: { receipts: { status: string }[] } }[];
}): number {
  const allocated = charge.allocations.reduce((sum, allocation) => {
    const receipts = allocation.payment.receipts;
    const counts = receipts.length === 0 || receipts.some((receipt) => receipt.status === "ISSUED");
    return counts ? sum + allocation.amountKobo : sum;
  }, 0);
  return Math.max(0, charge.amountKobo - allocated);
}
