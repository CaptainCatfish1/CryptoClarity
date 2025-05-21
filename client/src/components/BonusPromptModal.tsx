import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address"),
});

type FormValues = z.infer<typeof formSchema>;

interface BonusPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
  alreadyUsedToday?: boolean;
}

export function BonusPromptModal({ isOpen, onClose, onSuccess, alreadyUsedToday = false }: BonusPromptModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);

    try {
      const response = await apiRequest("POST", "/api/activate-bonus", data);
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Bonus Prompts Activated!",
          description: result.message,
        });
        
        // Pass the email back to the parent component
        onSuccess(data.email);
        onClose();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to activate bonus prompts. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error activating bonus prompts:", error);
      toast({
        title: "Error",
        description: "Failed to activate bonus prompts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {alreadyUsedToday
              ? "You've already used your bonus today"
              : "Unlock 5 Bonus Prompts"}
          </DialogTitle>
          <DialogDescription>
            {alreadyUsedToday ? (
              <div className="py-2">
                <p>You've already used your bonus prompts for today.</p>
                <p className="mt-2">Come back tomorrow for 5 more free prompts!</p>
                <p className="mt-4 text-sm opacity-80">
                  Want unlimited access? Upgrade to our premium plan for 1000 prompts per day.
                </p>
              </div>
            ) : (
              <div className="py-2">
                <p>Enter your email to unlock 5 additional prompts for today.</p>
                <p className="mt-2">We'll never share your email with third parties.</p>
                <p className="mt-4 text-sm opacity-80">
                  Bonus prompts reset daily. Get 1000 prompts per day with our premium plan.
                </p>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {!alreadyUsedToday && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="your.email@example.com"
                        {...field}
                        className="w-full"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={onClose} type="button" disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Activating...
                    </>
                  ) : (
                    "Unlock Bonus Prompts"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {alreadyUsedToday && (
          <DialogFooter className="pt-4">
            <Button onClick={onClose} type="button">
              Got it
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}