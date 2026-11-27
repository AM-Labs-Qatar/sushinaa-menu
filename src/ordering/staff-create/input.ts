import { z } from "zod";
import { branchId } from "@/ordering/contracts";
import { selectionSchema } from "@/ordering/checkout/validation";

const optionalText = (max: number) => z.string().trim().max(max).default("");
const option = z.string().min(1).max(100);

/** Staff punch body — plate free text; no customer name/phone in v1. */
export const staffCreateBody = z.object({
  branchId,
  plate: z.string().trim().min(1).max(32),
  instructions: optionalText(400),
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9-]{16,80}$/),
  lines: z.array(z.object({
    dishId: option,
    selection: selectionSchema,
    quantity: z.number().int().min(1).max(20),
    note: optionalText(400),
    expectedUnitMinor: z.number().int().min(0),
  }).strict()).min(1).max(100),
}).strict();

export type StaffCreateInput = z.infer<typeof staffCreateBody>;
