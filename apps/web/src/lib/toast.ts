import { toast as sonner } from "sonner";

export const toast = {
  success(message: string) {
    sonner.success(message);
  },
  error(message: string) {
    sonner.error(message);
  },
  message(message: string) {
    sonner.message(message);
  },
};
