import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CreateReview } from "./CreateReview";
import { ReviewsList } from "./ReviewsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const CustomerReviewsSection = () => {
  const { address } = useAccount();
  const { session } = useAuth();
  const [usedVouchers, setUsedVouchers] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<{
    tokenAddress: string;
    merchantAddress: string;
  } | null>(null);

  useEffect(() => {
    if (!address || !session) return;

    loadUsedVouchers();
  }, [address, session]);

  const loadUsedVouchers = async () => {
    if (!address) return;

    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select("id, reward_name, used_at, token_address, merchant_address")
        .eq("customer_address", address.toLowerCase())
        .eq("status", "used")
        .order("used_at", { ascending: false });

      if (error) throw error;

      setUsedVouchers(data || []);

      // Set the first program as selected by default
      if (data && data.length > 0) {
        setSelectedProgram({
          tokenAddress: data[0].token_address,
          merchantAddress: data[0].merchant_address,
        });
      }
    } catch (error) {
      console.error("Error loading used vouchers:", error);
    }
  };

  if (!address || !session) return null;

  // Group vouchers by program
  const programGroups = usedVouchers.reduce((acc, voucher) => {
    const key = `${voucher.token_address}-${voucher.merchant_address}`;
    if (!acc[key]) {
      acc[key] = {
        tokenAddress: voucher.token_address,
        merchantAddress: voucher.merchant_address,
        vouchers: [],
      };
    }
    acc[key].vouchers.push(voucher);
    return acc;
  }, {} as Record<string, any>);

  const programs = Object.values(programGroups);

  if (programs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Tabs
        value={selectedProgram ? `${selectedProgram.tokenAddress}-${selectedProgram.merchantAddress}` : undefined}
        onValueChange={(value) => {
          const [tokenAddress, merchantAddress] = value.split("-");
          setSelectedProgram({ tokenAddress, merchantAddress });
        }}
      >
        <TabsList className="w-full">
          {programs.map((program: any, idx: number) => (
            <TabsTrigger
              key={`${program.tokenAddress}-${program.merchantAddress}`}
              value={`${program.tokenAddress}-${program.merchantAddress}`}
              className="flex-1"
            >
              Программа {idx + 1}
            </TabsTrigger>
          ))}
        </TabsList>

        {programs.map((program: any) => (
          <TabsContent
            key={`${program.tokenAddress}-${program.merchantAddress}`}
            value={`${program.tokenAddress}-${program.merchantAddress}`}
            className="space-y-4"
          >
            <CreateReview
              tokenAddress={program.tokenAddress}
              merchantAddress={program.merchantAddress}
              customerAddress={address.toLowerCase()}
              usedVouchers={program.vouchers}
              onReviewCreated={loadUsedVouchers}
            />

            <ReviewsList
              tokenAddress={program.tokenAddress}
              merchantAddress={program.merchantAddress}
              isMerchant={false}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
