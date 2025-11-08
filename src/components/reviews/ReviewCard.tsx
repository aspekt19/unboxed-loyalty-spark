import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, CheckCircle2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    comment: string | null;
    is_verified: boolean;
    created_at: string;
    customer_address: string;
    review_responses?: Array<{
      id: string;
      response_text: string;
      created_at: string;
    }>;
  };
  isMerchant?: boolean;
  merchantAddress?: string;
}

export const ReviewCard = ({ review, isMerchant = false, merchantAddress }: ReviewCardProps) => {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitResponse = async () => {
    if (!responseText.trim() || !merchantAddress) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("review_responses")
        .insert({
          review_id: review.id,
          merchant_address: merchantAddress,
          response_text: responseText.trim(),
        });

      if (error) throw error;

      toast.success("Response published");
      setResponseText("");
      setShowResponseForm(false);
    } catch (error) {
      console.error("Error submitting response:", error);
      toast.error("Failed to submit response");
    } finally {
      setIsSubmitting(false);
    }
  };

  const response = review.review_responses?.[0];

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < review.rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted"
                  }`}
                />
              ))}
            </div>
            {review.is_verified && (
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Verified
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(review.created_at), {
              addSuffix: true,
              locale: enUS,
            })}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {review.customer_address.slice(0, 6)}...{review.customer_address.slice(-4)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {review.comment && (
          <p className="text-sm text-foreground">{review.comment}</p>
        )}

        {response ? (
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Merchant Response</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(response.created_at), {
                  addSuffix: true,
                  locale: enUS,
                })}
              </span>
            </div>
            <p className="text-sm">{response.response_text}</p>
          </div>
        ) : isMerchant && !showResponseForm ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResponseForm(true)}
            className="w-full"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Reply to Review
          </Button>
        ) : null}

        {showResponseForm && (
          <div className="space-y-2">
            <Textarea
              placeholder="Write your response..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSubmitResponse}
                disabled={isSubmitting || !responseText.trim()}
                size="sm"
              >
                Submit
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowResponseForm(false);
                  setResponseText("");
                }}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
