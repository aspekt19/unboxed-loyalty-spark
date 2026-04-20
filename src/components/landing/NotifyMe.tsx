import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NotifyMeProps {
  source?: string;
}

const NotifyMe = ({ source = "landing" }: NotifyMeProps) => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      toast.error("Please enter a valid email");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("notify_me_signups")
      .insert({ email: trimmed, source });

    setLoading(false);
    // Treat duplicate as success — don't leak whether email is in the list
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      toast.error("Could not save email. Please try again.");
      return;
    }
    setSubmitted(true);
  };

  return (
    <section className="py-12 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto text-center px-4"
      >
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-3">
          Not ready to connect a wallet?
        </h2>
        <p className="text-muted-foreground mb-6 text-sm sm:text-base">
          Leave your email and we'll let you know when we ship new features,
          merchant case studies and agent guides. No spam.
        </p>

        {submitted ? (
          <div className="flex items-center justify-center gap-2 text-primary font-medium">
            <CheckCircle2 className="h-5 w-5" />
            <span>Thanks — we'll be in touch.</span>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
          >
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Notify me"
              )}
            </Button>
          </form>
        )}
      </motion.div>
    </section>
  );
};

export default NotifyMe;
