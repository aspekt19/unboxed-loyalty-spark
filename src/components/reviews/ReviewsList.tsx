import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ReviewCard } from "./ReviewCard";
import { Star, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReviewsListProps {
  tokenAddress: string;
  merchantAddress: string;
  isMerchant?: boolean;
}

export const ReviewsList = ({ tokenAddress, merchantAddress, isMerchant = false }: ReviewsListProps) => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    verifiedReviews: 0,
  });

  useEffect(() => {
    fetchReviews();
    const channel = supabase
      .channel("reviews-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reviews",
          filter: `token_address=eq.${tokenAddress}`,
        },
        () => {
          fetchReviews();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "review_responses",
        },
        () => {
          fetchReviews();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tokenAddress]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          *,
          review_responses (
            id,
            response_text,
            created_at
          )
        `)
        .eq("token_address", tokenAddress)
        .eq("merchant_address", merchantAddress)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReviews(data || []);

      // Calculate statistics
      const totalReviews = data?.length || 0;
      const verifiedReviews = data?.filter((r) => r.is_verified).length || 0;
      const averageRating =
        totalReviews > 0
          ? data!.reduce((sum, r) => sum + r.rating, 0) / totalReviews
          : 0;

      setStats({
        averageRating,
        totalReviews,
        verifiedReviews,
      });
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading reviews...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Reviews & Ratings</span>
            {stats.totalReviews > 0 && (
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="text-2xl font-bold">
                  {stats.averageRating.toFixed(1)}
                </span>
              </div>
            )}
          </CardTitle>
          <CardDescription>
            {isMerchant ? "Manage customer reviews" : "Reviews from other customers"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <Badge variant="outline" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Reviews: {stats.totalReviews}
            </Badge>
            <Badge variant="outline" className="gap-2">
              Verified: {stats.verifiedReviews}
            </Badge>
            {stats.totalReviews > 0 && (
              <Badge variant="outline">
                Verification Rate:{" "}
                {((stats.verifiedReviews / stats.totalReviews) * 100).toFixed(0)}%
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              {isMerchant
                ? "No reviews yet. Encourage customers to share their experience!"
                : "No reviews yet. Be the first!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isMerchant={isMerchant}
              merchantAddress={merchantAddress}
            />
          ))}
        </div>
      )}
    </div>
  );
};
