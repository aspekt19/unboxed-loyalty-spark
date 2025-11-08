import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CreateReview } from "./CreateReview";
import { ReviewsList } from "./ReviewsList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const CustomerReviewsSection = () => {
  const { address } = useAccount();
  const { session } = useAuth();
  const [usedVouchers, setUsedVouchers] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramKey, setSelectedProgramKey] = useState<string>("");

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

      // Group vouchers by program
      const programGroups = (data || []).reduce((acc, voucher) => {
        const key = `${voucher.token_address}-${voucher.merchant_address}`;
        if (!acc[key]) {
          acc[key] = {
            key,
            tokenAddress: voucher.token_address,
            merchantAddress: voucher.merchant_address,
            vouchers: [],
          };
        }
        acc[key].vouchers.push(voucher);
        return acc;
      }, {} as Record<string, any>);

      const programsList = Object.values(programGroups);
      setPrograms(programsList);

      // Set the first program as selected by default
      if (programsList.length > 0 && !selectedProgramKey) {
        setSelectedProgramKey(programsList[0].key);
      }
    } catch (error) {
      console.error("Error loading used vouchers:", error);
    }
  };

  if (!address || !session) return null;

  if (programs.length === 0) {
    return null;
  }

  const selectedProgram = programs.find((p) => p.key === selectedProgramKey);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reviews & Ratings</CardTitle>
        <CardDescription>
          Share your experience and read reviews from other customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {programs.length > 1 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Loyalty Program</label>
            <Select value={selectedProgramKey} onValueChange={setSelectedProgramKey}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program, idx) => (
                  <SelectItem key={program.key} value={program.key}>
                    Loyalty Program #{idx + 1} ({program.vouchers.length} used vouchers)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedProgram && (
          <div className="space-y-4">
            <CreateReview
              tokenAddress={selectedProgram.tokenAddress}
              merchantAddress={selectedProgram.merchantAddress}
              customerAddress={address.toLowerCase()}
              usedVouchers={selectedProgram.vouchers}
              onReviewCreated={loadUsedVouchers}
            />

            <ReviewsList
              tokenAddress={selectedProgram.tokenAddress}
              merchantAddress={selectedProgram.merchantAddress}
              isMerchant={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
