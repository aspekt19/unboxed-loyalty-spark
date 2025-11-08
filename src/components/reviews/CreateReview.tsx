import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateReviewProps {
  tokenAddress: string;
  merchantAddress: string;
  customerAddress: string;
  usedVouchers: Array<{
    id: string;
    reward_name: string;
    used_at: string;
  }>;
  onReviewCreated?: () => void;
}

export const CreateReview = ({
  tokenAddress,
  merchantAddress,
  customerAddress,
  usedVouchers,
  onReviewCreated,
}: CreateReviewProps) => {
  const [selectedVoucherId, setSelectedVoucherId] = useState<string>("");
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedVoucherId || rating === 0) {
      toast.error("Please select a voucher and rate");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("reviews")
        .insert({
          token_address: tokenAddress,
          merchant_address: merchantAddress,
          customer_address: customerAddress,
          voucher_id: selectedVoucherId,
          rating,
          comment: comment.trim() || null,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("You already reviewed this voucher");
        } else {
          throw error;
        }
      } else {
        toast.success("Review published");
        setSelectedVoucherId("");
        setRating(0);
        setComment("");
        onReviewCreated?.();
      }
    } catch (error) {
      console.error("Error creating review:", error);
      toast.error("Failed to publish review");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (usedVouchers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leave a Review</CardTitle>
          <CardDescription>
            Use vouchers to leave a verified review
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You have no used vouchers for this loyalty program
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave a Review</CardTitle>
        <CardDescription>
          Share your experience and get verified status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Voucher</label>
          <Select value={selectedVoucherId} onValueChange={setSelectedVoucherId}>
            <SelectTrigger>
              <SelectValue placeholder="Select used voucher" />
            </SelectTrigger>
            <SelectContent>
              {usedVouchers.map((voucher) => (
                <SelectItem key={voucher.id} value={voucher.id}>
                  {voucher.reward_name} - {new Date(voucher.used_at).toLocaleDateString("en")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 ${
                    star <= (hoveredRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Comment (optional)</label>
          <Textarea
            placeholder="Tell us about your experience..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedVoucherId || rating === 0}
          className="w-full"
        >
          {isSubmitting ? "Publishing..." : "Publish Review"}
        </Button>
      </CardContent>
    </Card>
  );
};
